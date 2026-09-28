import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateMaster } from '../tools/validate-master.mjs';
import { master } from '../data/generated/master.js';
import { getCurriculumPack } from '../js/curriculum-service.js';
import { activityRegistry } from '../activities/registry.js';
import { suggestedVocabulary } from '../components/vocabulary-support.js';
import { vocabularyCards } from '../activities/vocabulary.js';
import { createStore } from '../js/state.js';
import { e } from '../components/ui.js';

const json = JSON.parse(readFileSync(new URL('../data/bm_content_2026_app_ready.json', import.meta.url)));
const extraction = spawnSync(process.env.PYTHON || 'python', ['tools/read-workbook.py', 'data/BM_MASTER_EJAAN_IMLAK_2026_MUKTAMAD.xlsx'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
assert.equal(extraction.status, 0, extraction.stderr);
const excel = JSON.parse(extraction.stdout);
const context = year => {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const store = createStore({ storage }); store.setYear(year);
  return { store, storage, pack: getCurriculumPack(year) };
};

test('full workbook/JSON audit agrees on every ID, metadata, vocabulary field, status and approval', () => {
  const report = validateMaster(excel, json);
  assert.deepEqual(report.errors, []);
  assert.equal(report.ok, true);
  assert.deepEqual([report.total, report.ejaan, report.imlak, report.uniqueIds, report.multiwordEjaan, report.repeatedTextOccurrences], [1080, 720, 360, 1080, 81, 90]);
  const reversed = structuredClone(excel);
  reversed.tables.ENRICHMENT.rows.reverse(); reversed.tables.VOCAB_FOCUS.rows.reverse();
  assert.equal(validateMaster(reversed, { ...json, items: [...json.items].reverse() }).ok, true);
});

test('audit detects mismatches, missing/duplicate IDs, incorrect approval and invented reserved fields', () => {
  const cases = [
    j => j.items.pop(),
    j => { j.items[1].item_id = j.items[0].item_id; },
    j => { j.items[0].teks_app = 'changed'; },
    j => { j.items[0].unit_no = 2; },
    j => { j.items[0].tahun = 2; },
    j => { j.items[0].status_semakan = 'Draf'; },
    j => { j.items[720].vocabulary.kata_frasa = 'changed'; },
    j => { j.items[720].vocabulary.contoh_ayat = 'changed'; },
    j => { j.items[0].vocabulary.pengesahan = 'individual_teacher'; },
    j => { j.items[0].vocabulary.content_source = 'teacher_authored'; },
    j => { j.items[0].vocabulary.ayat_diperkaya = 'invented'; },
    j => { j.items[0].vocabulary.kesalahan_lazim = 'invented'; },
  ];
  for (const mutate of cases) { const changed = structuredClone(json); mutate(changed); assert.equal(validateMaster(excel, changed).ok, false); }
  const missing = structuredClone(excel); missing.tables.ENRICHMENT.rows[0].source_item_id = 'orphan';
  assert.equal(validateMaster(missing, json).ok, false);
});

test('one runtime master preserves exact practice text and binds all approved supplements by source ID', () => {
  for (const raw of json.items) {
    const item = master.items.find(i => i.id === raw.item_id), support = master.enrichment[raw.item_id];
    assert.equal(item.text, raw.teks_app);
    assert.equal(item.status_semakan, 'Disahkan');
    assert.equal(support.source_item_id, item.id);
    assert.equal(support.word, raw.vocabulary.kata_frasa);
    assert.equal(support.example_sentence, raw.vocabulary.contoh_ayat);
    assert.equal(support.content_source, 'ai_generated');
    assert.equal(support.status, 'diluluskan');
    assert.equal(support.pengesahan, 'pukal_oleh_pengguna');
    assert.equal(support.reviewed_by, undefined);
    assert.equal(support.ayat_diperkaya, undefined);
    assert.equal(support.kesalahan_lazim, undefined);
  }
});

test('all six year banks and writing suggestions filter every unit and supplied theme without losing IDs', () => {
  for (let year = 1; year <= 6; year++) {
    const { pack, store } = context(year);
    assert.equal(pack.vocabulary.length, year <= 3 ? 240 : 120);
    for (let unit = 1; unit <= 24; unit++) {
      store.setUnit(unit);
      const expected = pack.items.filter(i => i.unitNo === unit).map(i => i.id);
      assert.deepEqual(suggestedVocabulary(pack, store.state).map(w => w.id), expected);
      const html = vocabularyCards(pack, store.state);
      const shown = [...html.matchAll(/data-select-word="([^"]+)"/g)].map(match => match[1]);
      assert.deepEqual(shown, expected);
      assert.ok(!html.includes('data-word-ai='));
      assert.ok(!html.includes('data-word-example='));
      for (const id of expected) {
        const support = pack.enrichment[id];
        for (const value of [support.word, support.meaning, support.grammatical_category, support.example_sentence]) assert.ok(html.includes(e(value)));
      }
    }
    store.setUnit('all');
    for (const theme of pack.themes) {
      store.setTheme(theme);
      assert.ok(suggestedVocabulary(pack, store.state).every(w => w.theme === theme));
      const html = vocabularyCards(pack, store.state);
      assert.equal([...html.matchAll(/data-select-word=/g)].length, pack.items.filter(i => i.theme === theme).length);
    }
  }
});

test('sentence/expansion examples require explicit disclosure and cannot replace originals or revisions', () => {
  for (const year of [1, 2, 3, 4, 5, 6]) {
    const { pack, store, storage } = context(year), item = pack.items[0], support = pack.enrichment[item.id];
    for (const activity of ['sentence', 'expansion']) {
      const draft = store.draft(activity, 'Ayat', pack, { itemId: item.id });
      let html = activityRegistry[activity].render({ pack, state: store.state, draft });
      assert.match(html, /<details data-master-example><summary>Lihat contoh ayat<\/summary>/);
      assert.ok(!/<details[^>]*\bopen\b/.test(html));
      assert.ok(html.includes(e(support.example_sentence)));
      assert.equal(draft.text, '');
      if (year >= 4) assert.ok(!html.includes(e(item.text)), 'creative stimulus is focus vocabulary, not dictation');
      store.updateDraft(draft.id, { original: 'Ayat asal saya.', text: 'Ayat saya yang dikembangkan.', fields: { originalDraft: 'Catatan saya.' } });
      store.updateDraft(draft.id, { original: support.example_sentence });
      const restored = createStore({ storage }); restored.resume(draft.id);
      const saved = restored.state.drafts[draft.id];
      assert.equal(saved.original, 'Ayat asal saya.');
      assert.equal(saved.text, 'Ayat saya yang dikembangkan.');
      assert.equal(saved.fields.originalDraft, 'Catatan saya.');
      html = activityRegistry[activity].render({ pack, state: restored.state, draft: saved });
      assert.match(html, /Ayat saya yang dikembangkan\.<\/textarea>/);
      assert.ok(!html.includes('ayat_diperkaya'));
      assert.ok(!html.includes('kesalahan_lazim'));
    }
  }
});

test('practice hides focus and examples until checked, keeps optional spelling help and resets disclosure', () => {
  for (let year = 1; year <= 6; year++) {
    const { pack, store } = context(year), item = pack.items[0], support = pack.enrichment[item.id];
    let draft = store.draft('practice', 'Latihan', pack, { itemId: item.id });
    const render = () => activityRegistry.practice.render({ pack, state: store.state, draft });
    assert.ok(!render().includes(e(support.example_sentence)));
    if (year <= 3) assert.ok(render().includes(e(support.spelling_focus)));
    else assert.ok(!render().includes(e(support.word)));
    store.updateDraft(draft.id, { text: 'Percubaan belum disemak.' });
    if (year >= 4) assert.ok(!render().includes(e(support.word)));
    store.updateDraft(draft.id, { fields: { checkedText: draft.text, feedback: '{}' } });
    if (year >= 4) assert.ok(render().includes(e(support.word)));
    assert.equal(draft.text, 'Percubaan belum disemak.');
    store.updateDraft(draft.id, { text: 'Percubaan berubah.' });
    if (year >= 4) assert.ok(!render().includes(e(support.word)));
    draft = store.draft('practice', 'Latihan', pack, { itemId: item.id, fresh: true });
    assert.ok(!render().includes(e(support.example_sentence)));
    store.practice(item.id, { revealed: true });
    assert.ok(render().includes(e(item.text)));
    assert.equal(draft.text, '');
  }
});

test('paragraph, essay and story suggestions never initialize or mutate pupil drafts and survive reload', () => {
  const { pack, store, storage } = context(6); store.setUnit(4);
  for (const activity of ['paragraph', 'essay', 'story']) {
    const draft = store.draft(activity, 'Tulisan saya', pack);
    store.updateDraft(draft.id, { text: 'Tulisan saya sendiri.', plan: { p0: 'Idea saya.' }, lines: ['Sambungan saya.'], stage: 2 });
    const before = JSON.stringify(draft);
    const html = activityRegistry[activity].render({ pack, state: store.state, draft });
    assert.match(html, /Kosa kata untuk idea kamu/);
    assert.equal(JSON.stringify(draft), before);
    for (const i of pack.items) assert.ok(!html.includes(e(i.text)));
    assert.deepEqual(createStore({ storage }).state.drafts[draft.id], draft);
  }
});
