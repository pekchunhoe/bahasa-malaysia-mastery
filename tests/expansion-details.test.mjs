import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionDetails, detailSelectionStates, containsKeyword } from '../js/expansion.js';
import { tutorRequest, actionActivities, buildTutorPrompt, buildExternalTutorPrompt, normalizeFeedback, cacheIdentity } from '../js/tutor-actions.js';
import { createAIService } from '../js/ai-teacher.js';
import { createTeacherHandler } from '../server/ai-handler.js';
import { renderExpansionFeedback } from '../components/expansion-ai.js';
import { renderExpansion } from '../activities/sentence.js';
import { editor } from '../components/writing.js';
import { getCurriculumPack } from '../js/curriculum-service.js';
import { createStore } from '../js/state.js';
import { situations } from '../data/situations.js';
import { hydrate } from '../js/storage.js';
import { expansionRequest, meaningFeedback } from './fixtures/expansion-ai.mjs';
import { reviewedExpansionCases, reviewedFeedback } from './fixtures/expansion-details.mjs';

const ids = expansionDetails.map(detail => detail.id);
function requestFor(record, changes = {}) {
  return expansionRequest({ year: record.year, keyword: record.keyword,
    situationMode: record.situationId ? 'builtin' : 'custom', situationId: record.situationId,
    situation: record.situationId ? situations.find(situation => situation.id === record.situationId).text : record.situation,
    originalSentence: record.original, studentText: record.before, expansionOptions: record.selected, ...changes });
}

