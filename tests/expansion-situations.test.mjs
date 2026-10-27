import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situations, situationCategories, filterSituations, activeSituation, cleanSituation, situationError, situationRequest, hydrateSituationFields } from '../js/expansion-situations.js';
import { renderExpansionSituation, situationOptions } from '../components/expansion-situation.js';
import { renderExpansionFeedback } from '../components/expansion-ai.js';
import { attachExampleCopyButtons } from '../components/ai-examples.js';
import { renderExpansionKeyword } from '../components/expansion-keyword.js';
import { teacherButtons } from '../components/writing.js';
import { createStore } from '../js/state.js';
import { getCurriculumPack } from '../js/curriculum-service.js';
import { hydrate } from '../js/storage.js';
import { actionActivities, buildTutorPrompt, buildExternalTutorPrompt, tutorRequest, normalizeFeedback, cacheIdentity } from '../js/tutor-actions.js';
import { createAIService } from '../js/ai-teacher.js';
import { createTeacherHandler } from '../server/ai-handler.js';
import { openTeacher } from '../components/ai-teacher.js';
import { expansionFeedback, meaningFeedback, expansionRequest } from './fixtures/expansion-ai.mjs';

const draft = (fields = {}) => ({ activity: 'expansion', year: 2, fields, plan: {}, text: '', original: '' });
const jsonRequest = raw => new Request('http://localhost/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(raw) });
const options = { env: { GEMINI_API_KEY: 'test-secret-only', GEMINI_FAST_MODEL: 'configured-only' }, limiter: { acquire: () => () => {} }, logger: { warn() {} } };

test('catalogue contains exactly 100 unique stable IDs and 10 categories of 10 situations', () => {
  assert.equal(situations.length, 100); assert.equal(situationCategories.length, 10);
  assert.deepEqual(situations.map(record => record.id), Array.from({ length: 100 }, (_, i) => `S${String(i + 1).padStart(3, '0')}`));
  assert.equal(new Set(situations.map(record => record.text)).size, 100);
  for (const category of situationCategories) assert.equal(situations.filter(record => record.categoryId === category.id).length, 10);
  assert.equal(situations[0].text, 'Membantu ibu menyediakan sarapan.');
  assert.equal(situations.at(-1).text, 'Menghasilkan projek kreatif bersama keluarga.');
  assert.ok(Object.isFrozen(situations)); assert.ok(situations.every(Object.isFrozen));
});
test('category filtering never leaks other categories and all categories is complete', () => {
  for (const category of situationCategories) assert.ok(filterSituations({ category: category.id }).every(record => record.categoryId === category.id));
  assert.equal(filterSituations().length, 100);
  assert.deepEqual(filterSituations({ category: 'unknown' }), []);
});
test('situation search ignores case, diacritics, term order and repeated whitespace', () => {
  for (const query of ['  MENYEDIAKAN   SARAPAN ', 'sarápan', 'sarapan ibu']) assert.equal(filterSituations({ category: 'C01', query })[0].id, 'S001');
  assert.equal(filterSituations({ category: 'C02', query: 'sarapan' }).length, 0);
  assert.equal(filterSituations({ query: 'unlikelynomatch' }).length, 0);
});
test('custom situation accepts ordinary Malay punctuation, trims edges and has a 300-character bound', () => {
  const value = '  Saya membantu datuk. “Mari,” katanya!  ';
  assert.equal(cleanSituation(value), value.trim()); assert.equal(situationError(value), '');
  assert.equal(situationError('a'.repeat(300)), '');
  for (const value of ['', '  \n ', '?!', 'a'.repeat(301), '<img src=x onerror=alert(1)>', 'a\u0000b', 3]) assert.ok(situationError(value));
});
test('legacy selector starts without an arbitrary situation and uses a compact labelled interface', () => {
  const d = draft();
  assert.deepEqual(activeSituation(d), { situationMode: 'builtin', situationId: '', situation: '' });
  const html = renderExpansionSituation(d);
  assert.match(html, /Semua Kategori/); assert.match(html, /Belum dipilih/);
  assert.equal([...html.matchAll(/<option value="S\d{3}"/g)].length, 100);
  assert.ok(!html.includes('id="custom-situation"'));
  assert.match(html, /for="situation-category"/); assert.match(html, /for="situation-search"/);
});
test('situation UI filters choices while keeping the active selection explicitly visible', () => {
  const d = draft({ situationId: 'S001', situationCategory: 'C02', situationQuery: 'perpustakaan' });
  const html = situationOptions(d);
  assert.match(html, /optgroup label="Situasi aktif"/); assert.match(html, /value="S001" selected/);
  assert.match(html, /value="S013"/); assert.ok(!html.includes('S014'));
  assert.equal(activeSituation(d).situationId, 'S001', 'filters do not silently select a new context');
});
test('only the active situation mode determines the request and switching retains both values', () => {
  const d = draft({ situationId: 'S001', customSituation: 'Saya membantu jiran membawa beg.' });
  assert.equal(activeSituation(d).situation, situations[0].text);
  d.fields.situationMode = 'custom';
  assert.equal(activeSituation(d).situation, d.fields.customSituation); assert.equal(activeSituation(d).situationId, '');
  let html = renderExpansionSituation(d); assert.match(html, /id="custom-situation"/); assert.ok(!html.includes('id="situation-select"'));
  d.fields.situationMode = 'builtin'; assert.equal(activeSituation(d).situationId, 'S001');
  assert.equal(d.fields.customSituation, 'Saya membantu jiran membawa beg.');
});
test('custom situation pending input is escaped and never becomes active before activation', () => {
  const d = draft({ situationMode: 'custom', customSituation: 'Saya bermain bersama adik.', customSituationDraft: '</textarea><img src=x onerror=alert(1)>' });
  const html = renderExpansionSituation(d);
  assert.ok(!html.includes('<img')); assert.match(html, /&lt;\/textarea&gt;/);
  assert.equal(activeSituation(d).situation, 'Saya bermain bersama adik.');
});
test('server resolves canonical built-in text and rejects hidden-mode or forged situations', () => {
  assert.equal(situationRequest({ situationId: 'S001' }).situation, situations[0].text);
  for (const raw of [{ situationId: 'S999' }, { situationId: 'S001', situation: 'Bermain bola.' }, { situation: 'Hidden custom' },
    { situationMode: 'other' }, { situationMode: 'custom', situationId: 'S001', situation: 'Saya membantu.' },
    { situationMode: 'custom', situation: '   ' }, { situationMode: 'custom', situation: 1 }]) assert.throws(() => situationRequest(raw));
  assert.equal(situationRequest({ situationMode: 'custom', situation: ' Saya membantu jiran. ' }).situation, 'Saya membantu jiran.');
});
test('situation persistence preserves modes, pending input, writing and per-year/item identity', () => {
  const values = new Map(), storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  const store = createStore({ storage }); store.setYear(2); const pack = getCurriculumPack(2);
  const first = store.draft('expansion', 'Ayat', pack, { itemId: pack.items[0].id });
  const fields = { expansionMode: 'custom', customKeyword: 'membantu', situationMode: 'custom', situationId: 'S001',
    customSituation: 'Saya membantu jiran.', customSituationDraft: 'Saya membantu jiran membawa beg.', situationCategory: 'C03', situationQuery: 'rakan' };
  store.updateDraft(first.id, { fields, original: 'Saya membantu.', text: 'Saya membantu jiran membawa beg.' });
  const other = store.draft('expansion', 'Ayat', pack, { itemId: pack.items[1].id }); assert.equal(activeSituation(other).situation, '');
  store.setYear(3); const next = store.draft('expansion', 'Ayat', getCurriculumPack(3)); assert.equal(activeSituation(next).situation, '');
  const reloaded = createStore({ storage }); reloaded.resume(first.id);
  assert.deepEqual(reloaded.state.drafts[first.id].fields, fields); assert.equal(reloaded.state.drafts[first.id].text, first.text);
  assert.equal(reloaded.state.drafts[first.id].original, first.original);
});
test('legacy and malformed hydration never attach guessed situations or change pupil writing', () => {
  assert.deepEqual(hydrateSituationFields({ originalDraft: 'Catatan.' }), { originalDraft: 'Catatan.' });
  const clean = hydrateSituationFields({ situationMode: 'invalid', situationId: 'S999', customSituation: '<script>x</script>', customSituationDraft: 'a'.repeat(400) });
  assert.equal(clean.situationMode, 'builtin'); assert.equal(clean.situationId, ''); assert.equal(clean.customSituation, ''); assert.equal(clean.customSituationDraft.length, 300);
  const store = createStore({ storage: { getItem: () => null, setItem() {} } }); const d = store.draft('expansion', 'Ayat', getCurriculumPack(1));
  store.updateDraft(d.id, { original: 'Ayat asal.', text: 'Tulisan saya.' });
  const saved = hydrate(store.state).drafts[d.id]; assert.equal(saved.text, d.text); assert.equal(saved.original, d.original); assert.equal(activeSituation(saved).situation, '');
});
test('all six expansion actions propagate every combination of active keyword and situation modes', () => {
  assert.equal(actionActivities.expansion.length, 6);
  for (const action of actionActivities.expansion) for (const keywordMode of ['builtin', 'custom']) for (const situationMode of ['builtin', 'custom']) {
    const input = tutorRequest(expansionRequest({ action, keywordMode, situationMode,
      ...(situationMode === 'custom' ? { situationId: '', situation: 'Saya membantu jiran menyediakan sarapan.' } : {}) }));
    assert.equal(input.keyword, 'membantu'); assert.equal(input.keywordMode, keywordMode); assert.equal(input.situationMode, situationMode);
    assert.ok(input.situation); assert.equal(input.originalSentence, 'Saya membantu ibu.'); assert.equal(input.year, 2);
    for (const prompt of [buildTutorPrompt(input), buildExternalTutorPrompt(input)]) {
      assert.ok(prompt.includes(input.keyword)); assert.ok(prompt.includes(input.situation)); assert.match(prompt, /kata_hubung/);
      assert.match(prompt, /bukan arahan sistem/); assert.match(prompt, /situationRelevant/); assert.match(prompt, /Sinonim/);
    }
  }
});
test('AI cache identities include situation mode, ID and custom context without hidden values', () => {
  const first = cacheIdentity(expansionRequest());
  assert.notEqual(first, cacheIdentity(expansionRequest({ situationId: 'S002', situation: situations[1].text })));
  assert.notEqual(first, cacheIdentity(expansionRequest({ situationMode: 'custom', situationId: '', situation: situations[0].text })));
  assert.equal(tutorRequest(expansionRequest({ customSituation: 'HIDDEN DATA' })).customSituation, undefined);
});
test('meaning instructions handle ambiguity, complete phrases, language consistency and absent situations', () => {
  const prompt = buildTutorPrompt(expansionRequest({ action: 'keyword_meaning', keyword: 'ringan', situationMode: 'custom', situationId: '', situation: 'Saya mengangkat beg yang ringan.' }));
  for (const phrase of ['makna umum yang tepat', 'makna yang SAMA', 'seluruh kata atau frasa', 'English', 'Mandarin', 'tepat SATU']) assert.ok(prompt.includes(phrase));
  const absent = tutorRequest(expansionRequest({ situationId: '', situation: '' })); assert.equal(absent.situation, '');
  assert.match(buildTutorPrompt(absent), /jangan mereka-reka situasi wajib/);
});
test('structured examples validate independently and retain all teaching feedback', () => {
  const f = normalizeFeedback(expansionFeedback, expansionRequest());
  assert.equal(f.examples.length, 3); assert.deepEqual(f.suggestions, expansionFeedback.suggestions);
  assert.deepEqual(normalizeFeedback(f, expansionRequest()), f);
  for (let index = 0; index < 3; index++) {
    const bad = structuredClone(expansionFeedback); bad.examples[index].text = 'Saya menolong ibu menyediakan sarapan.';
    assert.throws(() => normalizeFeedback(bad, expansionRequest()));
  }
});
test('multiword keywords remain complete and unrelated substrings never validate', () => {
  const input = expansionRequest({ keyword: 'kasih sayang' });
  const f = structuredClone(expansionFeedback); f.examples = [{ text: 'Saya menunjukkan kasih sayang dengan membantu ibu menyediakan sarapan.', situationRelevant: true, reason: 'Kasih kepada ibu melalui bantuan menyediakan sarapan.' }];
  assert.equal(normalizeFeedback(f, input).examples.length, 1);
  f.examples[0].text = 'Saya menunjukkan kasih dan sayang kepada ibu.'; assert.throws(() => normalizeFeedback(f, input));
  f.examples[0].text = 'Saya membantu ibu.'; assert.throws(() => normalizeFeedback(f, expansionRequest({ keyword: 'bantu' })));
});
test('context assessment rejects unrelated examples and does not use literal situation overlap', () => {
  for (const values of [{ situationRelevant: false }, { situationRelevant: undefined }, { reason: '' }]) {
    const f = structuredClone(expansionFeedback); Object.assign(f.examples[0], values); assert.throws(() => normalizeFeedback(f, expansionRequest()));
  }
  const f = { ...expansionFeedback, examples: [{ text: 'Dia membantu seekor pipit yang cedera.', situationRelevant: true, reason: 'Watak menyelamatkan burung yang cedera.' }] };
  assert.equal(normalizeFeedback(f, expansionRequest({ situationMode: 'custom', situationId: '', situation: 'Menyelamatkan burung.' })).examples.length, 1);
});
test('example validation rejects empty, malformed, multi-sentence and markup output', () => {
  for (const text of ['', 'membantu', 'Saya membantu ibu. Saya membantu ayah.', '<b>Saya membantu ibu.</b>', 'Contoh ayat: Saya membantu ibu.', '1. Saya membantu ibu.']) {
    assert.throws(() => normalizeFeedback({ ...expansionFeedback, examples: [{ text, situationRelevant: true, reason: 'Bantuan kepada ibu.' }] }, expansionRequest()));
  }
  for (const examples of [null, 'text', [null], [{ text: 1 }], Array(4).fill(expansionFeedback.examples[0])]) assert.throws(() => normalizeFeedback({ ...expansionFeedback, examples }, expansionRequest()));
});
test('legacy singleton sentences split into independent examples without changing other activities', () => {
  const raw = { ok: true, summary: 'Idea jelas.', errors: [], suggestions: [], explanation: '', example: 'Saya membantu ibu. Saya membantu ayah.' };
  const f = normalizeFeedback(raw, expansionRequest({ situationId: '', situation: '' })); assert.equal(f.examples.length, 2);
  assert.equal(normalizeFeedback(raw, { activity: 'sentence' }).example, raw.example);
  assert.throws(() => normalizeFeedback(raw, expansionRequest()), 'legacy examples cannot bypass active-situation assessment');
});
test('trilingual meaning returns all languages and exactly one keyword example', () => {
  const request = expansionRequest({ action: 'keyword_meaning' });
  const f = normalizeFeedback(meaningFeedback, request);
  assert.equal(f.maksud_bm, meaningFeedback.maksud_bm); assert.equal(f.meaning_en, meaningFeedback.meaning_en);
  assert.match(f.meaning_zh, /帮助/); assert.equal(f.contoh_ayat, meaningFeedback.contoh_ayat);
  assert.deepEqual(normalizeFeedback(f, request), f);
  assert.doesNotThrow(() => normalizeFeedback(meaningFeedback, expansionRequest({ action: 'keyword_meaning', situationId: '', situation: '' })));
  assert.doesNotThrow(() => normalizeFeedback({ ...meaningFeedback, keyword: 'MEMBANTU' }, request));
  const phraseRequest = expansionRequest({ action: 'keyword_meaning', keyword: 'ringan tulang' });
  const idiom = { ...meaningFeedback, keyword: 'ringan tulang', maksud_bm: 'Rajin dan suka membantu orang lain.',
    meaning_en: 'Hardworking and willing to help others.', meaning_zh: '勤劳并乐于帮助别人。',
    contoh_ayat: 'Adik yang ringan tulang membantu ibu menyediakan sarapan.' };
  assert.equal(normalizeFeedback(idiom, phraseRequest).keyword, 'ringan tulang');
  assert.throws(() => normalizeFeedback({ ...idiom, contoh_ayat: 'Adik ringan membantu ibu.' }, phraseRequest));
});
test('meaning rejects missing languages, non-Chinese Mandarin, mismatched senses and multiple examples', () => {
  const request = expansionRequest({ action: 'keyword_meaning' });
  for (const change of [{ maksud_bm: '' }, { meaning_en: '' }, { meaning_en: '_To help._' }, { meaning_zh: 'help' }, { sameMeaning: false }, { keyword: 'menolong' },
    { contoh_ayat: 'Saya menolong ibu.' }, { contoh_ayat: 'Saya membantu ibu. Saya membantu ayah.' }, { situationRelevant: false }, { ok: false }])
    assert.throws(() => normalizeFeedback({ ...meaningFeedback, ...change }, request));
});
test('all example cards have individual labelled Salin buttons without copying explanatory prose', () => {
  for (const action of actionActivities.expansion.filter(action => action !== 'keyword_meaning')) {
    const request = expansionRequest({ action }); const html = renderExpansionFeedback(normalizeFeedback(expansionFeedback, request), request);
    assert.equal([...html.matchAll(/data-copy-example=/g)].length, 3); assert.match(html, /aria-live="polite"/);
    assert.ok(!html.includes('raw JSON')); assert.match(html, /Cadangan untuk kamu/);
  }
  const request = expansionRequest({ action: 'keyword_meaning' }); const html = renderExpansionFeedback(normalizeFeedback(meaningFeedback, request), request);
  assert.equal([...html.matchAll(/data-copy-example=/g)].length, 1); assert.match(html, /lang="zh-Hans"/); assert.match(html, /中文（华文）/);
  assert.ok(!html.includes('sameMeaning')); assert.ok(!html.includes('meaning_en'));
});
test('meaning trigger exists once beside the active keyword in both keyword modes and is disabled without one', () => {
  const pack = getCurriculumPack(2), d = draft({ builtinKeywordId: pack.vocabulary[0].id });
  for (const mode of ['builtin', 'custom']) {
    d.fields.expansionMode = mode; d.fields.customKeyword = 'membantu';
    assert.equal([...renderExpansionKeyword(pack, d, { unit: 'all' }).matchAll(/data-keyword-meaning/g)].length, 1);
  }
  d.fields.customKeyword = '';
  assert.match(renderExpansionKeyword(pack, d, { unit: 'all' }), /data-keyword-meaning disabled/);
  assert.ok(!teacherButtons('expansion').includes('keyword_meaning'), 'no duplicated teacher action');
});
test('AI-rendered pupil content is escaped in guidance, meanings and example cards', () => {
  const html = renderExpansionFeedback({ ...meaningFeedback, kind: 'keyword_meaning', keyword: '<img>', meaning_zh: '<script>帮助</script>' }, expansionRequest({ action: 'keyword_meaning' }));
  assert.ok(!html.includes('<script>')); assert.match(html, /&lt;script&gt;/);
});
test('independent copy handlers copy only each sentence and show Disalin feedback without duplicate writes', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator'), copied = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => copied.push(text) } } });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'navigator', descriptor) : delete globalThis.navigator);
  const buttons = expansionFeedback.examples.map((_, i) => ({ dataset: { copyExample: String(i) }, textContent: 'Salin', isConnected: true, attributes: {},
    getAttribute(key) { return this.attributes[key] || 'Salin contoh'; }, setAttribute(key, value) { this.attributes[key] = value; } }));
  attachExampleCopyButtons({ querySelectorAll: () => buttons }, expansionFeedback.examples.map(example => example.text));
  await Promise.all([buttons[0].onclick(), buttons[0].onclick()]); await buttons[2].onclick();
  assert.deepEqual(copied, [expansionFeedback.examples[0].text, expansionFeedback.examples[2].text]);
  assert.equal(buttons[0].textContent, 'Disalin ✓'); assert.equal(buttons[1].textContent, 'Salin');
});
test('meaning uses the existing secure endpoint and server limits; invalid responses never cache or retry', async () => {
  let generations = 0;
  const handler = createTeacherHandler({ ...options, generate: async input => { generations++; assert.equal(input.situationId, 'S001'); return JSON.stringify({ ...meaningFeedback, meaning_zh: '' }); } });
  const service = createAIService({ fetcher: (url, init) => { assert.equal(url, '/api/gemini'); assert.ok(!init.body.includes(options.env.GEMINI_API_KEY)); return handler(jsonRequest(JSON.parse(init.body))); } });
  await assert.rejects(service.request(expansionRequest({ action: 'keyword_meaning' })), /Cuba lagi/); assert.equal(generations, 1);
  await assert.rejects(service.request(expansionRequest({ action: 'keyword_meaning' })), /Cuba lagi/); assert.equal(generations, 2);
  const limited = createTeacherHandler({ ...options, limiter: { acquire() { throw Object.assign(new Error('limited'), { status: 429 }); } } });
  const response = await limited(jsonRequest(expansionRequest({ action: 'keyword_meaning' })));
  assert.equal(response.status, 429); assert.equal((await response.json()).error.code, 'AI_RATE_LIMIT');
});
test('all external copy-prompts carry both constraints locally without any AI network call', async () => {
  let calls = 0; const service = createAIService({ fetcher: () => { calls++; throw Error('network forbidden'); } });
  for (const action of actionActivities.expansion) {
    const response = await service.request(expansionRequest({ action }), { mode: 'prompt' });
    assert.match(response.prompt, /Membantu ibu menyediakan sarapan/); assert.match(response.prompt, /membantu/); assert.match(response.prompt, /situationRelevant/);
  }
  assert.equal(calls, 0);
});
test('cancelled inline meaning responses cannot render or reset a newer active request', async () => {
  const nodes = new Map(); const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', setAttribute() {}, querySelector: node, querySelectorAll: () => [] }); return nodes.get(selector);
  };
  const mount = { innerHTML: '', querySelector: node };
  const store = { runtime: { ai: 'idle' } }; let resolve, capturedSignal;
  const service = { request: (_, { signal }) => { capturedSignal = signal; return new Promise(done => { resolve = done; }); } };
  const cleanup = openTeacher({ service, store, request: expansionRequest({ action: 'keyword_meaning' }), mount });
  const result = node('#meaning-teacher-result'); assert.match(result.innerHTML, /loading/);
  cleanup(); assert.ok(capturedSignal.aborted); store.runtime.ai = 'loading';
  result.innerHTML = 'NEW REQUEST'; resolve({ mode: 'api', feedback: normalizeFeedback(meaningFeedback, expansionRequest({ action: 'keyword_meaning' })) });
  await new Promise(done => setImmediate(done));
  assert.equal(result.innerHTML, 'NEW REQUEST'); assert.equal(store.runtime.ai, 'loading');
});
test('context guard discards a completed response if situation changed even without explicit cancellation', async () => {
  const nodes = new Map(); const node = selector => { if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', setAttribute() {}, querySelector: node, querySelectorAll: () => [] }); return nodes.get(selector); };
  const mount = { innerHTML: '', querySelector: node }; const store = { runtime: { ai: 'idle' } }; let current = true, resolve;
  openTeacher({ store, request: expansionRequest({ action: 'keyword_meaning' }), mount, isCurrent: () => current, service: { request: () => new Promise(done => { resolve = done; }) } });
  current = false; resolve({ mode: 'api', feedback: meaningFeedback }); await new Promise(done => setImmediate(done));
  assert.equal(mount.innerHTML, ''); assert.equal(store.runtime.ai, 'idle');
});
