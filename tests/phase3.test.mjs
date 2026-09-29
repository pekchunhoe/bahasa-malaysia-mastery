import { test } from "node:test";
import assert from "node:assert/strict";
import { master } from "../data/generated/master.js";
import { teacherContent } from "../data/teacher/content.js";
import { normalizeTeacherContent } from "../data/schema/enrichment.js";
import { supplementaryFor, attachEnrichment } from "../js/enrichment-service.js";
import { getCurriculumPack } from "../js/curriculum-service.js";
import { activityRegistry } from "../activities/registry.js";
import { renderEnrichment, guidedSupport } from "../components/enrichment.js";
import { createStore } from "../js/state.js";
import { hydrate, STORAGE_KEY } from "../js/storage.js";
import { createAIService } from "../js/ai-teacher.js";
import { tutorRequest, buildTutorPrompt, cacheIdentity } from "../js/tutor-actions.js";
import { checkWritingBasics } from "../js/local-writing-check.js";
import { compareTranscription } from "../js/transcription.js";
import { e } from "../components/ui.js";

const empty = () => ({ version: "test", enrichment: [], vocabularyBank: [], guidedWriting: [], storyStarters: [] });
const demo = { source_type: "demo", status: "demo" };
const reviewed = { source_type: "teacher_authored", status: "reviewed", author: "Fixture teacher", reviewed_by: "Fixture reviewer", reviewed_at: "2026-09-27" };
const normalize = input => normalizeTeacherContent(input, master.items);
const memory = () => {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
};
const setup = (year = 1) => {
  const storage = memory(), store = createStore({ storage }), pack = getCurriculumPack(year);
  store.setYear(year);
  return { storage, store, pack };
};

test("Phase 3 keeps the master immutable, 1080 IDs, 81 phrases and duplicate-text identities", () => {
  const before = JSON.stringify(master);
  for (let year = 1; year <= 6; year++) {
    const pack = getCurriculumPack(year);
    assert.equal(pack.items.length, year <= 3 ? 240 : 120);
    assert.deepEqual(pack.items, master.items.filter(i => i.year === year));
    if (year <= 3) assert.deepEqual(pack.themes, []);
    for (const word of pack.vocabulary) {
      assert.equal(word.source_type, year <= 3 ? "reviewed_source" : "ai_generated");
      assert.equal(word.word, master.enrichment[word.id].word);
      assert.equal(word.meaning, "");
      assert.equal(word.category, "");
    }
  }
  assert.equal(master.items.filter(i => i.form === "phrase").length, 81);
  assert.equal(new Set(master.items.map(i => i.id)).size, 1080);
  assert.equal(master.items.length - new Set(master.items.map(i => i.text)).size, 90);
  assert.equal(JSON.stringify(master), before);
});

test("enrichment attaches by stable ID, never by repeated text; missing records remain usable", () => {
  const first = getCurriculumPack(1).vocabulary.find(w => w.id === "Y1-E-U12-I09");
  const later = getCurriculumPack(3).vocabulary.find(w => w.id === "Y3-E-U09-I02");
  assert.equal(first.word, later.word);
  assert.equal(first.enrichment.source_item_id, first.id);
  assert.equal(later.enrichment.source_item_id, later.id);
  assert.notEqual(first.enrichment.source_item_id, later.enrichment.source_item_id);
  assert.ok(getCurriculumPack(3).vocabulary.find(w => w.id === "Y3-E-U10-I09").enrichment);
  const detached = attachEnrichment([first], {});
  assert.equal(detached[0].word, "jalan raya");
  assert.equal(detached[0].enrichment, null);
  const { pack, store } = setup(3);
  pack.enrichment = {};
  pack.vocabulary = attachEnrichment(pack.vocabulary, {});
  for (const activity of ["vocabulary", "sentence", "expansion"]) {
    const draft = activity === "vocabulary" ? null : store.draft(activity, "Ayat", pack, { itemId: "Y3-E-U10-I09" });
    assert.ok(!activityRegistry[activity].render({ pack, state: store.state, draft }).includes("undefined"));
  }
});