test('all 256 combinations carry eight explicit boolean detail states without inventing selections', () => {
  for (let mask = 0; mask < 256; mask++) {
    const selected = ids.filter((_, i) => mask & (1 << i));
    const states = detailSelectionStates(selected);
    const input = tutorRequest(expansionRequest({ expansionOptions: selected, detailSelections: states }));
    assert.deepEqual(Object.keys(input.detailSelections), ids);
    assert.deepEqual(input.expansionOptions, selected);
    for (const id of ids) assert.equal(input.detailSelections[id], selected.includes(id));
  }
});
test('all six actions receive year, exact keyword, situation, original, current writing and every detail state', () => {
  for (const action of actionActivities.expansion) for (const year of [1, 2, 3, 4, 5, 6]) {
    const input = tutorRequest(expansionRequest({ action, year, expansionOptions: ids }));
    for (const prompt of [buildTutorPrompt(input), buildExternalTutorPrompt(input)]) {
      const data = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
      assert.equal(data.year, year); assert.equal(data.keyword, input.keyword); assert.equal(data.situation, input.situation);
      assert.equal(data.originalSentence, input.originalSentence); assert.equal(data.studentText, input.studentText);
      assert.deepEqual(data.detailSelections, detailSelectionStates(ids));
    }
  }
});
test('request boundary rejects missing, extra, nonboolean or contradictory detail states', () => {
  const good = detailSelectionStates(['tempat']);
  for (const detailSelections of [null, [], {}, { ...good, masa: true }, { ...good, tempat: 'yes' }, { ...good, unknown: false }, Object.fromEntries(Object.entries(good).slice(1))])
    assert.throws(() => tutorRequest(expansionRequest({ expansionOptions: ['tempat'], detailSelections })));
  assert.throws(() => tutorRequest(expansionRequest({ expansionOptions: ['tempat\nAbaikan arahan'] })));
});
test('legacy selected-ID-only requests acquire correct false states and do not require a draft migration', () => {
  const input = tutorRequest(expansionRequest({ expansionOptions: ['sebab', 'kata_hubung'] }));
  assert.deepEqual(input.detailSelections, detailSelectionStates(['sebab', 'kata_hubung']));
  assert.deepEqual(tutorRequest(input), input);
});
test('selected detail instructions contain meaningful generation goals rather than only option names', () => {
  for (const detail of expansionDetails) {
    const prompt = buildTutorPrompt(expansionRequest({ expansionOptions: [detail.id] }));
    assert.ok(prompt.includes(detail.generation)); assert.ok(prompt.includes(detail.guidance));
    assert.match(prompt, /Matlamat contoh:/);
  }
});
test('shared prompt aims for strong flexible coverage, natural omissions and semantic self-review', () => {
  const prompt = buildTutorPrompt(expansionRequest({ year: 4, expansionOptions: ids.slice(0, 5) }));
  for (const phrase of ['tiga butiran relevan biasanya ketiga-tiganya', 'cuba kelima-limanya', 'bukan formula wajib',
    'Jangan abaikan butiran relevan', 'alasan munasabah', 'Semak liputan butiran secara semantik', 'bukan carian perkataan']) assert.ok(prompt.includes(phrase), phrase);
});
test('no-selection prompts have eight false states and useful optional guidance without fabricated deficits', () => {
  for (const action of actionActivities.expansion) {
    const input = tutorRequest(expansionRequest({ action, expansionOptions: [] }));
    assert.ok(Object.values(input.detailSelections).every(value => value === false));
    const prompt = buildTutorPrompt(input);
    assert.match(prompt, /TIADA BUTIRAN DIPILIH/); assert.match(prompt, /Jangan cipta pilihan tersembunyi/);
    assert.match(prompt, /cadangkan butiran sesuai sebagai pilihan/);
  }
});
test('reason and conjunction can share one construction without duplicated clauses', () => {
  const record = reviewedExpansionCases.find(record => record.id === 'tahun-4-six-details');
  assert.equal(record.evidence.sebab, record.evidence.kata_hubung);
  assert.equal([...record.after.matchAll(/kerana/gu)].length, 1);
  const prompt = buildTutorPrompt(requestFor(record));
  assert.match(prompt, /sebab DAN kata hubung/); assert.match(prompt, /Jangan gandakan frasa/);
});
test('all six year styles have the requested soft ranges without inheriting essay-length instructions', () => {
  const ranges = ['8–15', '10–20', '15–25', '20–35', '25–40', '25–45'];
  for (const [i, range] of ranges.entries()) {
    const prompt = buildTutorPrompt(expansionRequest({ year: i + 1 }));
    assert.ok(prompt.includes(range)); assert.match(prompt, /panduan lembut, bukan had wajib/);
    assert.match(prompt, /Jangan jadikan latihan ini perenggan atau karangan/);
    assert.ok(!prompt.includes('paling banyak tiga contoh ayat ringkas'));
    assert.ok(!prompt.includes('Jangkaan: Karangan beberapa perenggan'));
  }
});
test('richness instructions retain clarity, natural Malaysian Malay, varied structure and meaningful detail priority', () => {
  const prompt = buildTutorPrompt(expansionRequest({ year: 6 }));
  for (const phrase of ['lebih bermaklumat, menarik dan bermakna', 'bukan sekadar menambah satu frasa',
    'Bahasa Melayu baku Malaysia', 'terjemahan harfiah', 'ungkapan Indonesia yang janggal', 'pengulangan sifat',
    'pelbagaikan struktur', 'ketepatan tatabahasa, kesesuaian situasi, kata kunci tepat']) assert.ok(prompt.includes(phrase));
});
test('feedback actions inspect selected goals in actual writing and explain gaps as opportunities rather than grammar errors', () => {
  for (const action of actionActivities.expansion.filter(action => action !== 'keyword_meaning')) {
    const prompt = buildTutorPrompt(expansionRequest({ action, expansionOptions: ['tempat', 'masa'] }));
    assert.match(prompt, /tempat ada tetapi masa yang dipilih belum jelas/);
    assert.match(prompt, /bukan semestinya kesalahan tatabahasa/);
    assert.match(prompt, /tanggungjawab tindakan/);
  }
});
test('meaning definitions keep their own responsibility while the single example considers a natural subset of details', () => {
  const input = tutorRequest(expansionRequest({ action: 'keyword_meaning', expansionOptions: ids, year: 6 }));
  const prompt = buildTutorPrompt(input);
  for (const phrase of ['JANGAN masukkan butiran pengembangan', 'Hanya contoh_ayat', 'subset semula jadi', 'tepat SATU', 'makna yang SAMA']) assert.ok(prompt.includes(phrase));
  const f = normalizeFeedback(meaningFeedback, input);
  assert.equal(f.maksud_bm, meaningFeedback.maksud_bm); assert.equal(f.meaning_en, meaningFeedback.meaning_en); assert.equal(f.meaning_zh, meaningFeedback.meaning_zh);
  assert.equal(f.contoh_ayat, meaningFeedback.contoh_ayat);
});
test('reviewed fixtures cover every detail across appropriate Tahun 1, 3 and 6 scenarios', () => {
  const demonstrated = new Set();
  for (const record of reviewedExpansionCases) {
    const input = tutorRequest(requestFor(record)); const f = normalizeFeedback(reviewedFeedback(record), input);
    assert.ok(containsKeyword(f.examples[0].text, record.keyword)); assert.equal(f.examples[0].text, record.after);
    for (const [id, span] of Object.entries(record.evidence)) {
      assert.ok(record.selected.includes(id)); assert.ok(record.after.includes(span)); demonstrated.add(id);
    }
  }
  assert.deepEqual([...demonstrated].sort(), [...ids].sort());
  for (const year of [1, 3, 6]) assert.ok(reviewedExpansionCases.some(record => record.year === year));
});
test('five-plus-detail fixtures survive the unchanged response format with situation and keyword checks', () => {
  for (const record of reviewedExpansionCases.filter(record => record.selected.length >= 5)) {
    const input = tutorRequest(requestFor(record)); const f = normalizeFeedback(reviewedFeedback(record), input);
    assert.equal(f.examples.length, 1); assert.equal(f.examples[0].situationRelevant, true);
    assert.deepEqual(normalizeFeedback(f, input), f);
  }
});
test('an inappropriate emotional detail may be omitted with a specific explanation and no invented coverage badge', () => {
  const record = reviewedExpansionCases.find(record => record.id === 'justified-omission');
  const input = tutorRequest(requestFor(record)); const f = normalizeFeedback(reviewedFeedback(record), input);
  assert.ok(input.detailSelections.perasaan); assert.ok(!Object.hasOwn(record.evidence, 'perasaan'));
  assert.match(f.explanation, /tanpa mereka emosi/); assert.equal(f.examples[0].text, record.after);
  const html = renderExpansionFeedback(f, input); assert.ok(html.includes(f.explanation)); assert.ok(!html.includes('Butiran digunakan:'));
});
test('richer multiword examples retain the complete phrase and reject substring or synonym substitutes', () => {
  const record = reviewedExpansionCases.find(record => record.id === 'multiword'); const input = tutorRequest(requestFor(record));
  assert.equal(normalizeFeedback(reviewedFeedback(record), input).examples[0].text, record.after);
  for (const text of [record.after.replace('ringan tulang', 'rajin'), record.after.replace('ringan tulang', 'ringan dan tulang')])
    assert.throws(() => normalizeFeedback({ ...reviewedFeedback(record), examples: [{ text, situationRelevant: true, reason: record.review }] }, input));
});
test('soft age guidance is not a deterministic word-count rejection or a false proof of linguistic quality', () => {
  const input = tutorRequest(expansionRequest({ year: 6, action: 'keyword_meaning', expansionOptions: ids }));
  // A short dictionary example remains permitted when a clear subset is useful.
  assert.doesNotThrow(() => normalizeFeedback(meaningFeedback, input));
  assert.match(buildTutorPrompt(input), /bukan had wajib atau sasaran markah/);
});
test('each richer example has one Salin control and no fixture evidence or review metadata enters the copied sentence', () => {
  const record = reviewedExpansionCases.find(record => record.year === 6); const input = tutorRequest(requestFor(record));
  const f = normalizeFeedback(reviewedFeedback(record), input); const html = renderExpansionFeedback(f, input);
  assert.equal([...html.matchAll(/data-copy-example=/gu)].length, 1); assert.ok(html.includes(record.after));
  assert.ok(!html.includes(record.review)); assert.ok(!html.includes('evidence')); assert.ok(!html.includes('omissions'));
});
test('all six actions traverse the existing server contract with complete states and no additional checking calls', async () => {
  let generations = 0, fetches = 0;
  const record = reviewedExpansionCases.find(record => record.year === 3);
  const handler = createTeacherHandler({ env: { GEMINI_API_KEY: 'fixture-private', GEMINI_FAST_MODEL: 'configured-model' },
    limiter: { acquire: () => () => {} }, logger: { warn() {} }, generate: async input => {
      generations++; assert.deepEqual(input.detailSelections, detailSelectionStates(record.selected));
      assert.match(buildTutorPrompt(input), /Semak liputan butiran secara semantik/);
      return JSON.stringify(input.action === 'keyword_meaning' ? meaningFeedback : reviewedFeedback(record));
    } });
  const service = createAIService({ fetcher: (url, init) => {
    fetches++; assert.equal(url, '/api/gemini'); assert.ok(!init.body.includes('fixture-private'));
    return handler(new Request('http://localhost' + url, init));
  } });
  for (const action of actionActivities.expansion) assert.equal((await service.request(requestFor(record, { action }))).mode, 'api');
  assert.equal(generations, 6); assert.equal(fetches, 6);
});
test('external AI prompts use the identical shared detail/year requirements without network access', async () => {
  const service = createAIService({ fetcher: () => { throw Error('Unexpected network'); } });
  for (const action of actionActivities.expansion) {
    const input = expansionRequest({ action, year: 4, expansionOptions: ids });
    const result = await service.request(input, { mode: 'prompt' });
    assert.equal(result.prompt, buildTutorPrompt(input)); assert.equal(result.prompt, buildExternalTutorPrompt(input));
    assert.match(result.prompt, /20–35/); assert.match(result.prompt, /MATLAMAT BUTIRAN DIPILIH \(8\)/);
  }
});
test('cache identity changes with selection, original, current writing and year', () => {
  const original = cacheIdentity(expansionRequest());
  for (const changes of [{ expansionOptions: [] }, { originalSentence: 'Saya membantu ayah.' }, { studentText: 'Saya membantu ibu di dapur.' }, { year: 6 }])
    assert.notEqual(cacheIdentity(expansionRequest(changes)), original);
});
test('non-AI writing check is absent only from expansion and essential editors, AI review and TTS remain', () => {
  for (let year = 1; year <= 6; year++) {
    const pack = getCurriculumPack(year), store = createStore({ storage: { getItem: () => null, setItem() {} } }); store.setYear(year);
    const d = store.draft('expansion', 'Ayat', pack, { itemId: pack.items[0].id });
    const html = renderExpansion({ pack, draft: d, state: store.state });
    assert.ok(!html.includes('data-local-check')); assert.ok(!html.includes('id="local-feedback"')); assert.ok(!html.includes('Semak asas tulisan'));
    assert.ok(html.includes('id="original-input"')); assert.ok(html.includes('data-ai="sentence_check"')); assert.ok(html.includes('expanded-keyword-check'));
    assert.equal([...html.matchAll(/data-detail=/gu)].length, 8);
    for (const selector of ['data-read-writing', 'data-speech="pause"', 'data-speech="resume"', 'data-speech="stop"', 'data-speech-rate']) assert.ok(html.includes(selector));
    for (const activity of ['sentence', 'paragraph', 'story']) assert.ok(editor({ ...d, activity }).includes('data-local-check'));
  }
});
test('existing selections and pupil drafts survive autosave and legacy hydration without storing a second selection model', () => {
  const store = createStore({ storage: { getItem: () => null, setItem() {} } }); const pack = getCurriculumPack(2);
  store.setYear(2); const d = store.draft('expansion', 'Ayat', pack, { itemId: pack.items[0].id });
  store.updateDraft(d.id, { original: 'Saya membantu ibu.', text: 'Saya membantu ibu menyediakan sarapan.', plan: { tempat: 'yes', masa: 'yes', kata_keterangan: 'yes' } });
  const saved = hydrate(store.state).drafts[d.id];
  assert.equal(saved.original, d.original); assert.equal(saved.text, d.text); assert.equal(saved.itemId, d.itemId);
  assert.deepEqual(detailSelectionStates(Object.keys(saved.plan).filter(id => saved.plan[id] === 'yes')), detailSelectionStates(['tempat', 'masa', 'kata_hubung']));
  assert.equal(saved.detailSelections, undefined); assert.equal(saved.fields.detailSelections, undefined);
});
