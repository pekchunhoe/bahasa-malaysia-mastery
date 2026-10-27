import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionDetails } from '../js/expansion.js';
import { detailExpansionAction, detailExpansionFeedbackSchema } from '../js/expansion-tutor.js';
import { buildTutorPrompt, buildExternalTutorPrompt, tutorRequest, normalizeFeedback, cacheIdentity } from '../js/tutor-actions.js';
import { createAIService } from '../js/ai-teacher.js';
import { createTeacherHandler } from '../server/ai-handler.js';
import { createTutorLimiter } from '../server/ai-rate-limit.js';
import { renderExpansion } from '../activities/sentence.js';
import { renderExpansionFeedback } from '../components/expansion-ai.js';
import { teacherButtons } from '../components/writing.js';
import { getCurriculumPack } from '../js/curriculum-service.js';
import { createStore } from '../js/state.js';
import { expansionRequest } from './fixtures/expansion-ai.mjs';
import { detailFeedback, creativeYearExamples } from './fixtures/expansion-separation.mjs';

const ids = expansionDetails.map(detail => detail.id);
const detailRequest = changes => expansionRequest({ action: detailExpansionAction, expansionOptions: ids, ...changes });
const env = { GEMINI_API_KEY: 'fixture-private', GEMINI_FAST_MODEL: 'configured-model' };
const post = input => new Request('http://localhost/api/gemini', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
});
const options = { env, limiter: { acquire: () => () => {} }, logger: { warn() {} } };

test('dedicated button follows all eight chips inside its named section and is absent from general action group', () => {
  const pack = getCurriculumPack(4), store = createStore({ storage: { getItem: () => null, setItem() {} } });
  store.setYear(4); const draft = store.draft('expansion', 'Ayat', pack);
  const html = renderExpansion({ pack, draft, state: store.state });
  const section = html.match(/<section class="expansion-detail-section"[\s\S]*?<\/section>/)[0];
  assert.equal((section.match(/data-detail=/g) || []).length, 8);
  assert.ok(section.indexOf(`data-ai="${detailExpansionAction}"`) > section.lastIndexOf('data-detail='));
  for (const value of ['Cikgu AI · Kembangkan Ikut Butiran', 'id="expansion-detail-result"', 'aria-describedby="detail-ai-status"', 'role="status"']) assert.ok(section.includes(value));
  assert.ok(!teacherButtons('expansion').includes(detailExpansionAction));
  assert.equal((teacherButtons('expansion').match(/data-ai=/g) || []).length, 5);
});

test('dedicated schema and validation require exactly three distinct examples and three copy controls', () => {
  const schema = detailExpansionFeedbackSchema.properties.examples;
  assert.equal(schema.minItems, 3); assert.equal(schema.maxItems, 3);
  const request = detailRequest(), result = normalizeFeedback(detailFeedback, request);
  assert.deepEqual(normalizeFeedback(result, request), result);
  const html = renderExpansionFeedback(result, request);
  assert.match(html, /Cadangan Ayat Mengikut Butiran/);
  assert.equal((html.match(/data-copy-example=/g) || []).length, 3);
  for (const examples of [[], detailFeedback.examples.slice(1), [...detailFeedback.examples, detailFeedback.examples[0]],
    [detailFeedback.examples[0], detailFeedback.examples[0], detailFeedback.examples[2]]])
    assert.throws(() => normalizeFeedback({ ...detailFeedback, examples }, request));
});

test('dedicated output validates the exact keyword, one sentence and relevance for every example', () => {
  for (let index = 0; index < 3; index++) for (const changes of [
    { text: 'Saya menolong ibu menyediakan sarapan.' }, { text: 'Saya membantunya menyediakan sarapan.' },
    { text: 'Saya membantu ibu. Saya membantu ayah.' }, { text: '<b>Saya membantu ibu.</b>' },
    { situationRelevant: false }, { reason: '' },
  ]) {
    const raw = structuredClone(detailFeedback); Object.assign(raw.examples[index], changes);
    assert.throws(() => normalizeFeedback(raw, detailRequest()));
  }
  const phrase = { ...detailFeedback, examples: detailFeedback.examples.map(example => ({ ...example,
    text: example.text.replace('membantu', 'yang ringan tulang membantu') })) };
  assert.equal(normalizeFeedback(phrase, detailRequest({ keyword: 'ringan tulang' })).examples.length, 3);
});

test('representative years retain distinct age guidance for both modes and accept reviewed creative fixtures', () => {
  for (const year of [1, 3, 4, 6]) for (const action of ['sentence_expand', detailExpansionAction]) {
    const prompt = buildTutorPrompt(detailRequest({ action, year }));
    assert.match(prompt, new RegExp(`PANDUAN CONTOH TAHUN ${year}`));
    assert.match(prompt, /Kesesuaian umur lebih penting/);
    assert.match(prompt, /kata kunci atau frasa LENGKAP/);
  }
  for (const record of creativeYearExamples) {
    const raw = { ...detailFeedback, examples: [{ ...detailFeedback.examples[0], text: record.after }] };
    assert.equal(normalizeFeedback(raw, expansionRequest({ year: record.year })).examples[0].text, record.after);
  }
});

