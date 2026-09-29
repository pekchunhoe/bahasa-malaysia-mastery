import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { master } from "../data/generated/master.js";
import { adaptMasterRows } from "../data/adapters/excel.js";
import { getCurriculumPack, filterItems } from "../js/curriculum-service.js";
import { createStore } from "../js/state.js";
import { hydrate, STORAGE_KEY } from "../js/storage.js";
import { compareTranscription } from "../js/transcription.js";
import { tutorRequest, cacheIdentity, buildTutorPrompt } from "../js/tutor-actions.js";
import { createAIService } from "../js/ai-teacher.js";
import { createSpeechService } from "../js/speech-service.js";
import { activityRegistry } from "../activities/registry.js";
import { vocabularyCards } from "../activities/vocabulary.js";
import { e } from "../components/ui.js";

const memory = () => {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
};
const row = { item_id: "fixture-1", tahun: 1, jenis: "ejaan", tema_no: "", tema: "", unit_no: 1,
  unit: "", item_no: 1, teks_sumber: "wrong source", teks_app: "jalan raya", status_semakan: "Disahkan",
  aktif: true, isu_semakan: "correction", fail_sumber: "source.docx", lokasi_sumber: "table 1", edisi: "2026" };

test("real workbook exports 1080 approved items, 24 units each, stable unique IDs and intact phrases", async () => {
  assert.equal(master.items.length, 1080);
  assert.equal(new Set(master.items.map(i => i.id)).size, 1080);
  assert.equal(master.items.filter(i => i.form === "phrase").length, 81);
  assert.equal(master.items.length - new Set(master.items.map(i => i.text)).size, 90);
  for (const text of ["jalan raya", "ringan tulang"])
    assert.ok(master.items.some(i => i.text === text && i.form === "phrase"));
  for (let year = 1; year <= 6; year++) {
    const pack = getCurriculumPack(year);
    assert.equal(pack.items.length, year <= 3 ? 240 : 120);
    assert.equal(pack.units.length, 24);
    assert.equal(pack.vocabulary.length, year <= 3 ? 240 : 120);
    for (let unit = 1; unit <= 24; unit++) {
      const items = filterItems(master.items, { year, unit, type: year <= 3 ? "ejaan" : "imlak" });
      assert.equal(items.length, year <= 3 ? 10 : 5);
    }
    assert.equal(filterItems(pack.items, { type: year <= 3 ? "imlak" : "ejaan" }).length, 0);
    if (year <= 3) {
      assert.deepEqual(pack.themes, []);
      assert.ok(pack.items.every(i => i.theme === "" && i.themeNo === null && i.unit === ""));
      assert.ok(pack.vocabulary.every(i => !i.category && !i.meaning && !i.example));
    }
  }
  const audit = JSON.parse(await readFile(new URL("../audit/workbook.json", import.meta.url)));
  assert.deepEqual(audit.sheets.filter(s => ["MASTER_CONTENT", "ENRICHMENT", "VOCAB_FOCUS"].includes(s.name)).map(s => [s.name, s.rows]), [["MASTER_CONTENT", 1081], ["ENRICHMENT", 721], ["VOCAB_FOCUS", 361]]);
  assert.equal(audit.excluded, 0);
  const hash = createHash("sha256").update(await readFile(new URL("../data/BM_MASTER_EJAAN_IMLAK_2026_MUKTAMAD.xlsx", import.meta.url))).digest("hex");
  assert.equal(audit.validation.ok, true);
  assert.equal(audit.sha256, hash);
});

test("adapter filters review/active/empty values, rejects bad IDs and preserves duplicate text across reordered rows", () => {
  const rows = [row, { ...row, item_id: "fixture-2", unit_no: 2 },
    { ...row, item_id: "excluded-1", status_semakan: "Draf" },
    { ...row, item_id: "excluded-2", aktif: false },
    { ...row, item_id: "excluded-3", aktif: "false" },
    { ...row, item_id: "excluded-4", teks_app: "  " }];
  const result = adaptMasterRows(rows);
  assert.deepEqual(result.items.map(i => i.id), ["fixture-1", "fixture-2"]);
  assert.ok(result.items.every(i => i.text === "jalan raya"));
  assert.equal(result.audit[0].teks_sumber, "wrong source");
  assert.equal(result.audit[0].isu_semakan, "correction");
  assert.deepEqual(adaptMasterRows([...rows].reverse()).items.reverse(), result.items);
  for (const invalid of [{ item_id: "" }, { tahun: 0 }, { jenis: "word" }, { unit_no: "bad" }])
    assert.throws(() => adaptMasterRows([{ ...row, ...invalid }]));
  assert.throws(() => adaptMasterRows([row, row]));
  assert.throws(() => adaptMasterRows([row], ["item_id"]));
});