test("schema blocks source overrides, invalid provenance, orphan IDs and uncertain invented categories", () => {
  const base = { ...demo, source_item_id: "Y1-E-U01-I01", meaning: "Contoh" };
  for (const override of [
    { text: "replacement" }, { teks_app: "replacement" }, { word: "replacement" }, { item_id: "other" },
    { source_item_id: "missing-id" }, { source_item_id: master.items.find(i => i.type === "imlak").id },
    { source_type: "reviewed_source" }, { source_type: "ai_generated" }, { status: "reviewed" },
    { grammatical_category: "guessed" }, { related_words: "not an array" }, { meaning: 42 },
  ]) assert.throws(() => normalize({ ...empty(), enrichment: [{ ...base, ...override }] }));
  assert.throws(() => normalize({ ...empty(), enrichment: [base, base] }));
  assert.throws(() => normalize({ ...empty(), enrichment: [{ ...base, source_type: "teacher_authored", status: "reviewed" }] }));
  const result = normalize({ ...empty(), enrichment: [{ ...base, grammatical_category: "", meaning: "", related_words: [] }] });
  assert.equal(result.enrichment[0].meaning, undefined);
  assert.equal(renderEnrichment(result.enrichment[0]), "");
});

test("publication gates teacher drafts and demo vocabulary while retaining approved master focus", () => {
  const content = normalize({ ...empty(),
    enrichment: [{ source_type: "teacher_authored", status: "draft", source_item_id: "Y1-E-U01-I01", meaning: "Private draft hint" }],
    vocabularyBank: [
      { ...demo, id: "demo-upper", year: 4, word: "contoh" },
      { source_type: "teacher_authored", status: "draft", id: "draft-upper", year: 4, word: "draf" },
      { ...reviewed, id: "teacher-upper", year: 6, word: "kerjasama", meaning: "Bekerja bersama-sama." },
    ],
  });
  assert.equal(supplementaryFor(1, content).enrichment["Y1-E-U01-I01"].status, "diluluskan");
  assert.equal(supplementaryFor(4, content).vocabularyBank.length, 0);
  assert.equal(supplementaryFor(6, content).vocabularyBank[0].id, "teacher-upper");
  for (const year of [4, 5, 6]) {
    const { pack, store } = setup(year);
    assert.equal(pack.vocabulary.length, 120);
    assert.ok(activityRegistry.vocabulary.render({ pack, state: store.state }).includes(e(pack.vocabulary[0].word)));
  }
});

test("master replaces sample enrichments while preserved writing samples retain DEMO provenance", () => {
  const content = normalize(teacherContent);
  assert.equal(content.enrichment.length, 0);
  assert.equal(content.guidedWriting.length, 2);
  assert.equal(content.storyStarters.length, 1);
  assert.deepEqual(content.guidedWriting.map(t => t.id), ["demo-petang", "demo-taman"]);
  assert.deepEqual(content.storyStarters.map(t => t.id), ["demo-buku"]);
  for (const item of [...content.enrichment, ...content.guidedWriting, ...content.storyStarters]) {
    assert.equal(item.source_type, "demo");
    assert.equal(item.status, "demo");
    assert.equal(item.reviewed_by, undefined);
  }
  assert.throws(() => normalize({ ...empty(), guidedWriting: [content.guidedWriting[0]],
    storyStarters: [{ ...content.storyStarters[0], id: "demo-petang" }] }));
  assert.throws(() => normalize({ ...empty(), guidedWriting: [{ ...content.guidedWriting[0], year: 7 }] }));
  assert.throws(() => normalize({ ...empty(), storyStarters: [{ ...content.storyStarters[0], year: [] }] }));
});