test('dedicated prompt includes selections, sensible omissions and meaningful variation with no fixed word range', () => {
  const prompt = buildTutorPrompt(detailRequest());
  for (const detail of expansionDetails) assert.ok(prompt.includes(detail.generation));
  for (const phrase of ['MATLAMAT BUTIRAN DIPILIH (8)', 'Beri tepat TIGA', 'bukan menukar satu perkataan sahaja',
    'boleh tinggalkan dengan alasan munasabah', 'Jangan gandakan frasa', 'usahakan semua butiran']) assert.ok(prompt.includes(phrase), phrase);
  assert.ok(!/Anggaran \d|\d+[–-]\d+ perkataan/u.test(prompt));
});

test('dedicated examples may omit an unsuitable emotion with a clear explanation while retaining other selected goals', () => {
  const request = detailRequest({ year: 1, keyword: 'mencuci', situationMode: 'custom', situationId: '',
    situation: 'Saya menerangkan langkah mencuci tangan sebelum makan.',
    originalSentence: 'Saya mencuci tangan.', studentText: 'Saya mencuci tangan dengan sabun.',
    expansionOptions: ['tempat', 'masa', 'cara', 'perasaan', 'kata_hubung'] });
  const raw = { ...detailFeedback, explanation: 'Perasaan tidak ditambah supaya langkah kekal jelas tanpa mereka emosi.',
    examples: [
      'Sebelum makan, saya mencuci tangan di sinki dengan sabun supaya bersih.',
      'Saya mencuci tangan dengan sabun di sinki sebelum makan supaya kuman hilang.',
      'Di sinki, saya mencuci tangan dengan sabun sebelum makan supaya tangan bersih.',
    ].map(text => ({ text, situationRelevant: true, reason: 'Langkah membersihkan tangan sebelum makan.' })) };
  const result = normalizeFeedback(raw, request);
  assert.equal(result.examples.length, 3); assert.match(result.explanation, /tanpa mereka emosi/);
  assert.match(buildTutorPrompt(request), /boleh tinggalkan dengan alasan munasabah/);
});

test('dedicated external prompt includes the same detail requirements without machine response structures', async () => {
  const service = createAIService({ fetcher: () => { throw Error('Network forbidden'); } });
  const result = await service.request(detailRequest(), { mode: 'prompt' });
  assert.equal(result.prompt, buildExternalTutorPrompt(detailRequest()));
  assert.match(result.prompt, /MATLAMAT BUTIRAN DIPILIH \(8\)/);
  assert.match(result.prompt, /Beri tepat TIGA/);
  assert.ok(!result.prompt.includes('Pulangkan JSON')); assert.ok(!result.prompt.includes('{"ok"'));
  assert.ok(!result.prompt.includes('DATA MURID (JSON'));
});

test('empty details reject on client and server without an AI generation or fetch', async () => {
  let calls = 0;
  const service = createAIService({ fetcher: () => { calls++; throw Error('Unexpected fetch'); } });
  await assert.rejects(service.request(detailRequest({ expansionOptions: [] })), /Pilih sekurang-kurangnya satu butiran dahulu/);
  const handler = createTeacherHandler({ ...options, generate: () => { calls++; } });
  assert.equal((await handler(post(detailRequest({ expansionOptions: [] })))).status, 400);
  assert.equal(calls, 0);
});

test('dedicated cache identity changes with each selection and every relevant context field', () => {
  const base = cacheIdentity(detailRequest());
  for (const id of ids) assert.notEqual(base, cacheIdentity(detailRequest({ expansionOptions: ids.filter(value => value !== id) })));
  for (const changes of [{ keyword: 'menyediakan' }, { keywordMode: 'builtin' }, { year: 6 },
    { situationMode: 'custom', situationId: '', situation: 'Saya membantu nenek menyediakan sarapan.' },
    { studentText: 'Saya membantu ibu di dapur.' }, { originalSentence: 'Saya membantu keluarga.' }])
    assert.notEqual(base, cacheIdentity(detailRequest(changes)));
});

test('dedicated malformed and Gemini error responses do not cache, retry or mutate pupil writing', async () => {
  for (const data of [{ ...detailFeedback, examples: [] }, { ...detailFeedback, examples: 'bad' }, { ok: false }]) {
    let calls = 0;
    const handler = createTeacherHandler({ ...options, generate: async () => { calls++; return JSON.stringify(data); } });
    const service = createAIService({ fetcher: (url, init) => handler(new Request('http://localhost' + url, init)) });
    const input = detailRequest(), before = structuredClone(input);
    await assert.rejects(service.request(input), /Cuba lagi/);
    await assert.rejects(service.request(input), /Cuba lagi/);
    assert.equal(calls, 2); assert.deepEqual(input, before);
  }
  for (const status of [429, 503]) {
    const service = createAIService({ fetcher: async () => Response.json({ ok: false, error: { message: 'Cuba lagi.' } }, { status }) });
    await assert.rejects(service.request(detailRequest()), /Cuba lagi/);
  }
});

test('dedicated action shares the existing endpoint, allowlist, rate limits and origin checks', async () => {
  let calls = 0;
  const handler = createTeacherHandler({ ...options, limiter: createTutorLimiter({ perClient: 1 }),
    generate: async input => { calls++; assert.deepEqual(input.expansionOptions, ids); return JSON.stringify(detailFeedback); } });
  assert.equal((await handler(post(detailRequest()))).status, 200);
  assert.equal((await handler(post(detailRequest()))).status, 429);
  assert.equal(calls, 1);
  assert.throws(() => tutorRequest({ ...detailRequest(), activity: 'sentence' }));
  const foreign = post(detailRequest()); foreign.headers.set('Origin', 'https://foreign.invalid');
  assert.equal((await handler(foreign)).status, 403);
});
