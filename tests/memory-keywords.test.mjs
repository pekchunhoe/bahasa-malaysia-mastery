import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryHighlight, normalizeMemoryNotes, hydrateMemory, normalizeMemoryReview } from '../js/essay-memory.js';
import { memoryNotesSchema, buildMemoryPrompt, normalizeMemoryFeedback } from '../js/memory-tutor.js';
import { memorySentenceHTML, renderMemoryPoints, memoryNotesClipboard } from '../components/memory-notes.js';
import { copyRichText } from '../components/clipboard.js';
import { memoryFinal, renderEssayMemory } from '../activities/essay-memory.js';
import { createMemoryController } from '../js/memory-controller.js';
import { createTeacherHandler } from '../server/ai-handler.js';
import { createAIService } from '../js/ai-teacher.js';
import { memoryNotes, legacyMemoryNotes, memoryParagraphs, memoryInput, memoryReview } from './fixtures/essay-memory.mjs';

const point = changes => ({ primaryKeyword: 'Berkumpul', additionalKeywords: ['Dewan sekolah', 'Pagi Sabtu'],
  importantSentence: 'Kami berkumpul di dewan sekolah pada pagi Sabtu.', boldWord: 'berkumpul', ...changes });
const rawNotes = p => ({ paragraphs: [{ paragraphIndex: 1, heading: 'Persediaan', points: [p] }] });
const normalize = p => normalizeMemoryNotes(rawNotes(p), ['source'], { requireKeywords: true }).paragraphs[0].points[0];
function globals(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
}
test('new generation schema and prompt require multiple useful source cues and exactly one literal lexical word', () => {
  assert.deepEqual(memoryNotesSchema.properties.paragraphs.items.properties.points.items.required,
    ['primaryKeyword', 'additionalKeywords', 'importantSentence', 'boldWord']);
  assert.equal(memoryNotesSchema.properties.paragraphs.items.properties.points.maxItems, undefined);
  const prompt = buildMemoryPrompt(memoryInput('memory_points'));
  for (const text of ['TIADA sasaran, minimum atau maksimum tiga isi', 'sifar atau lebih', 'disokong oleh perenggan asal', 'Jangan pilih frasa', 'SATU kemunculan', 'tanpa Markdown']) assert.ok(prompt.includes(text), text);
  const review = buildMemoryPrompt(memoryInput('memory_review'));
  assert.match(review, /TIDAK perlu menggunakan perkataan tebal/);
  assert.match(review, /KESELURUHAN importantPoints/);
});
test('all content-driven point counts and zero, multiple or many cues survive without an artificial cap', () => {
  const notes = normalizeMemoryFeedback(memoryNotes, memoryInput('memory_points'));
  assert.deepEqual(notes.paragraphs.map(p => p.points.length), [1, 2, 3, 4, 5, 6]);
  for (const paragraph of notes.paragraphs) for (const p of paragraph.points) {
    assert.equal((memorySentenceHTML(p).match(/<strong>/g) || []).length, 1);
    assert.ok(memorySentenceHTML(p).includes(`<strong>${p.boldWord}</strong>`));
  }
  for (const additionalKeywords of [[], ['Dewan sekolah', 'Pagi Sabtu'], Array.from({ length: 20 }, (_, i) => `Petunjuk ${i}`)]) {
    const p = normalize(point({ additionalKeywords }));
    assert.deepEqual(p.additionalKeywords, additionalKeywords);
    assert.equal((memorySentenceHTML(p).match(/<strong>/g) || []).length, 1);
  }
  assert.deepEqual(normalize(point({ additionalKeywords: ['Dewan sekolah', 'dewan sekolah', 'Berkumpul', 'Pagi Sabtu'] })).additionalKeywords, ['Dewan sekolah', 'Pagi Sabtu']);
});
test('the three requested examples keep all supporting cues and one representative verb', () => {
  for (const p of [point(), point({ primaryKeyword: 'Pembahagian kumpulan', additionalKeywords: ['Guru kelas', 'Murid'],
    importantSentence: 'Guru kelas membahagikan kami kepada beberapa kumpulan.', boldWord: 'membahagikan' }),
  point({ primaryKeyword: 'Peralatan pembersihan', additionalKeywords: ['Penyapu', 'Penyodok', 'Kain buruk'],
    importantSentence: 'Kami menyediakan peralatan pembersihan sebelum memulakan aktiviti.', boldWord: 'menyediakan' })]) {
    const result = normalize(p);
    assert.deepEqual(result.additionalKeywords, p.additionalKeywords);
    assert.ok(memorySentenceHTML(result).includes(`<strong>${p.boldWord}</strong>`));
    assert.equal((memorySentenceHTML(result).match(/<strong>/g) || []).length, 1);
  }
});
test('new generations reject missing metadata, phrases, multiple words, substrings, absent words and function words', () => {
  for (const boldWord of ['', 'berkumpul di', '**berkumpul**', 'berkumpul menyediakan', 'kumpul', 'menyediakan', 'di', 'Kami'])
    assert.throws(() => normalize(point({ boldWord })), boldWord);
  for (const changes of [{ primaryKeyword: '' }, { additionalKeywords: 'Dewan' }, { additionalKeywords: [''] }, { importantSentence: '' },
    { importantSentence: 'Berkumpul.', boldWord: 'Berkumpul' }, { highlight: { start: 0, end: 4 } }]) assert.throws(() => normalize(point(changes)));
  assert.throws(() => normalizeMemoryFeedback(legacyMemoryNotes, memoryInput('memory_points')));
  const missingSentence = point(); delete missingSentence.importantSentence;
  assert.throws(() => normalize({ ...missingSentence, text: 'Kami berkumpul di dewan.' }));
});
test('repeated words select one occurrence, including an explicitly validated later occurrence', () => {
  const sentence = 'Kami berkumpul sebelum berkumpul semula.';
  const first = normalize(point({ importantSentence: sentence }));
  assert.deepEqual(first.highlight, { start: 5, end: 14 });
  const start = sentence.lastIndexOf('berkumpul');
  const later = normalize(point({ importantSentence: sentence, highlight: { start, end: start + 9 } }));
  assert.equal(memorySentenceHTML(later), 'Kami berkumpul sebelum <strong>berkumpul</strong> semula.');
});
test('Unicode letters, combining marks, punctuation, emoji offsets and Malay hyphenated words are lexical boundaries', () => {
  for (const [sentence, word] of [['Kami bergotong-royong di sekolah.', 'bergotong-royong'], ['Kami “berkumpul”, kemudian pulang.', 'berkumpul'],
    ['😊 Kami ke kafe café.', 'café'], ['Kami di cafe\u0301 itu.', 'cafe\u0301'], ['Kami bersorak riang‑ria.', 'riang‑ria']]) {
    const result = memoryHighlight(sentence, word);
    assert.ok(result, sentence); assert.equal(sentence.slice(result.start, result.end), word);
  }
  for (const [sentence, word] of [['Kami bergotong-royong.', 'royong'], ['Kami mengemasnya.', 'mengemas'], ['Kami melihat 1kata.', 'kata'], ['Kami di kafe café.', 'cafe']])
    assert.equal(memoryHighlight(sentence, word), null);
});
test('legacy sentences and invalid saved highlights remain ordinary escaped text without losing points', () => {
  const p = normalizeMemoryNotes(rawNotes({ text: 'Kami <b>berkumpul</b> di dewan.', cue: 'Dewan' }), ['source']).paragraphs[0].points[0];
  assert.equal(memorySentenceHTML(p), 'Kami &lt;b&gt;berkumpul&lt;/b&gt; di dewan.');
  const partial = normalizeMemoryNotes(rawNotes({ text: 'Kami berkumpul di dewan.', cue: 'Dewan', boldWord: 'berkumpul di' }), ['source']).paragraphs[0].points[0];
  assert.equal(partial.primaryKeyword, 'Dewan');
  assert.equal(memorySentenceHTML(partial), 'Kami berkumpul di dewan.');
  for (const changes of [{ boldWord: 'berkumpul di' }, { highlight: { start: 1, end: 4 } }, { boldWord: 'kumpul' }]) {
    const notes = normalizeMemoryNotes(rawNotes(point(changes)), ['source']);
    assert.equal(memorySentenceHTML(notes.paragraphs[0].points[0]), point().importantSentence);
  }
});
test('new and legacy notes, writing, feedback and source histories survive autosave hydration unchanged', () => {
  for (const notes of [memoryNotes, legacyMemoryNotes]) {
    const version = { source: { title: 'Hari Gotong-royong', paragraphs: memoryParagraphs }, notes, paragraph: 0, activity: 2, finalOpen: true,
      writing: memoryParagraphs.map(() => 'Tulisan murid sendiri.'), feedback: memoryParagraphs.map(() => null) };
    const notesKey = JSON.stringify(notes.paragraphs[0]);
    version.feedback[0] = { notesKey, writing: version.writing[0], result: normalizeMemoryReview(memoryReview(notes.paragraphs[0].points), notes.paragraphs[0].points) };
    const restored = hydrateMemory({ versions: [version, { ...structuredClone(version), source: { ...version.source, title: 'Versi lama' } }] });
    assert.deepEqual(restored.versions, [version, { ...version, source: { ...version.source, title: 'Versi lama' } }]);
  }
});
test('one compact keyword box per point contains supporting cues beside a normal-weight sentence', () => {
  const html = renderMemoryPoints(rawNotes(normalize(point())).paragraphs[0]);
  assert.match(html, /class="memory-keywords"><strong>Berkumpul<\/strong>/);
  assert.match(html, /class="memory-supporting">Dewan sekolah • Pagi Sabtu/);
  assert.match(html, /class="memory-sentence">Kami <strong>berkumpul<\/strong> di dewan sekolah pada pagi Sabtu\./);
});
const versionWithNotes = () => ({ source: { title: 'Hari Gotong-royong', paragraphs: memoryParagraphs }, notes: structuredClone(memoryNotes),
  writing: memoryParagraphs.map(() => 'JANGAN SALIN TULISAN INI'), feedback: [], paragraph: 0, activity: 0, finalOpen: true });
