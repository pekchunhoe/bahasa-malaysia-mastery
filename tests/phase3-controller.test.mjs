import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCurriculumPack } from '../js/curriculum-service.js';
import { createStore } from '../js/state.js';
import { STORAGE_KEY } from '../js/storage.js';

// Exercise the real app event handlers with a small DOM boundary double.
// This is controller coverage, not browser/visual/audio validation.
let instance = 0;
async function appHarness(t, { year = 1, activity = 'practice', storyTitle, savedStorage } = {}) {
  const values = new Map(), storage = savedStorage || { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const pack = getCurriculumPack(year), store = createStore({ storage });
  store.setYear(year); store.navigate(activity);
  if (storyTitle) {
    const draft = store.draft('story', storyTitle, pack);
    store.updateDraft(draft.id, { text: 'Tulisan lama.', lines: ['Sambungan lama.'] });
  }
  const nodes = new Map(), events = {}, spoken = [], requests = [];
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', value: '', dataset: {}, classList: { toggle() {} }, focus() {}, close() {}, remove() { this.removed = true; } });
    return nodes.get(selector);
  };
  const globals = {
    localStorage: storage,
    location: { hash: `#${activity}` },
    document: { querySelector: node, querySelectorAll: () => [], title: '' },
    window: { addEventListener: (name, callback) => { events[name] = callback; }, scrollTo() {} },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: { getVoices: () => [{ lang: 'ms-MY' }], speak: u => spoken.push(u), cancel() {} },
    fetch: (...args) => { requests.push(args); throw new Error('No network permitted'); },
  };
  const descriptors = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  t.after(() => {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  await import(`../js/app.js?controller=${++instance}`);
  const root = node('#app');
  const click = dataset => root.onclick({ target: { closest: () => ({ dataset, disabled: false }) } });
  const type = value => root.oninput({ target: { dataset: { draftField: 'text' }, value } });
  const state = () => JSON.parse(storage.getItem(STORAGE_KEY));
  return { root, node, click, type, state, spoken, requests, events, pack, storage };
}

test('real practice controllers check both years locally, replay, reveal and reset without Gemini or hint leakage', async t => {
  for (const year of [1, 4]) await t.test(`Tahun ${year}`, async t => {
    const h = await appHarness(t, { year }), item = h.pack.items[0];
    assert.ok(!h.root.innerHTML.includes(`<p>${item.text}</p>`));
    assert.ok(!h.root.innerHTML.includes('Lihat petunjuk'));
    h.click({ practicePlay: '' }); h.click({ practicePlay: '' });
    assert.equal(h.spoken.length, 2);
    assert.equal(h.spoken[1].text, item.text);
    h.spoken[1].onerror();
    assert.match(h.node('#practice-speech-status').textContent, /latihan visual/);
    h.type(item.text);
    h.click({ practiceCheck: '' });
    const originalId = h.state().activeDrafts[`${year}:practice`];
    assert.equal(h.state().practice[item.id].attempts, 1);
    assert.equal(h.state().practice[item.id].independentCorrect, true);
    assert.equal(h.state().drafts[originalId].text, item.text);
    h.click({ practiceReveal: '' });
    assert.match(h.root.innerHTML, /Jawapan rujukan/);
    h.click({ practiceReset: '' });
    assert.notEqual(h.state().activeDrafts[`${year}:practice`], originalId);
    assert.equal(h.state().drafts[originalId].text, item.text);
    assert.equal(h.state().practice[item.id].revealed, false);
    assert.equal(h.requests.length, 0);
  });
});

test('app resumes an unavailable legacy story without attaching the current first starter', async t => {
  const h = await appHarness(t, { activity: 'story', storyTitle: 'Pembuka lama yang tiada' });
  const draft = h.state().drafts[h.state().activeDrafts['1:story']];
  assert.equal(draft.contentId, '');
  assert.equal(draft.title, 'Pembuka lama yang tiada');
  assert.equal(draft.text, 'Tulisan lama.');
  assert.deepEqual(draft.lines, ['Sambungan lama.']);
  assert.match(h.root.innerHTML, /Pembuka cerita ini tidak tersedia/);
  assert.equal(Object.keys(h.state().drafts).length, 1);
});

test('app surface-check button preserves pupil text and explicitly limits its assessment', async t => {
  const h = await appHarness(t, { activity: 'sentence' });
  h.type('ali  membaca'); h.click({ localCheck: '' });
  assert.match(h.node('#local-feedback').innerHTML, /huruf besar/);
  assert.match(h.node('#local-feedback').innerHTML, /tanda baca/);
  assert.match(h.node('#local-feedback').innerHTML, /ruang berulang/);
  h.type('Saya ialah pergi.'); h.click({ localCheck: '' });
  assert.match(h.node('#local-feedback').innerHTML, /Makna dan tatabahasa belum dinilai/);
  assert.match(h.root.innerHTML, /bukan penilaian tatabahasa penuh/);
  assert.equal(h.state().drafts[h.state().activeDrafts['1:sentence']].text, 'Saya ialah pergi.');
  assert.equal(h.requests.length, 0);
});

test('controller reload restores original and revision after unit/theme navigation with zero network calls', async t => {
  const h = await appHarness(t, { year: 4, activity: 'expansion' });
  h.root.oninput({ target: { id: 'original-input', value: 'Ayat asal murid.', dataset: {} } });
  h.node('#original-input').value = 'Ayat asal murid.';
  h.click({ lockOriginal: '' });
  h.type('Ayat murid dengan butiran tambahan.');
  const id = h.state().activeDrafts['4:expansion'];
  h.root.onchange({ target: { id: 'unit-select', value: '2', dataset: {} } });
  assert.equal(h.state().drafts[id].itemId, h.pack.items[0].id);
  h.events.pagehide();
  const loaded = await appHarness(t, { year: 4, activity: 'expansion', savedStorage: h.storage });
  assert.match(loaded.root.innerHTML, /Ayat asal murid\./);
  assert.match(loaded.root.innerHTML, /Ayat murid dengan butiran tambahan\.<\/textarea>/);
  assert.equal(loaded.state().activeDrafts['4:expansion'], id);
  assert.equal(loaded.requests.length + h.requests.length, 0);
});

test('writing vocabulary filters preserve paragraph draft and practice hides focus again when typing', async t => {
  const h = await appHarness(t, { year: 4, activity: 'paragraph' });
  h.type('Perenggan milik murid.');
  h.root.onchange({ target: { id: 'unit-select', value: '3', dataset: {} } });
  h.root.onchange({ target: { id: 'theme-filter', value: h.pack.themes[0], dataset: {} } });
  assert.match(h.root.innerHTML, /Perenggan milik murid\.<\/textarea>/);
  assert.equal(h.state().unit, '3');
  assert.equal(h.requests.length, 0);
  const practice = await appHarness(t, { year: 4 });
  assert.ok(!practice.root.innerHTML.includes('data-practice-vocabulary'));
  practice.type('Percubaan saya.'); practice.click({ practiceCheck: '' });
  assert.ok(practice.root.innerHTML.includes('data-practice-vocabulary'));
  practice.type('Percubaan baharu.');
  assert.equal(practice.node('[data-practice-vocabulary]').removed, true);
  practice.click({ practiceReset: '' });
  assert.ok(!practice.root.innerHTML.includes('data-practice-vocabulary'));
  assert.equal(practice.requests.length, 0);
});