test("reviewed corrections appear in pupil cards and exercises; source spelling stays in the audit", () => {
  const pack = getCurriculumPack(3), store = createStore({ storage: memory() });
  store.setYear(3);
  store.setUnit(14);
  const item = pack.items.find(i => i.id === "Y3-E-U14-I03");
  const cards = vocabularyCards(pack, store.state);
  assert.ok(cards.includes("berpengalaman"));
  assert.ok(!cards.includes("berpengelaman"));
  assert.ok(!cards.includes("data-select-word=\"Y3-E-U15"));
  const draft = store.draft("sentence", "Ayat", pack, { itemId: item.id });
  const html = activityRegistry.sentence.render({ pack, draft, state: store.state });
  assert.ok(html.includes("berpengalaman"));
  assert.ok(!html.includes("berpengelaman"));
});

test("all production activities render for every year; paragraphs/stories never assemble imlak items", () => {
  for (let year = 1; year <= 6; year++) {
    const pack = getCurriculumPack(year), store = createStore({ storage: memory() });
    store.setYear(year);
    for (const [activity, spec] of Object.entries(activityRegistry)) {
      const draft = activity === "vocabulary" ? null : store.draft(activity,
        activity === "essay" ? pack.writingTopics[0].title : pack.activitySets[spec.task].title,
        pack, { itemId: ["sentence", "expansion", "practice"].includes(activity) ? pack.items[0].id : "" });
      const html = spec.render({ pack, draft, state: store.state });
      assert.ok(!html.includes("undefined"), `${year}:${activity}`);
      if (draft) assert.ok(html.includes('id="student-text"'));
      if (["paragraph", "story", "essay"].includes(activity)) {
        for (const item of pack.items.filter(i => i.type === "imlak")) assert.ok(!html.includes(e(item.text)));
        assert.equal(draft.text, "");
      }
      if (activity === "essay") assert.ok(html.includes("CONTOH RUJUKAN MASTER"));
      if (activity === "story") assert.ok(html.includes("DEMO"));
      if (activity === "vocabulary" && year >= 4) assert.ok(html.includes(e(pack.vocabulary[0].word)));
    }
  }
});

test("practice hides all answers until deliberate reveal, offers speech fallback and keeps feedback separate", () => {
  for (const year of [1, 4]) {
    const pack = getCurriculumPack(year), store = createStore({ storage: memory() });
    store.setYear(year);
    const item = pack.items[0], draft = store.draft("practice", "Latihan", pack, { itemId: item.id });
    const render = () => activityRegistry.practice.render({ pack, state: store.state, draft });
    let html = render();
    assert.ok(!html.includes(e(item.text)));
    const selector = html.match(/<select id="item-select">([\s\S]*?)<\/select>/)[1];
    for (const option of selector.matchAll(/<option[^>]*>(.*?)<\/option>/g))
      assert.match(option[1], /^Unit \d+ · Item \d+$/);
    assert.ok(!html.includes("data-speak="));
    assert.ok(html.includes("Bacaan suara tidak tersedia"));
    assert.ok(html.includes("latihan visual"));
    store.updateDraft(draft.id, { text: "Percubaan saya", fields: { checkedText: "Percubaan saya", feedback: "not trusted JSON" } });
    html = render();
    assert.ok(html.includes("Semak transkripsi kamu"));
    assert.equal(draft.text, "Percubaan saya");
    store.practice(item.id, { revealed: true });
    assert.ok(render().includes(e(item.text)));
    assert.equal(draft.text, "Percubaan saya");
  }
});

