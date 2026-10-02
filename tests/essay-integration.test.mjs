import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { essays } from '../data/generated/essays.js';
import { adaptEssayRows, countEssayWords } from '../data/adapters/essays.js';
import { essayTopicById, essayTopicsForYear, filterEssays, isNarrative, readEssayCatalog, selectedWritingTopic } from '../js/essay-service.js';
import { getCurriculumPack } from '../js/curriculum-service.js';
import { createStore } from '../js/state.js';
import { hydrate, STORAGE_KEY } from '../js/storage.js';
import { writingGuidance } from '../js/writing-guidance.js';
import { exportDraft, hasWriting } from '../js/learning-service.js';
import { activityRegistry } from '../activities/registry.js';
import { essayExample, topicPicker, topicResults } from '../components/essay-catalog.js';
import { e } from '../components/ui.js';

const sourcePath = 'data/BM_MASTER_KARANGAN_1000_TAHAP_KERJA.xlsx';
const extracted = spawnSync(process.env.PYTHON || 'python', ['tools/read-workbook.py', sourcePath, 'MASTER_KARANGAN'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
assert.equal(extracted.status, 0, extracted.stderr);
const source = JSON.parse(extracted.stdout);
const expectedCounts = [100, 140, 160, 180, 220, 200];
function setup(year = 1) {
  const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const store = createStore({ storage }); store.setYear(year);
  return { store, storage, pack: getCurriculumPack(year) };
}

test('Excel produces exactly 1000 unique complete IDs, titles and matching examples with exact metadata', () => {
  const result = adaptEssayRows(source.rows, source.headers);
  assert.equal(result.items.length, 1000);
  assert.deepEqual(result.excluded, []);
  assert.deepEqual(Object.values(result.counts), expectedCounts);
  assert.deepEqual(result.items, essays.items);
  for (const field of ['id', 'title', 'model_text']) assert.equal(new Set(essays.items.map(i => i[field])).size, 1000);
  for (const row of source.rows) {
    const item = essays.items.find(i => i.id === row.id_tajuk);
    assert.equal(item.title, row.tajuk_karangan);
    assert.equal(item.year, Number(row.tahun));
    assert.equal(item.category, row.tema);
    assert.equal(item.writing_type, row.jenis_karangan);
    assert.equal(item.model_text, row.karangan_contoh);
    assert.equal(item.word_count, Number(row.bilangan_perkataan));
    assert.equal(item.word_count, countEssayWords(item.model_text));
    assert.ok(item.word_count >= 120 && item.word_count <= 300);
    assert.equal(item.status, 'MUKTAMAD'); assert.equal(item.example_status, 'SIAP');
  }
  const audit = JSON.parse(readFileSync('audit/essays.json', 'utf8'));
  assert.equal(audit.sha256, createHash('sha256').update(readFileSync(sourcePath)).digest('hex'));
  assert.equal(audit.imported, 1000); assert.deepEqual(audit.excluded, []);
});

test('import reports incomplete/unready rows and rejects duplicate identities, headers, bad years and counts', () => {
  const row = source.rows[0];
  for (const changes of [{ karangan_contoh: '' }, { status: 'DRAF' }, { status_karangan: 'BELUM' }, { tajuk_karangan: '' }]) {
    const result = adaptEssayRows([{ ...row, ...changes }]);
    assert.equal(result.items.length, 0); assert.equal(result.excluded.length, 1); assert.equal(result.excluded[0].row, 2);
  }
  for (const changes of [{ tahun: 7 }, { id_tajuk: '<invalid>' }, { bilangan_perkataan: 300 }, { karangan_contoh: 'Pendek.', bilangan_perkataan: 1 }])
    assert.throws(() => adaptEssayRows([{ ...row, ...changes }]));
  assert.throws(() => adaptEssayRows([row, row]));
  assert.throws(() => adaptEssayRows([row, { ...row, id_tajuk: 'other' }]));
  assert.throws(() => adaptEssayRows([row], ['id_tajuk']));
});

test('reordering, corrections and added Excel rows preserve stable mappings without activity changes', () => {
  const sorted = records => records.toSorted((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(sorted(adaptEssayRows([...source.rows].reverse()).items), sorted(essays.items));
  const correction = { ...source.rows[0], tajuk_karangan: 'Tajuk dibetulkan', karangan_contoh: source.rows[0].karangan_contoh.replace('Ahad', 'Sabtu') };
  const added = { ...correction, id_tajuk: 'BM-KAR-T1-0101', tajuk_karangan: 'Tajuk baharu', karangan_contoh: correction.karangan_contoh.replace('Sabtu', 'Jumaat') };
  const updated = adaptEssayRows([correction, ...source.rows.slice(1), added]);
  assert.equal(updated.items.length, 1001);
  assert.equal(updated.items[0].id, essays.items[0].id);
  assert.equal(updated.items[0].title, 'Tajuk dibetulkan');
  assert.equal(updated.items.at(-1).model_text, added.karangan_contoh);
});

test('every year/category/type combination and title search returns only matching stable IDs', () => {
  for (let year = 1; year <= 6; year++) {
    const { pack, store } = setup(year);
    assert.equal(pack.essayCatalog.count, expectedCounts[year - 1]);
    assert.equal(pack.essayTopics.length, expectedCounts[year - 1]);
    assert.equal(pack.paragraphTopics.length, expectedCounts[year - 1]);
    assert.deepEqual(pack.storyStarters.filter(t => t.source_type === 'essay_master').map(t => t.id), pack.essayTopics.filter(isNarrative).map(t => t.id));
    for (const category of new Set(pack.essayTopics.map(t => t.category)))
      for (const type of new Set(pack.essayTopics.map(t => t.writing_type))) {
        const expected = pack.essayTopics.filter(t => t.category === category && t.writing_type === type);
        assert.deepEqual(filterEssays(essays.items, { year, category, type }).map(t => t.id), expected.map(t => t.id));
      }
    for (const topic of pack.essayTopics) assert.ok(filterEssays(pack.essayTopics, { query: topic.title.toLocaleUpperCase('ms') }).some(t => t.id === topic.id));
    const topic = pack.essayTopics[0], draft = store.draft('essay', topic.title, pack, { contentId: topic.id });
    store.setWritingFilter('essay', 'query', 'no-such-topic-000');
    assert.match(topicResults(pack, store.state, draft), /Tiada tajuk sepadan/);
    assert.equal(draft.contentId, topic.id); assert.equal(draft.text, '');
  }
});

test('Semua Tahun exposes the unmodified master catalog and composes with existing filters', () => {
  const { pack, store } = setup(1);
  const firstByYear = [1, 2, 3, 4, 5, 6].map(year => essayTopicsForYear(year)[0]);
  const all = essayTopicsForYear('all');
  assert.equal(all.length, essays.items.length);
  assert.deepEqual(new Set(all.map(topic => topic.year)), new Set([1, 2, 3, 4, 5, 6]));
  assert.deepEqual(filterEssays(all, { year: 'all' }).map(topic => topic.id), essays.items.map(topic => topic.id));
  assert.deepEqual(filterEssays(all, { year: 1 }).map(topic => topic.id), essayTopicsForYear(1).map(topic => topic.id));
  assert.deepEqual(filterEssays(all, { year: 6 }).map(topic => topic.id), essayTopicsForYear(6).map(topic => topic.id));
  const target = firstByYear[4];
  assert.deepEqual(filterEssays(all, { year: 'all', query: target.title }).map(topic => topic.id), [target.id]);
  assert.ok(filterEssays(all, { year: 'all', category: target.category, type: target.writing_type }).some(topic => topic.id === target.id));

  const draft = store.draft('essay', pack.essayTopics[0].title, pack, { contentId: pack.essayTopics[0].id });
  store.setWritingFilter('essay', 'year', 'all');
  const picker = topicPicker(pack, store.state, draft);
  assert.match(picker, /Semua Tahun/);
  assert.doesNotMatch(picker, /data-writing-filter="year"/);
  assert.equal((picker.match(/<select/g) || []).length, 3);
  assert.match(topicResults(pack, store.state, draft), new RegExp(`${essays.items.length} daripada ${essays.items.length}`));

  const selected = essayTopicById(target.id);
  assert.equal(selected.year, 5);
  assert.equal(selectedWritingTopic(pack, { activity: 'essay', contentId: target.id, title: target.title }).id, target.id);
  assert.equal(selectedWritingTopic(pack, { activity: 'essay', contentId: target.id, title: target.title }).model_text, target.model_text);
});

test('all master examples require deliberate disclosure, preserve line breaks and never populate editors', () => {
  for (const topic of essays.items) {
    const html = essayExample(topic);
    assert.match(html, /<details[^>]*data-essay-example><summary>Lihat contoh karangan<\/summary>/);
    assert.ok(!/<details[^>]*\bopen\b/.test(html));
    assert.ok(html.includes(e(topic.model_text)));
    assert.match(html, /data-hide-example/);
    assert.match(html, new RegExp(`data-read-example="${topic.id}"`));
    assert.match(html, /aria-label="Dengar tulisan contoh karangan:/);
    assert.match(html, /data-speech-rate/);
    assert.ok(html.includes(e(topic.title)));
  }
  for (const activity of ['essay', 'paragraph', 'story']) for (const year of [1, 6]) {
    const { pack, store } = setup(year), topic = pack.essayTopics[0];
    const draft = store.draft(activity, topic.title, pack, { contentId: topic.id });
    const before = JSON.stringify(draft);
    const html = activityRegistry[activity].render({ pack, state: store.state, draft });
    assert.equal(JSON.stringify(draft), before);
    assert.match(html, /id="student-text"[^>]*><\/textarea>/);
    assert.equal((html.match(/id="writing-topic-select"/g) || []).length, 1);
    assert.ok(!html.includes('undefined'));
  }
  const hostile = { ...essays.items[0], title: '<img src=x>', model_text: '<script>bad</script>\n\nBaris kedua.' };
  assert.ok(!essayExample(hostile).includes('<script>'));
  assert.ok(essayExample(hostile).includes('&lt;script&gt;bad&lt;/script&gt;\n\nBaris kedua.'));
});

test('guidance covers every supplied genre, changes by year and preserves source letter/dialog formatting', () => {
  for (const type of new Set(essays.items.map(t => t.writing_type))) {
    const topic = essays.items.find(t => t.writing_type === type), guide = writingGuidance(topic, topic.year);
    assert.ok(guide.questions.length >= 3 && guide.format.length >= 3);
    assert.notEqual(guide.purpose, writingGuidance({ writing_type: 'unknown' }, 6).purpose);
  }
  assert.match(writingGuidance(essays.items[0], 1).level, /bukan sasaran wajib/);
  assert.notEqual(writingGuidance(essays.items[0], 1).rows, writingGuidance(essays.items[0], 6).rows);
  const letter = essays.items.find(t => t.writing_type === 'Surat rasmi');
  assert.match(writingGuidance(letter, 6).format.join(' '), /Alamat.*tarikh/);
  assert.ok(essayExample(letter).includes(e(letter.model_text)));
  const dialog = essays.items.find(t => t.writing_type === 'Dialog');
  assert.match(writingGuidance(dialog, 3).format.join(' '), /baris baharu/);
  const speech = essays.items.find(t => t.title.startsWith('Syarahan'));
  const address = essays.items.find(t => t.title.startsWith('Ucapan'));
  assert.notDeepEqual(writingGuidance(speech, 6).questions, writingGuidance(address, 6).questions);
});

test('draft identity, original/revised versions, plans and filters survive reload without touching old drafts', () => {
  const { pack, store, storage } = setup(6), a = pack.essayTopics[0], b = pack.essayTopics[1];
  for (const activity of ['essay', 'paragraph', 'story']) {
    const old = store.draft(activity, 'Draf lama yang tiada dalam master', pack);
    store.updateDraft(old.id, { text: 'Tulisan lama.', original: 'Asal lama.', plan: { p0: 'Isi lama.' }, lines: ['Baris lama.'], stage: 4 });
    const first = store.draft(activity, a.title, pack, { contentId: a.id });
    store.updateDraft(first.id, { text: 'Versi asal murid.' });
    assert.equal(store.snapshotDraft(first.id), true);
    store.updateDraft(first.id, { text: 'Versi diperbaiki murid.' });
    const second = store.draft(activity, b.title, pack, { contentId: b.id });
    assert.notEqual(second.id, first.id);
    store.setWritingFilter(activity, 'type', a.writing_type);
    const loaded = createStore({ storage }); loaded.resume(first.id);
    assert.equal(loaded.draft(activity, a.title, pack, { contentId: a.id }).id, first.id);
    assert.equal(loaded.state.drafts[first.id].revisions[0].text, 'Versi asal murid.');
    assert.equal(loaded.state.drafts[first.id].text, 'Versi diperbaiki murid.');
    assert.equal(loaded.state.drafts[old.id].original, 'Asal lama.');
    assert.equal(loaded.state.drafts[old.id].text, 'Tulisan lama.');
    assert.equal(loaded.state.writingFilters[`6:${activity}`].type, a.writing_type);
    assert.ok(exportDraft(loaded.state.drafts[first.id]).includes('Versi asal murid.'));
    loaded.updateDraft(first.id, { text: '' }); assert.equal(hasWriting(loaded.state.drafts[first.id]), true);
    assert.equal(selectedWritingTopic(pack, first).id, a.id);
  }
  const raw = JSON.parse(storage.getItem(STORAGE_KEY));
  delete raw.writingFilters;
  for (const d of Object.values(raw.drafts)) delete d.revisions;
  const hydrated = hydrate(raw);
  assert.equal(Object.keys(hydrated.drafts).length, Object.keys(raw.drafts).length);
  assert.deepEqual(hydrated.writingFilters, {});
  assert.ok(Object.values(hydrated.drafts).every(d => Array.isArray(d.revisions)));
});

test('missing, malformed and empty catalogs show usable error/empty states and preserve saved editors', async () => {
  for (const loader of [async () => { throw Error('offline'); }, async () => ({ essays: { version: 'bad', items: [{}] } }),
    async () => ({ essays: { version: 'bad-origin', items: [{ ...essays.items[0], source_type: 'teacher_authored' }] } })]) {
    const failed = await readEssayCatalog(loader);
    assert.equal(failed.status, 'error');
    const { pack, store } = setup(); pack.essayCatalog = failed;
    const draft = store.draft('paragraph', 'Draf lama', pack); store.updateDraft(draft.id, { text: 'Jangan hilangkan saya.' });
    assert.match(topicPicker(pack, store.state, draft), /role="alert"/);
    const html = activityRegistry.paragraph.render({ pack, state: store.state, draft });
    assert.match(html, /Jangan hilangkan saya\.<\/textarea>/);
    assert.equal(draft.text, 'Jangan hilangkan saya.');
  }
  const empty = await readEssayCatalog(async () => ({ essays: { version: 'empty', items: [] } }));
  assert.equal(empty.status, 'ready');
  const { pack, store } = setup(); pack.essayCatalog = { ...empty, count: 0 }; pack.paragraphTopics = [];
  const draft = store.draft('paragraph', 'Perenggan saya', pack);
  assert.match(topicPicker(pack, store.state, draft), /Tiada tajuk sepadan/);
});
