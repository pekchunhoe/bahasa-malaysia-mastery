import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getCurriculumPack as loadCurriculumPack,
  registerCurriculum,
  resolveSuggestedVocabulary,
} from "../js/curriculum-service.js";
import { createStore } from "../js/state.js";
import {
  freshState,
  hydrate,
  loadState,
  saveState,
  STORAGE_KEY,
} from "../js/storage.js";
import { adaptVocabularyRows } from "../data/adapters/excel.js";
import { normalizeVocabulary } from "../data/schema/models.js";
import {
  sentencePreview,
  writingCounts,
  draftText,
  exportDraft,
} from "../js/learning-service.js";
const getCurriculumPack = (year, id = "demo") => loadCurriculumPack(year, id);
const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
};
const setup = () => {
  const storage = memory();
  let id = 0;
  return {
    storage,
    store: createStore({
      storage,
      makeId: () => `draft-${++id}`,
      now: () => "2026-09-27T08:00:00Z",
    }),
  };
};
test("all six years load small demo packs with distinct scaffolding and expectations", () => {
  const packs = [1, 2, 3, 4, 5, 6].map((year) => getCurriculumPack(year));
  assert.equal(new Set(packs.map((p) => p.difficultyProfile.focus)).size, 6);
  assert.equal(
    new Set(packs.map((p) => p.difficultyProfile.expectation)).size,
    6,
  );
  for (const pack of packs) {
    assert.equal(pack.language, "ms-MY");
    assert.equal(pack.demo, true);
    assert.ok(pack.vocabulary.length <= 9);
    assert.equal(pack.writingTopics.length, 2);
    assert.ok(
      pack.vocabulary.every(
        (w) => w.yearMin <= pack.year && w.yearMax >= pack.year,
      ),
    );
  }
  assert.equal(packs[0].difficultyProfile.fields, 2);
  assert.equal(packs[1].difficultyProfile.fields, 4);
  assert.ok(packs[5].vocabulary.length > packs[0].vocabulary.length);
  packs[0].activitySets.sentence.title = "modified";
  assert.notEqual(getCurriculumPack(1).activitySets.sentence.title, "modified");
  assert.throws(() => getCurriculumPack(0));
  assert.throws(() => getCurriculumPack(1, "missing"));
});
test("year selection persists and does not delete other-year writing", () => {
  const { store, storage } = setup(),
    first = store.draft("sentence", "Ayat", getCurriculumPack(1));
  store.updateDraft(first.id, { text: "Saya bermain." });
  store.setYear(6);
  const second = store.draft("sentence", "Ayat", getCurriculumPack(6));
  assert.notEqual(first.id, second.id);
  store.updateDraft(second.id, { text: "Saya sewajarnya membantu rakan." });
  const restored = createStore({ storage });
  assert.equal(restored.state.year, 6);
  assert.equal(restored.state.drafts[first.id].text, "Saya bermain.");
  restored.setYear(1);
  assert.equal(
    restored.draft("sentence", "Ayat", getCurriculumPack(1)).id,
    first.id,
  );
  assert.throws(() => store.setYear("2"));
  assert.throws(() => store.setYear(7));
});
test("BM namespace cannot collide with Mandarin data", () => {
  const storage = memory();
  storage.setItem("huawen-lab-v1", '{"year":6}');
  assert.equal(loadState(storage).year, 1);
  assert.ok(STORAGE_KEY.startsWith("bmMastery:"));
  saveState(freshState(), storage);
  assert.equal(storage.getItem("huawen-lab-v1"), '{"year":6}');
});
test("navigation preserves independent draft text, plan, stage, scaffold and selection", () => {
  const { store, storage } = setup(),
    pack = getCurriculumPack(1);
  const essay = store.draft("essay", "Petang Bersama Rakan", pack);
  store.selectTitle(essay.title);
  store.selectVocabulary("demo-rakan");
  store.updateDraft(essay.id, {
    text: "Saya bersama rakan.",
    plan: { p0: "Bermain" },
    stage: 3,
  });
  store.navigate("paragraph");
  const paragraph = store.draft("paragraph", "Rakan", pack);
  store.updateDraft(paragraph.id, { text: "Rakan saya baik." });
  store.navigate("vocabulary");
  store.navigate("essay");
  const restored = createStore({ storage });
  assert.equal(restored.state.drafts[essay.id].text, "Saya bersama rakan.");
  assert.equal(restored.state.drafts[essay.id].stage, 3);
  assert.equal(restored.state.drafts[essay.id].plan.p0, "Bermain");
  assert.equal(restored.state.drafts[paragraph.id].text, "Rakan saya baik.");
  assert.deepEqual(restored.state.selectedVocabulary, ["demo-rakan"]);
});
test("essay title change creates a separate draft; switching back resumes original", () => {
  const { store } = setup(),
    pack = getCurriculumPack(1);
  const first = store.draft("essay", "Title A", pack);
  store.updateDraft(first.id, { text: "Tulisan A." });
  const second = store.draft("essay", "Title B", pack);
  store.updateDraft(second.id, { text: "Tulisan B." });
  assert.equal(store.draft("essay", "Title A", pack).text, "Tulisan A.");
  assert.notEqual(first.id, second.id);
  store.resume(second.id);
  assert.equal(store.state.selectedEssayTitle[1], "Title B");
});
test("expansion preserves the original even when later changes attempt to replace it", () => {
  const { store } = setup(),
    draft = store.draft("expansion", "Ayat", getCurriculumPack(1));
  store.updateDraft(draft.id, {
    original: "Ali bermain.",
    text: "Ali bermain di taman.",
  });
  store.updateDraft(draft.id, {
    original: "Overwrite",
    text: "Ali bermain bola di taman.",
  });
  assert.equal(draft.original, "Ali bermain.");
  assert.equal(draft.text, "Ali bermain bola di taman.");
});
test("draft resume restores year/activity and deletion persists", () => {
  const { store, storage } = setup();
  const draft = store.draft("sentence", "Ayat", getCurriculumPack(1));
  store.updateDraft(draft.id, { text: "Ayat saya." });
  store.setYear(5);
  store.resume(draft.id);
  assert.equal(store.state.year, 1);
  assert.equal(store.state.activity, "sentence");
  store.deleteDraft(draft.id);
  assert.equal(createStore({ storage }).state.drafts[draft.id], undefined);
  assert.equal(store.resume("missing"), false);
});
test("storage denial and corrupted data fail gracefully without interrupting writing", () => {
  const denied = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  const store = createStore({ storage: denied, makeId: () => "draft-1" });
  const draft = store.draft("sentence", "Ayat", getCurriculumPack(1));
  store.updateDraft(draft.id, { text: "Masih boleh menulis." });
  assert.equal(store.persistent, false);
  assert.equal(store.state.drafts[draft.id].text, "Masih boleh menulis.");
  const storage = memory();
  storage.setItem(STORAGE_KEY, "{bad");
  assert.deepEqual(loadState(storage), freshState());
  assert.equal(
    hydrate({ version: 1, year: 100, drafts: { broken: { text: 4 } } }).year,
    1,
  );
  assert.deepEqual(hydrate({ version: 9 }), freshState());
});
test("Excel adapter accepts workbook-specific mappings without prescribed columns", () => {
  const records = adaptVocabularyRows(
    [{ istilahAsal: "rakan", darjah: 2 }],
    (row) => ({
      id: "workbook-1",
      word: row.istilahAsal,
      year: row.darjah,
      category: "Kata nama",
      meaning: "Sahabat",
      example: "Rakan saya baik.",
      theme: "Persahabatan",
      source: { kind: "workbook", reference: "sheet:row2" },
    }),
  );
  assert.equal(records[0].word, "rakan");
  assert.equal(records[0].yearMin, 2);
  assert.equal(records[0].yearMax, 2);
  assert.throws(() => adaptVocabularyRows([], null));
  assert.throws(() => normalizeVocabulary([records[0], records[0]]));
});
test("future curriculum identifiers can register normalized packs", () => {
  const pack = getCurriculumPack(1);
  registerCurriculum("future-fixture", {
    version: "test-only",
    demo: false,
    reference: "fixture",
    vocabulary: pack.vocabulary,
    activitySets: pack.activitySets,
    writingTopics: pack.writingTopics,
  });
  const future = getCurriculumPack(1, "future-fixture");
  assert.equal(future.curriculumId, "future-fixture");
  assert.equal(future.version, "test-only");
  assert.equal(future.demo, false);
});
test("AI vocabulary is never silently made authoritative", () => {
  const pack = getCurriculumPack(1),
    length = pack.vocabulary.length;
  assert.equal(resolveSuggestedVocabulary("rakan", pack).source, "curated");
  assert.equal(resolveSuggestedVocabulary("rekaan", pack).authoritative, false);
  assert.equal(pack.vocabulary.length, length);
});
test("BM sentence and word counting handles hyphenation, apostrophes and punctuation", () => {
  assert.deepEqual(writingCounts("Rakan-rakan Ali bermain. Kami gembira!"), {
    words: 5,
    sentences: 2,
  });
  assert.equal(
    sentencePreview({ who: "ali", action: "bermain", when: "" }),
    "Ali bermain.",
  );
  assert.equal(
    sentencePreview({ who: "Rumah itu", how: "cantik" }),
    "Rumah itu cantik.",
  );
  assert.equal(writingCounts("").words, 0);
});
test("story continuations and draft export preserve the pupil writing", () => {
  const { store, storage } = setup(),
    draft = store.draft("story", "Cerita", getCurriculumPack(1));
  store.updateDraft(draft.id, {
    lines: ["Saya membuka buku."],
    text: "Saya melihat nama Ali.",
  });
  assert.equal(
    draftText(draft),
    "Saya membuka buku.\n\nSaya melihat nama Ali.",
  );
  assert.ok(exportDraft(draft).includes("Saya membuka buku."));
  assert.deepEqual(
    createStore({ storage }).state.drafts[draft.id].lines,
    draft.lines,
  );
});