test('rich clipboard includes every paragraph and all 21 points in separate inline-styled two-column table rows', () => {
  const version = versionWithNotes();
  version.feedback = [{ result: 'JANGAN SALIN MAKLUM BALAS' }];
  const { html, text } = memoryNotesClipboard(version);
  assert.equal((html.match(/<table /g) || []).length, 6);
  assert.equal((html.match(/<tr>/g) || []).length, 21);
  const sentences = [...html.matchAll(/<td width="70%"[^>]*>(.*?)<\/td>/g)].map(m => m[1]);
  assert.equal(sentences.length, 21);
  for (const sentence of sentences) assert.equal((sentence.match(/<strong>/g) || []).length, 1);
  assert.match(html, /border:1px solid/); assert.match(html, /background-color:/); assert.match(html, /vertical-align:top/);
  assert.match(html, /font-weight:400/); assert.match(html, /width:30%/);
  let previous = -1;
  for (const paragraph of version.notes.paragraphs) {
    assert.ok(html.indexOf(`Perenggan ${paragraph.paragraphIndex} — ${paragraph.heading}`) > previous);
    previous = html.indexOf(`Perenggan ${paragraph.paragraphIndex} — ${paragraph.heading}`);
    for (const p of paragraph.points) {
      assert.ok(html.includes(p.primaryKeyword)); p.additionalKeywords.forEach(cue => assert.ok(html.includes(cue)));
      assert.ok(text.includes(p.importantSentence.replace(p.boldWord, `**${p.boldWord}**`)));
    }
  }
  assert.ok(!html.includes('JANGAN SALIN')); assert.ok(!text.includes('JANGAN SALIN'));
});
test('clipboard HTML escapes hostile title, headings, primary/supporting cues and every sentence segment', () => {
  const version = versionWithNotes(); version.source.title = '<img src=x onerror=alert(1)>';
  version.notes = rawNotes(normalize(point({ primaryKeyword: '<script>alert(1)</script>', additionalKeywords: ['<svg onload=alert(1)>', 'A & B'],
    importantSentence: 'Kami berkumpul <img src=x> & "pulang".' })));
  version.notes.paragraphs[0].heading = '<iframe src=x>';
  const { html } = memoryNotesClipboard(version);
  assert.ok(!/<(?:img|script|svg|iframe)\b/.test(html));
  for (const text of ['&lt;img', '&lt;script', '&lt;svg', '&lt;iframe', '&amp;', '&quot;']) assert.ok(html.includes(text), text);
  assert.match(html, /<strong>berkumpul<\/strong>/);
});
test('plain fallback has labelled memory cues and a single Markdown word, without fragile tables', () => {
  const version = versionWithNotes(); version.notes = rawNotes(normalize(point()));
  assert.equal(memoryNotesClipboard(version).text, 'Hari Gotong-royong\n\nPerenggan 1 — Persediaan\n\n[KATA KUNCI]\nBerkumpul | Dewan sekolah | Pagi Sabtu\n\nKami **berkumpul** di dewan sekolah pada pagi Sabtu.');
  assert.equal(memoryNotesClipboard({ ...version, notes: null }), null);
  version.notes = legacyMemoryNotes;
  assert.ok(!memoryNotesClipboard(version).html.includes('<strong>menyertai</strong>'));
});
test('notes-copy button sits beside essay copy and works before the pupil has reconstructed any paragraph', () => {
  const version = versionWithNotes(); version.writing.fill('');
  const html = memoryFinal(version);
  assert.match(html, /data-memory-action="copy" disabled/);
  assert.match(html, /Salin Karangan Akhir<\/button><button[^>]+data-memory-action="copy-notes" >📋 Salin Isi Penting/);
  assert.match(memoryFinal({ ...version, notes: null }), /data-memory-action="copy-notes" disabled/);
  const draft = { memory: { versions: [version] } };
  version.activity = 1;
  assert.ok(!renderEssayMemory({ memory: { draft, version, revealed: false } }).includes('class="memory-keywords"'));
  assert.ok(renderEssayMemory({ memory: { draft, version, revealed: true } }).includes('class="memory-keywords"'));
  version.activity = 2;
  assert.ok(!renderEssayMemory({ memory: { draft, version } }).includes('class="memory-points"'));
});
test('rich clipboard writes both MIME types and waits for completion', async t => {
  let done, items;
  class Item { constructor(data) { this.data = data; } }
  globals(t, { ClipboardItem: Item, navigator: { clipboard: { write: value => { items = value; return new Promise(resolve => { done = resolve; }); } } } });
  let complete = false;
  const result = copyRichText({ html: '<b>Nota</b>', text: 'Nota' }).then(value => { complete = true; return value; });
  await new Promise(setImmediate); assert.equal(complete, false);
  assert.equal(await items[0].data['text/html'].text(), '<b>Nota</b>');
  assert.equal(await items[0].data['text/plain'].text(), 'Nota');
  done(); assert.equal(await result, 'html');
});
test('missing rich API, missing ClipboardItem and rich permission denial use the same readable text fallback', async t => {
  const writes = [];
  globals(t, { ClipboardItem: class { constructor(data) { this.data = data; } }, navigator: {} });
  for (const clipboard of [{ writeText: async text => writes.push(text) },
    { write: async () => { throw Error('denied'); }, writeText: async text => writes.push(text) }]) {
    navigator.clipboard = clipboard;
    assert.equal(await copyRichText({ html: '<b>Nota</b>', text: 'Nota' }), 'text');
  }
  globalThis.ClipboardItem = undefined;
  navigator.clipboard = { write: async () => assert.fail('unsupported'), writeText: async text => writes.push(text) };
  assert.equal(await copyRichText({ html: '<b>Nota</b>', text: 'Nota' }), 'text');
  assert.deepEqual(writes, ['Nota', 'Nota', 'Nota']);
});
function controllerHarness(t, clipboard) {
  globals(t, { ClipboardItem: class { constructor(data) { this.data = data; } }, navigator: { clipboard },
    document: { createElement: () => ({ value: '', style: {}, setAttribute() {}, select() {}, remove() {} }), body: { append() {} }, execCommand: () => false } });
  const version = versionWithNotes();
  const draft = { id: 'draft', year: 3, activity: 'essay', title: version.source.title, paragraphs: memoryParagraphs, memory: { versions: [version] } };
  let saves = 0, calls = 0;
  const state = { year: 3, activity: 'memory', drafts: { draft }, activeDrafts: { '3:essay': 'draft' }, selectedEssayContent: {}, selectedEssayTitle: {} };
  const nodes = new Map();
  const dom = { querySelector: selector => { if (!nodes.has(selector)) nodes.set(selector, { textContent: '' }); return nodes.get(selector); } };
  const controller = createMemoryController({ store: { state, persist() { saves++; } }, ai: { request() { calls++; } }, document: dom, render() {} });
  controller.prepare();
  const attrs = new Map();
  const button = { dataset: { memoryAction: 'copy-notes' }, getAttribute: key => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value) };
  return { version, controller, button, status: dom.querySelector('[data-memory-notes-copy-status]'), counts: () => [calls, saves] };
}
test('controller copies all notes once, gives rich success only after the write and never saves, calls AI or changes writing', async t => {
  let done, calls = 0;
  const h = controllerHarness(t, { write: () => { calls++; return new Promise(resolve => { done = resolve; }); } });
  const before = structuredClone(h.version);
  h.controller.click(h.button); h.controller.click(h.button);
  assert.equal(calls, 1); assert.equal(h.status.textContent, '');
  done(); await new Promise(setImmediate);
  assert.equal(h.status.textContent, '✅ Isi penting berjaya disalin!');
  assert.deepEqual(h.version, before); assert.deepEqual(h.counts(), [0, 0]);
  assert.equal(h.button.getAttribute('aria-busy'), 'false');
});
test('controller reports text compatibility accurately and total failure never leaves a success message; retry works', async t => {
  const h = controllerHarness(t, { writeText: async () => {} });
  h.controller.click(h.button); await new Promise(setImmediate);
  assert.equal(h.status.textContent, '✅ Isi penting disalin dalam format teks. Format teks tidak dapat mengekalkan kotak berbingkai.');
  navigator.clipboard.writeText = async () => { throw Error('denied'); };
  h.controller.click(h.button); assert.equal(h.status.textContent, ''); await new Promise(setImmediate);
  assert.match(h.status.textContent, /Belum berjaya/); assert.ok(!h.status.textContent.includes('✅'));
  navigator.clipboard.writeText = async () => {};
  h.controller.click(h.button); await new Promise(setImmediate);
  assert.match(h.status.textContent, /✅ Isi penting disalin/);
});
test('server and service reject invalid new highlights without caching or extra requests, then allow explicit retry', async () => {
  let invalid = true, calls = 0;
  const handler = createTeacherHandler({ env: { GEMINI_API_KEY: 'private-fixture', GEMINI_FAST_MODEL: 'fixture' }, logger: { warn() {} },
    limiter: { acquire: () => () => {} }, generate: async () => {
      calls++; const notes = structuredClone(memoryNotes);
      if (invalid) notes.paragraphs[0].points[0].boldWord = 'menyertai gotong-royong';
      return JSON.stringify(notes);
    } });
  const service = createAIService({ fetcher: (url, init) => handler(new Request('http://localhost' + url, init)) });
  await assert.rejects(service.request(memoryInput('memory_points')), /tidak lengkap/);
  assert.equal(calls, 1); invalid = false;
  const result = await service.request(memoryInput('memory_points'));
  assert.deepEqual(result.feedback, memoryNotes); assert.equal(calls, 2);
  await service.request(memoryInput('memory_points')); assert.equal(calls, 2);
});