test("examples require disclosure, hints escape authored text and never expose teacher notes", () => {
  const record = { ...demo, meaning: "<script>meaning</script>", example_sentence: "<script>example</script>",
    related_words: ["<img src=x>"], notes_for_teacher: "TEACHER_ONLY_MARKER" };
  const html = renderEnrichment(record);
  assert.ok(html.includes("DEMO"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img src=x>"));
  assert.ok(!html.includes("TEACHER_ONLY_MARKER"));
  assert.ok(!/<details[^>]*\bopen\b/.test(html));
  assert.equal((html.match(/<summary>/g) || []).length, 1);
  assert.ok(html.includes("Tulis ayat kamu sendiri"));
  const { pack, store } = setup();
  const draft = store.draft("sentence", "Ayat", pack, { itemId: "Y1-E-U01-I01" });
  store.updateDraft(draft.id, { text: "Ayat saya sendiri." });
  const before = JSON.stringify(draft);
  assert.ok(activityRegistry.sentence.render({ pack, state: store.state, draft }).includes("Lihat contoh ayat"));
  assert.equal(JSON.stringify(draft), before);
});

test("practice receives no enrichment answers; local feedback never calls AI or rewrites attempts", async () => {
  let calls = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => { calls++; throw new Error("Network forbidden"); };
  try {
    const { pack, store } = setup();
    const item = pack.items[0], draft = store.draft("practice", "Latihan", pack, { itemId: item.id });
    const html = activityRegistry.practice.render({ pack, state: store.state, draft });
    assert.ok(!html.includes("Sejenis haiwan"));
    assert.ok(!html.includes("Ayam itu makan jagung"));
    assert.ok(!html.includes("Lihat petunjuk"));
    assert.ok(!html.includes('data-ai='));
    store.updateDraft(draft.id, { text: "ayam" });
    assert.equal(compareTranscription(item.text, draft.text).correct, true);
    store.practice(item.id, { attempts: 1, correct: true, independentCorrect: true });
    checkWritingBasics(draft.text);
    assert.equal(draft.text, "ayam");
    assert.equal(calls, 0);
  } finally { globalThis.fetch = oldFetch; }
});

test("limited surface checker distinguishes empty/capital/punctuation/spacing without claiming grammar correctness", () => {
  assert.deepEqual(checkWritingBasics(" ").messages, ["Tulis ayat kamu dahulu."]);
  const result = checkWritingBasics(" ali  membaca ");
  assert.equal(result.scope, "surface_only");
  assert.equal(result.messages.length, 4);
  assert.equal(checkWritingBasics("Ali membaca.").messages.length, 0);
  assert.equal(checkWritingBasics('"Ali membaca."').messages.length, 0);
  // Surface rules intentionally cannot judge this sentence's grammar.
  assert.equal(checkWritingBasics("Saya ialah pergi.").messages.length, 0);
});

test("guided stages display authored aids separately; notes and model text never enter AI context", async () => {
  const { pack, store } = setup(6), topic = pack.writingTopics.find(t => t.id === 'demo-petang');
  topic.model_text = "MODEL_ONLY_MARKER";
  topic.notes_for_teacher = "TEACHER_ONLY_MARKER";
  const draft = store.draft("essay", topic.title, pack, { contentId: topic.id });
  store.updateDraft(draft.id, { text: "Tulisan murid.", plan: { p0: "PLAN_ONLY_MARKER" } });
  for (let stage = 0; stage < 8; stage++) {
    draft.stage = stage;
    const html = activityRegistry.essay.render({ pack, draft, state: store.state });
    assert.ok(!html.includes("undefined"));
    assert.ok(!html.includes("TEACHER_ONLY_MARKER"));
    if (stage === 5) { assert.ok(html.includes("MODEL_ONLY_MARKER")); assert.ok(!/<details[^>]*\bopen\b/.test(html)); }
  }
  assert.ok(guidedSupport(topic, 1).includes("Lihat rangka contoh"));
  assert.equal(draft.text, "Tulisan murid.");
  const raw = { action: "essay_next_step", activity: "essay", year: 6, title: topic.title,
    contentId: topic.id, studentText: draft.text, ...{ model_text: topic.model_text, plan: draft.plan, enrichment: topic } };
  assert.deepEqual(Object.keys(tutorRequest(raw)), ["action", "activity", "year", "title", "studentText", "contentId"]);
  assert.ok(!buildTutorPrompt(raw).includes("ONLY_MARKER"));
  const service = createAIService({ fetcher: () => { throw new Error("No Gemini allowed"); } });
  const response = await service.request(raw, { mode: "prompt" });
  assert.ok(!response.prompt.includes("ONLY_MARKER"));
  assert.notEqual(cacheIdentity(raw), cacheIdentity({ ...raw, contentId: "different-essay-same-title" }));
  assert.notEqual(cacheIdentity(raw), cacheIdentity({ ...raw, title: "Tajuk lain" }));
});

test("content IDs isolate same-title essay/story drafts and survive reload, year/unit changes and resume", () => {
  const { store, storage, pack } = setup();
  for (const activity of ["essay", "story"]) {
    const first = store.draft(activity, "Tajuk sama", pack, { contentId: `${activity}-one` });
    store.updateDraft(first.id, { text: "Tulisan pertama.", lines: ["Sambungan pertama."] });
    const second = store.draft(activity, "Tajuk sama", pack, { contentId: `${activity}-two` });
    store.updateDraft(second.id, { text: "Tulisan kedua." });
    assert.notEqual(first.id, second.id);
    store.setUnit(2); store.setYear(4);
    const restored = createStore({ storage });
    restored.resume(first.id);
    assert.equal(restored.draft(activity, "Tajuk sama", pack, { contentId: `${activity}-one` }).text, "Tulisan pertama.");
    assert.equal(restored.state.drafts[second.id].text, "Tulisan kedua.");
    assert.equal(restored.state.drafts[first.id].source_type, "pupil");
    store.setYear(1);
  }
});

test("legacy title-based drafts adopt an authored identity without losing originals, stages or progress", () => {
  const { pack, store, storage } = setup();
  const essay = store.draft("essay", pack.writingTopics[0].title, pack);
  store.updateDraft(essay.id, { text: "Karangan lama.", stage: 5, plan: { p0: "Idea lama" } });
  const story = store.draft("story", pack.storyStarters[0].title, pack);
  store.updateDraft(story.id, { text: "Sambungan lama.", lines: ["Baris lama."] });
  const expansion = store.draft("expansion", "Ayat", pack, { itemId: pack.items[0].id });
  store.updateDraft(expansion.id, { original: "Asal saya.", text: "Revisi saya." });
  store.practice(pack.items[0].id, { attempts: 3, correct: true });
  const raw = JSON.parse(storage.getItem(STORAGE_KEY));
  delete raw.selectedEssayContent;
  for (const d of Object.values(raw.drafts)) { delete d.contentId; delete d.source_type; }
  storage.setItem(STORAGE_KEY, JSON.stringify(raw));
  const restored = createStore({ storage });
  assert.equal(restored.draft("essay", essay.title, pack, { contentId: pack.writingTopics[0].id }).id, essay.id);
  assert.equal(restored.draft("story", story.title, pack, { contentId: pack.storyStarters[0].id }).id, story.id);
  assert.equal(restored.state.drafts[essay.id].stage, 5);
  assert.equal(restored.state.drafts[story.id].lines[0], "Baris lama.");
  restored.updateDraft(expansion.id, { original: "Wrong overwrite", text: "Revisi kedua." });
  assert.equal(restored.state.drafts[expansion.id].original, "Asal saya.");
  assert.equal(restored.state.practice[pack.items[0].id].attempts, 3);
  assert.equal(hydrate(JSON.parse(storage.getItem(STORAGE_KEY))).drafts[essay.id].contentId, pack.writingTopics[0].id);
});

test("paragraph, essay and story never assemble imlak or vocabulary examples into pupil writing", () => {
  for (const year of [1, 3, 4, 6]) {
    const { pack, store } = setup(year);
    for (const activity of ["paragraph", "essay", "story"]) {
      const title = activity === "essay" ? pack.writingTopics[0].title
        : activity === "story" ? pack.storyStarters[0].title : pack.activitySets.paragraph.title;
      const draft = store.draft(activity, title, pack);
      const html = activityRegistry[activity].render({ pack, draft, state: store.state });
      for (const item of pack.items.filter(i => i.type === "imlak")) assert.ok(!html.includes(e(item.text)));
      assert.equal(draft.text, "");
      assert.deepEqual(draft.lines, []);
    }
  }
});

test("future reviewed vocabulary reaches the bank with its own provenance and no imlak changes", () => {
  const before = JSON.stringify(master);
  const collection = normalize({ ...empty(), vocabularyBank: [{ ...reviewed,
    id: "teacher-y4-bank-1", year: [4, 5, 6], word: "kata pilihan guru", simple_definition: "Makna pilihan guru." }] });
  for (const year of [4, 5, 6]) {
    const pack = getCurriculumPack(year, "master-2026", collection), { store } = setup(year);
    store.setUnit(3);
    assert.equal(pack.vocabulary.length, 121);
    const added = pack.vocabulary.find(w => w.id === "teacher-y4-bank-1");
    assert.equal(added.source_type, "teacher_authored");
    assert.deepEqual(added.enrichment, collection.vocabularyBank[0]);
    assert.deepEqual(pack.items, master.items.filter(i => i.year === year));
    const html = activityRegistry.vocabulary.render({ pack, state: store.state });
    assert.match(html, /kata pilihan guru/);
    assert.match(html, /Bahan tambahan guru/);
    assert.ok(!html.includes("Sumber: master disahkan"));
    assert.ok(!html.includes("Tiada bank ejaan"));
    pack.vocabulary[0].word = "Changed copy";
  }
  assert.equal(collection.vocabularyBank[0].word, "kata pilihan guru");
  assert.equal(JSON.stringify(master), before);
  assert.equal(getCurriculumPack(4).vocabulary.length, 120);
});

test("provenance survives publication, cloning, pupil hydration and mocked AI caching", async () => {
  const record = { ...reviewed, source_item_id: "Y1-E-U01-I01", meaning: "Fixture meaning" };
  const content = normalize({ ...empty(), enrichment: [record] });
  assert.deepEqual(supplementaryFor(1, content).enrichment[record.source_item_id], record);
  const pack = getCurriculumPack(1, "master-2026", content);
  assert.equal(pack.vocabulary[0].source_type, "reviewed_source");
  assert.equal(pack.vocabulary[0].enrichment.source_type, "teacher_authored");
  pack.vocabulary[0].enrichment.meaning = "Changed hint";
  assert.equal(content.enrichment[0].meaning, "Fixture meaning");
  assert.equal(master.items[0].text, "ayam");
  for (const reviewed_at of ["2026-02-30", "2026-13-01", "invalid"])
    assert.throws(() => normalize({ ...empty(), enrichment: [{ ...record, reviewed_at }] }));
  const service = createAIService({ fetcher: async () => Response.json({ ok: true, action: "sentence_check",
    source_type: "reviewed_source", data: { ok: true, summary: "Fixture AI", errors: [], suggestions: [], explanation: "", example: null } }) });
  const input = { action: "sentence_check", activity: "sentence", year: 1, studentText: "Ayat saya." };
  const first = await service.request(input);
  assert.equal(first.source_type, "ai_generated");
  first.source_type = "reviewed_source";
  assert.equal((await service.request(input)).source_type, "ai_generated");
  const { store, storage } = setup();
  const draft = store.draft("sentence", "Ayat", pack);
  store.updateDraft(draft.id, { text: "Ayat saya.", source_type: "ai_generated" });
  assert.equal(createStore({ storage }).state.drafts[draft.id].source_type, "pupil");
});

test("legacy migration keeps ambiguous and removed content separate without merging existing IDs", () => {
  for (const activity of ["essay", "story"]) {
    const { store, storage, pack } = setup();
    const key = activity === "essay" ? "writingTopics" : "storyStarters";
    pack[key] = [{ id: "one", title: "Tajuk sama" }, { id: "two", title: "Tajuk sama" }];
    const legacy = store.draft(activity, "Tajuk sama", pack);
    store.updateDraft(legacy.id, { text: "Tulisan lama.", original: "Asal.", lines: ["Sambungan."], stage: 4 });
    const one = store.draft(activity, "Tajuk sama", pack, { contentId: "one" });
    const two = store.draft(activity, "Tajuk sama", pack, { contentId: "two" });
    assert.equal(new Set([legacy.id, one.id, two.id]).size, 3);
    assert.equal(legacy.contentId, "");
    const restored = createStore({ storage });
    restored.resume(legacy.id);
    assert.equal(restored.draft(activity, legacy.title, pack).id, legacy.id);
    assert.equal(restored.state.drafts[legacy.id].text, "Tulisan lama.");
    restored.resume(one.id);
    pack[key] = [];
    assert.equal(restored.draft(activity, "Renamed or removed", pack, { contentId: "one" }).id, one.id);
    assert.equal(restored.state.drafts[two.id].contentId, "two");
    assert.equal(restored.state.drafts[legacy.id].original, "Asal.");
  }
});

test("unambiguous migration is durable, preserves other storage keys and tolerates save failure", () => {
  const { store, storage, pack } = setup(), topic = pack.writingTopics[0];
  storage.setItem("unrelated-key", "keep me");
  const old = store.draft("essay", topic.title, pack);
  store.updateDraft(old.id, { text: "Karangan lama.", plan: { p0: "Idea" }, stage: 6 });
  const reopened = createStore({ storage });
  const migrated = reopened.draft("essay", topic.title, pack, { contentId: topic.id });
  assert.equal(migrated.id, old.id);
  const again = createStore({ storage });
  assert.equal(again.draft("essay", "Renamed title", pack, { contentId: topic.id }).id, old.id);
  assert.equal(again.state.drafts[old.id].stage, 6);
  assert.equal(storage.getItem("unrelated-key"), "keep me");
  const raw = JSON.parse(storage.getItem(STORAGE_KEY));
  delete raw.drafts[old.id].contentId;
  storage.setItem(STORAGE_KEY, JSON.stringify(raw));
  const denied = createStore({ storage: { getItem: storage.getItem, setItem() { throw new Error("Quota"); } } });
  assert.equal(denied.draft("essay", topic.title, pack, { contentId: topic.id }).text, "Karangan lama.");
  assert.equal(denied.persistent, false);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).drafts[old.id].text, "Karangan lama.");
});

test("guided-writing optional metadata stays absent and legitimate sample titles remain intact", () => {
  const content = normalize({ ...empty(), guidedWriting: [{ ...demo, id: "minimal-essay", year: 2, title: "Tajuk pilihan" }] });
  const pack = getCurriculumPack(2, "master-2026", content), { store } = setup(2);
  const topic = pack.writingTopics.find(t => t.id === 'minimal-essay'), draft = store.draft("essay", topic.title, pack, { contentId: topic.id });
  assert.equal(topic.theme, undefined);
  assert.equal(topic.unit, undefined);
  assert.equal(topic.prompt, undefined);
  for (let stage = 0; stage < 8; stage++) {
    draft.stage = stage;
    assert.ok(!activityRegistry.essay.render({ pack, draft, state: store.state }).includes("undefined"));
  }
  assert.deepEqual(getCurriculumPack(2).writingTopics.filter(t => t.source_type === 'demo').map(t => t.title), ["Petang Bersama Rakan", "Taman yang Bersih"]);
});