test("deterministic transcription distinguishes spelling, capitals, punctuation and creative AI routing", async () => {
  assert.equal(compareTranscription("jalan raya", " jalan   raya ").correct, true);
  assert.equal(compareTranscription("Ali membaca.", "Ali membaca.").correct, true);
  assert.match(compareTranscription("Ali membaca.", "Ali membca.").errors.join(" "), /ejaan/);
  assert.ok(!compareTranscription("jalan raya", "jalanraya").errors.join(" ").includes("tanda baca"));
  assert.match(compareTranscription("Ali membaca.", "ali membaca.").errors.join(" "), /huruf besar/);
  assert.match(compareTranscription("Ali membaca.", "Ali membaca").errors.join(" "), /tanda baca/);
  assert.equal(compareTranscription("Ali, mari sini.", "Ali mari, sini.").correct, false);
  assert.equal(compareTranscription("Ali membaca.", "").correct, false);
  const raw = { action: "sentence_check", activity: "sentence", year: 4,
    itemId: "Y4-I-U01-I01", referenceText: "Ali membaca.", studentText: "Siti bermain.", title: "Ayat" };
  assert.match(buildTutorPrompt(raw), /bukan semakan transkripsi/);
  assert.notEqual(cacheIdentity(raw), cacheIdentity({ ...raw, itemId: "Y4-I-U01-I02" }));
  assert.notEqual(cacheIdentity(raw), cacheIdentity({ ...raw, referenceText: "Rujukan baharu." }));
  assert.throws(() => tutorRequest({ ...raw, activity: "practice" }));
  const service = createAIService({ fetcher: () => { throw new Error("No network expected"); } });
  const result = await service.request(raw, { mode: "prompt" });
  assert.ok(result.prompt.includes("Siti bermain."));
  assert.equal(raw.studentText, "Siti bermain.");
});

test("item drafts, originals, revision, progress and legacy drafts survive unit/year changes and reload", () => {
  const storage = memory(), store = createStore({ storage }), pack = getCurriculumPack(1);
  const a = pack.items[0], b = pack.items[10];
  const first = store.draft("expansion", "Ayat", pack, { itemId: a.id });
  store.updateDraft(first.id, { text: "Revisi saya.", original: "Ayat saya.", plan: { kata_adjektif: "yes" } });
  store.setUnit(2);
  const second = store.draft("expansion", "Ayat", pack, { itemId: b.id });
  store.updateDraft(second.id, { text: "Ayat lain." });
  store.practice(a.id, { attempts: 2, correct: true, revealed: true, independentCorrect: false });
  store.setYear(6);
  const restored = createStore({ storage });
  assert.equal(restored.state.practice[a.id].attempts, 2);
  restored.resume(first.id);
  assert.equal(restored.state.year, 1);
  assert.equal(restored.draft("expansion", "Ayat", pack, { itemId: a.id }).text, "Revisi saya.");
  assert.equal(restored.state.drafts[first.id].original, "Ayat saya.");
  assert.equal(restored.state.drafts[first.id].plan.kata_adjektif, "yes");
  assert.equal(restored.state.drafts[second.id].text, "Ayat lain.");
  const legacy = JSON.parse(storage.getItem(STORAGE_KEY));
  delete legacy.unit; delete legacy.practice; delete legacy.drafts[first.id].itemId;
  assert.equal(hydrate(legacy).drafts[first.id].text, "Revisi saya.");
  assert.equal(hydrate(legacy).drafts[first.id].itemId, "");
});

test("essay context strips workbook references and hidden scaffolds even with malicious extra input", () => {
  const raw = { action: "essay_next_step", activity: "essay", year: 6, title: "Tajuk A", studentText: "Tulisan saya.",
    itemId: "Y6-I-U01-I01", referenceText: "HIDDEN_REFERENCE", plan: "HIDDEN_PLAN", model: "HIDDEN_MODEL" };
  assert.deepEqual(Object.keys(tutorRequest(raw)), ["action", "activity", "year", "title", "studentText"]);
  assert.ok(!buildTutorPrompt(raw).includes("HIDDEN"));
  assert.notEqual(cacheIdentity(raw), cacheIdentity({ ...raw, title: "Tajuk B" }));
});

test("speech capability detects unavailable Malaysian voice without throwing or disclosing answers", () => {
  assert.deepEqual(createSpeechService({ environment: {} }).availability(), { supported: false, malayVoice: false });
  const environment = { SpeechSynthesisUtterance: class {}, speechSynthesis: { getVoices: () => [{ lang: "en-US" }] } };
  assert.deepEqual(createSpeechService({ environment }).availability(), { supported: true, malayVoice: false });
  environment.speechSynthesis.getVoices = () => [{ lang: "ms-MY" }];
  assert.equal(createSpeechService({ environment }).availability().malayVoice, true);
});
