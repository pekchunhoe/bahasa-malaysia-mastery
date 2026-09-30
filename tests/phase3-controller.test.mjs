import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCurriculumPack } from '../js/curriculum-service.js';
import { createStore } from '../js/state.js';
import { STORAGE_KEY } from '../js/storage.js';
import { toast } from '../components/ui.js';
import { actionActivities, buildExternalTutorPrompt } from '../js/tutor-actions.js';

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
  const nodes = new Map(), events = {}, spoken = [], requests = [], copied = [];
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', value: '', dataset: {}, attributes: {}, getAttribute(key) { return this.attributes[key] ?? null; }, setAttribute(key, value) { this.attributes[key] = value; }, classList: { toggle() {}, add() {}, remove() {} }, focus() {}, querySelector: node, showModal() { this.open = true; }, close() { this.open = false; this.onclose?.(); }, remove() { this.removed = true; } });
    return nodes.get(selector);
  };
  // Mirror the four real textarea values when the app renders a new title.
  let rendered = '';
  Object.defineProperty(node('#app'), 'innerHTML', { get: () => rendered, set(html) {
    rendered = html;
    for (const match of html.matchAll(/<textarea id="essay-paragraph-(\d)"[^>]*>([\s\S]*?)<\/textarea>/g)) {
      const editor = node(`#essay-paragraph-${match[1]}`);
      editor.dataset = { essayParagraph: match[1] };
      editor.value = match[2].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    }
  } });
  const globals = {
    localStorage: storage,
    location: { hash: `#${activity}` },
    document: { querySelector: node, querySelectorAll: () => [], title: '' },
    window: { addEventListener: (name, callback) => { events[name] = callback; }, scrollTo() {} },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: { getVoices: () => [{ lang: 'ms-MY' }], speak: u => spoken.push(u), cancel() {} },
    fetch: (...args) => { requests.push(args); throw new Error('No network permitted'); },
    navigator: { clipboard: { writeText: async text => { copied.push(text); } } },
  };
  const descriptors = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  t.after(() => {
    clearTimeout(toast.timer);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  await import(`../js/app.js?controller=${++instance}`);
  const root = node('#app');
  const click = dataset => root.onclick({ target: { closest: () => ({ dataset, disabled: false }) } });
  const type = value => {
    if (activity === 'essay') {
      const editor = node('#essay-paragraph-1'); editor.value = value;
      root.oninput({ target: editor });
    } else root.oninput({ target: { dataset: { draftField: 'text' }, value } });
  };
  const state = () => JSON.parse(storage.getItem(STORAGE_KEY));
  return { root, node, click, type, state, spoken, requests, events, pack, storage, copied };
}

test('paragraph controllers combine live edits, scope every AI action, restore titles and protect drafts on API failure', async t => {
  const h = await appHarness(t, { year: 4, activity: 'essay' });
  const values = ['Satu_MARKER.', 'Dua_MARKER.', 'Tiga_MARKER.', 'Empat_MARKER.'];
  const id = h.state().activeDrafts['4:essay'];
  const firstTitle = h.state().drafts[id].title;
  const firstContent = h.state().drafts[id].contentId;
  const setParagraph = (index, value, input = true) => {
    const area = h.node(`#essay-paragraph-${index}`); area.value = value;
    if (input) h.root.oninput({ target: area });
  };
  values.forEach((value, i) => {
    setParagraph(i + 1, value);
    assert.equal(h.node('#student-text').value, values.slice(0, i + 1).join('\n\n'));
  });
  setParagraph(3, 'Tiga_MARKER draf langsung', false);
  values[2] = 'Tiga_MARKER draf langsung';
  const settle = () => new Promise(resolve => setImmediate(resolve));
  for (let index = 1; index <= 4; index++) {
    for (const action of actionActivities.essay.filter(a => a !== 'essay_review')) {
      h.click({ ai: action, aiParagraph: String(index) });
      await settle();
      if (action === 'paragraph_review') {
        const prompt = h.node('#teacher-result').innerHTML;
        for (let i = 0; i < 4; i++) assert.equal(prompt.includes(values[i]), i < index);
      } else {
        const [url, options] = h.requests.at(-1);
        assert.equal(url, '/api/gemini');
        const request = JSON.parse(options.body);
        assert.equal(request.title, firstTitle);
        assert.equal(request.studentText, values[index - 1]);
        assert.deepEqual(request.previousParagraphs, values.slice(0, index - 1));
        for (let i = index; i < 4; i++) assert.ok(!options.body.includes(values[i]));
        assert.match(h.node('#teacher-result').innerHTML, /role="alert"/);
      }
      h.node('#modal').close();
      assert.deepEqual(h.state().drafts[id].paragraphs, values);
    }
  }
  // A cleared live textarea must never fall back to stale saved writing.
  setParagraph(3, '', false);
  h.click({ ai: 'essay_next_step', aiParagraph: '3' }); await settle();
  assert.equal(JSON.parse(h.requests.at(-1)[1].body).studentText, '');
  assert.equal(h.state().drafts[id].paragraphs[2], '');
  h.node('#modal').close();
  setParagraph(3, values[2]);
  h.click({ ai: 'essay_review' }); await settle();
  const fullPrompt = h.node('#teacher-result').innerHTML;
  for (const value of values) assert.ok(fullPrompt.includes(value));
  h.node('#modal').close();
  const nextTopic = h.pack.essayTopics.find(topic => topic.id !== firstContent);
  h.root.onchange({ target: { id: 'writing-topic-select', dataset: {}, value: nextTopic.id } });
  h.click({ ai: 'essay_next_step', aiParagraph: '2' }); await settle();
  const nextRequest = JSON.parse(h.requests.at(-1)[1].body);
  assert.equal(nextRequest.title, nextTopic.title);
  assert.equal(nextRequest.studentText, '');
  assert.deepEqual(nextRequest.previousParagraphs, ['']);
  h.node('#modal').close();
  h.root.onchange({ target: { id: 'writing-topic-select', dataset: {}, value: firstContent } });
  assert.deepEqual(h.state().drafts[id].paragraphs, values);
  const loaded = await appHarness(t, { year: 4, activity: 'essay', savedStorage: h.storage });
  assert.deepEqual(loaded.state().drafts[id].paragraphs, values);
  values.forEach((value, i) => assert.equal(loaded.node(`#essay-paragraph-${i + 1}`).value, value));
});

test('every paragraph Jana Prompt copies immediately from the same live source as AI, after edits, clearing and title changes', async t => {
  const h = await appHarness(t, { year: 4, activity: 'essay' });
  const values = ['LIVE_P1', 'LIVE_P2', 'LIVE_P3', 'FUTURE_P4'];
  const actions = actionActivities.essay.filter(action => action !== 'essay_review');
  const settle = () => new Promise(resolve => setImmediate(resolve));
  for (let index = 1; index <= 4; index++) for (const action of actions) {
    // Deliberately do not fire input/autosave events.
    values.forEach((value, i) => { h.node(`#essay-paragraph-${i + 1}`).value = value; });
    const button = h.node(`prompt-${action}-${index}`);
    button.textContent = 'Jana Prompt';
    button.dataset = { janaPrompt: action, promptParagraph: String(index) };
    const requestsBefore = h.requests.length, modalBefore = h.node('#modal').open;
    await h.root.onclick({ target: { closest: () => button } });
    assert.equal(h.requests.length, requestsBefore);
    assert.equal(h.node('#modal').open, modalBefore);
    assert.equal(button.textContent, 'Disalin ✓');
    const prompt = h.copied.at(-1), state = h.state(), draft = state.drafts[state.activeDrafts['4:essay']];
    assert.equal(prompt, buildExternalTutorPrompt({ action, activity: 'essay', year: 4, title: state.selectedEssayTitle[4],
      paragraphIndex: index, previousParagraphs: values.slice(0, index - 1), studentText: values[index - 1], stage: draft.stage }));
    for (let i = 0; i < 4; i++) assert.equal(prompt.includes(values[i]), i < index);
    assert.ok(!prompt.includes('karangan_contoh'));
    assert.deepEqual(draft.paragraphs, values);
    if (action !== 'paragraph_review') {
      h.click({ ai: action, aiParagraph: String(index) }); await settle();
      assert.equal(buildExternalTutorPrompt(JSON.parse(h.requests.at(-1)[1].body)), prompt);
      h.node('#modal').close();
    }
    // Repeated copying must use a new live value, even during confirmation.
    h.node(`#essay-paragraph-${index}`).value = 'EDIT_LIVE';
    await h.root.onclick({ target: { closest: () => button } });
    assert.ok(h.copied.at(-1).includes('EDIT_LIVE'));
    assert.ok(!h.copied.at(-1).includes(values[index - 1]));
    h.node(`#essay-paragraph-${index}`).value = '';
    await h.root.onclick({ target: { closest: () => button } });
    assert.ok(!h.copied.at(-1).includes('EDIT_LIVE'));
    assert.match(h.copied.at(-1), /Perenggan semasa belum bermakna/);
  }
  const current = h.state().selectedEssayContent[4];
  const next = h.pack.essayTopics.find(topic => topic.id !== current);
  h.root.onchange({ target: { id: 'writing-topic-select', dataset: {}, value: next.id } });
  for (const action of actions) {
    const button = h.node(`new-title-${action}`);
    button.dataset = { janaPrompt: action, promptParagraph: '3' };
    await h.root.onclick({ target: { closest: () => button } });
    assert.ok(h.copied.at(-1).includes(next.title));
    assert.ok(!h.copied.at(-1).includes('LIVE_P'));
    if (action !== 'paragraph_review') {
      h.click({ ai: action, aiParagraph: '3' }); await settle();
      const request = JSON.parse(h.requests.at(-1)[1].body);
      assert.equal(request.title, next.title);
      assert.equal(request.studentText, '');
      assert.deepEqual(request.previousParagraphs, ['', '']);
      h.node('#modal').close();
    }
  }
});

test('Karangan Lengkap copies the live combined essay with clean paragraph spacing and no draft mutation', async t => {
  const h = await appHarness(t, { year: 4, activity: 'essay' });
  assert.match(h.root.innerHTML, /data-copy-combined-essay/);
  assert.match(h.root.innerHTML, /aria-label="Salin Karangan Lengkap"/);
  const button = h.node('[data-copy-combined-essay]');
  button.textContent = 'Salin Karangan Lengkap';
  button.dataset = { copyCombinedEssay: '' };
  const values = ['P1 tulisan sendiri.', 'P2 versi awal.', 'P3 tulisan sendiri.', 'P4 penutup sendiri.'];
  values.forEach((value, i) => { h.node(`#essay-paragraph-${i + 1}`).value = value; });
  const before = structuredClone(h.state());
  await h.root.onclick({ target: { closest: () => button } });
  assert.equal(h.copied.at(-1), values.join('\n\n'));
  assert.equal(button.textContent, 'Disalin ✓');
  assert.deepEqual(h.state(), before);
  h.node('#essay-paragraph-3').value = 'P3 versi terkini.';
  await h.root.onclick({ target: { closest: () => button } });
  assert.equal(h.copied.at(-1), ['P1 tulisan sendiri.', 'P2 versi awal.', 'P3 versi terkini.', 'P4 penutup sendiri.'].join('\n\n'));
  assert.equal(button.textContent, 'Disalin ✓');
  h.node('#essay-paragraph-2').value = '';
  h.node('#essay-paragraph-4').value = '';
  await h.root.onclick({ target: { closest: () => button } });
  assert.equal(h.copied.at(-1), 'P1 tulisan sendiri.\n\nP3 versi terkini.');
  assert.ok(!h.copied.at(-1).includes('Perenggan'));
  assert.deepEqual(h.state(), before);
  values.forEach((_, i) => { h.node(`#essay-paragraph-${i + 1}`).value = ''; });
  const copies = h.copied.length;
  button.textContent = 'Salin Karangan Lengkap';
  button.disabled = false;
  await h.root.onclick({ target: { closest: () => button } });
  assert.equal(h.copied.length, copies);
  assert.equal(button.textContent, 'Salin Karangan Lengkap');
  assert.deepEqual(h.state(), before);
});

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

test('master writing controllers filter, select by ID, autosave, navigate back and reload all three activities', async t => {
  for (const activity of ['essay', 'paragraph', 'story']) await t.test(activity, async t => {
    const h = await appHarness(t, { year: 6, activity });
    const topic = h.pack.essayTopics[1];
    const previousId = h.state().activeDrafts[`6:${activity}`];
    h.type('Draf pertama disimpan.');
    h.root.onchange({ target: { dataset: { writingFilter: 'category' }, value: topic.category } });
    h.root.oninput({ target: { dataset: { writingFilter: 'query' }, value: topic.title } });
    assert.ok(h.node('#writing-topic-results').innerHTML.includes(topic.id));
    assert.equal(h.state().activeDrafts[`6:${activity}`], previousId);
    h.root.onchange({ target: { id: 'writing-topic-select', dataset: {}, value: topic.id } });
    h.type('Isi sendiri sebelum pembaikan.');
    h.root.oninput({ target: { dataset: { plan: 'p0' }, value: 'Rancangan saya.' } });
    const id = h.state().activeDrafts[`6:${activity}`];
    assert.notEqual(id, previousId);
    assert.equal(h.state().drafts[id].contentId, topic.id);
    assert.equal(h.state().drafts[previousId].text, 'Draf pertama disimpan.');
    if (activity === 'essay') h.click({ stage: '5' });
    else h.click({ saveWritingVersion: '' });
    h.type('Isi sendiri selepas pembaikan.');
    if (activity === 'story') h.click({ addStory: '' });
    // Native summary activation has no write handler; closing uses only DOM state.
    let focused = false;
    const details = { open: true, querySelector: () => ({ focus() { focused = true; } }) };
    const button = { dataset: { hideExample: '' }, closest: () => details };
    const beforeClose = JSON.stringify(h.state());
    h.root.onclick({ target: { closest: () => button } });
    assert.equal(details.open, false); assert.equal(focused, true);
    assert.equal(JSON.stringify(h.state()), beforeClose);
    globalThis.location.hash = '#vocabulary'; h.events.hashchange();
    globalThis.location.hash = `#${activity}`; h.events.hashchange();
    assert.equal(h.state().activeDrafts[`6:${activity}`], id);
    h.events.pagehide();
    const loaded = await appHarness(t, { year: 6, activity, savedStorage: h.storage });
    const saved = loaded.state().drafts[id];
    assert.equal(saved.revisions[0].text, 'Isi sendiri sebelum pembaikan.');
    assert.equal(activity === 'story' ? saved.lines[0] : saved.text, 'Isi sendiri selepas pembaikan.');
    assert.equal(saved.plan.p0, 'Rancangan saya.');
    assert.equal(loaded.state().writingFilters[`6:${activity}`].query, topic.title);
    assert.equal(loaded.state().activeDrafts[`6:${activity}`], id);
    assert.ok(!/<details[^>]*\bopen\b/.test(loaded.root.innerHTML));
    assert.equal(h.requests.length + loaded.requests.length, 0);
  });
});

test('old essay draft without selection metadata resumes instead of being replaced by first master title', async t => {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const store = createStore({ storage }), pack = getCurriculumPack(1);
  const old = store.draft('essay', 'Petang Bersama Rakan', pack);
  store.updateDraft(old.id, { text: 'Karangan lama milik saya.', stage: 3, plan: { p0: 'Isi lama.' } });
  const h = await appHarness(t, { activity: 'essay', savedStorage: storage });
  assert.equal(h.state().activeDrafts['1:essay'], old.id);
  assert.equal(h.state().drafts[old.id].contentId, 'demo-petang');
  assert.match(h.root.innerHTML, /Karangan lama milik saya\.<\/textarea>/);
  assert.equal(Object.keys(h.state().drafts).length, 1);
});

test('AI guidance preserves the complete pupil version before immediate revision in each writing activity', async t => {
  for (const activity of ['essay', 'paragraph', 'story']) await t.test(activity, async t => {
    const h = await appHarness(t, { year: 6, activity });
    if (activity === 'story') { h.type('Pembukaan saya.'); h.click({ addStory: '' }); }
    h.type('Tulisan sebelum bimbingan.');
    const id = h.state().activeDrafts[`6:${activity}`];
    const original = activity === 'story' ? 'Pembukaan saya.\n\nTulisan sebelum bimbingan.' : 'Tulisan sebelum bimbingan.';
    const action = activity === 'essay' ? 'essay_review' : activity === 'paragraph' ? 'paragraph_review' : 'sentence_check';
    h.click({ ai: action });
    assert.equal(h.state().drafts[id].revisions[0].text, original);
    assert.match(h.node('#writing-revisions').outerHTML, /Lihat versi tersimpan \(1\)/);
    h.node('#modal').close();
    h.click({ ai: action });
    assert.equal(h.state().drafts[id].revisions.length, 1, 'Repeated guidance does not duplicate an unchanged version');
    h.node('#modal').close();
    h.type('Tulisan selepas bimbingan.');
    h.events.pagehide();
    const loaded = await appHarness(t, { year: 6, activity, savedStorage: h.storage });
    assert.equal(loaded.state().drafts[id].revisions[0].text, original);
    assert.equal(loaded.state().drafts[id].text, 'Tulisan selepas bimbingan.');
    assert.deepEqual(loaded.state().drafts[id].lines, activity === 'story' ? ['Pembukaan saya.'] : []);
  });
});

test('automatic revision limit warns without deleting earlier versions or changing the current draft', async t => {
  const h = await appHarness(t, { activity: 'essay' });
  const id = h.state().activeDrafts['1:essay'];
  for (let i = 0; i < 20; i++) { h.type(`Versi ${i}.`); h.click({ saveWritingVersion: '' }); }
  const revisions = h.state().drafts[id].revisions;
  h.type('Tulisan semasa yang belum diarkibkan.');
  h.click({ ai: 'essay_review' });
  assert.match(h.node('#toast').textContent, /penuh.*Muat turun draf/);
  h.node('#modal').close();
  h.node('#toast').textContent = '';
  h.click({ stage: '5' });
  assert.match(h.node('#toast').textContent, /penuh.*Muat turun draf/);
  assert.deepEqual(h.state().drafts[id].revisions, revisions);
  assert.equal(h.state().drafts[id].text, 'Tulisan semasa yang belum diarkibkan.');
});

test('year changes and empty filters preserve active drafts across all six years and writing activities', async t => {
  for (const activity of ['essay', 'paragraph', 'story']) await t.test(activity, async t => {
    const h = await appHarness(t, { activity }), ids = [];
    const changeYear = year => {
      h.root.onchange({ target: { id: 'year-select', value: String(year), dataset: {} } });
      h.node('#accept-confirm').onclick();
    };
    for (let year = 1; year <= 6; year++) {
      if (year !== 1) changeYear(year);
      h.type(`Tulisan Tahun ${year}.`);
      ids.push(h.state().activeDrafts[`${year}:${activity}`]);
      h.root.oninput({ target: { dataset: { writingFilter: 'query' }, value: 'no-such-title-000' } });
      assert.match(h.node('#writing-topic-results').innerHTML, /Tiada tajuk sepadan/);
      h.click({ resetWritingFilters: '' });
      assert.equal(h.state().drafts[ids[year - 1]].text, `Tulisan Tahun ${year}.`);
    }
    assert.equal(new Set(ids).size, 6);
    for (let year = 5; year >= 1; year--) {
      changeYear(year);
      assert.equal(h.state().activeDrafts[`${year}:${activity}`], ids[year - 1]);
      assert.equal(h.state().drafts[ids[year - 1]].text, `Tulisan Tahun ${year}.`);
    }
  });
});
