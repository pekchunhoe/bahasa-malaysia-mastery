import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechService, selectMalayVoice, NATURAL_RATE, PARAGRAPH_PAUSE_MS, RATE_KEY } from '../js/speech-service.js';
import { speechUnits } from '../js/speech-text.js';

function harness(t, voices = [{ lang: 'ms-MY', name: 'Malay' }]) {
  let clock = 0;
  const calls = [], statuses = [], events = new Map(), saved = new Map();
  const synth = { voices, paused: false, cancels: 0, additions: 0,
    getVoices() { return this.voices; },
    speak: utterance => calls.push(utterance),
    cancel() { this.cancels++; },
    pause() { this.paused = true; }, resume() { this.paused = false; },
    addEventListener(name, callback) { this.additions++; events.set(name, callback); },
    removeEventListener(name, callback) { assert.equal(events.get(name), callback); events.delete(name); },
  };
  const environment = { speechSynthesis: synth, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } };
  const speech = createSpeechService({ environment, now: () => clock, onChange: status => statuses.push(status) });
  t.after(() => speech.dispose());
  return { synth, calls, statuses, saved, speech, environment, changed: () => events.get('voiceschanged')?.(), events,
    tick(ms) { clock += ms; t.mock.timers.tick(ms); } };
}

test('voice ranking prioritizes locale then quality hints, with stable cross-platform tie breaking', () => {
  const voices = [
    { name: 'English Natural', lang: 'en-US', default: true },
    { name: 'Malay Premium', lang: 'ms-SG', localService: true },
    { name: 'Malay Basic', lang: 'ms-MY', default: true },
    { name: 'Malay Enhanced', lang: 'ms_MY', localService: true },
    { name: 'Malay Natural', lang: 'ms-MY', localService: false },
  ];
  assert.equal(selectMalayVoice(voices), voices[4]);
  assert.equal(selectMalayVoice([...voices].reverse()), voices[4]);
  assert.equal(selectMalayVoice(voices.slice(0, 4)), voices[3]);
  assert.equal(selectMalayVoice(voices.slice(0, 3)), voices[2]);
  assert.equal(selectMalayVoice(voices.slice(0, 2)), voices[1]);
  assert.equal(selectMalayVoice(voices.slice(0, 1)), null);
  const local = { name: 'Malay A', lang: 'ms-MY', localService: true };
  assert.equal(selectMalayVoice([{ ...local, localService: false }, local]), local);
  const a = { name: 'Malay A', lang: 'ms-MY' }, z = { name: 'Malay Z', lang: 'ms-MY' };
  assert.equal(selectMalayVoice([z, a]), a); assert.equal(selectMalayVoice([a, z]), a);
  assert.equal(selectMalayVoice([{ lang: '', name: 'Bahasa Melayu' }]).name, 'Bahasa Melayu');
  assert.equal(selectMalayVoice([{ lang: 'ml-IN', name: 'Malayalam' }]), null);
  assert.equal(selectMalayVoice([{ lang: 'en-US', name: 'Malay' }]), null);
});

test('late voices load once and never switch or restart an active passage', t => {
  const h = harness(t, []);
  assert.equal(h.speech.availability().malayVoice, false);
  assert.equal(h.speech.speak('Ayat pertama. Ayat kedua?'), true);
  assert.equal(h.calls[0].voice, undefined); assert.equal(h.calls[0].lang, 'ms-MY');
  const voice = { name: 'Malay Natural', lang: 'ms-MY' };
  h.synth.voices = [voice]; h.changed(); h.changed();
  assert.equal(h.calls.length, 1);
  assert.equal(h.speech.availability().malayVoice, true);
  h.calls[0].onend(); assert.equal(h.calls[1].voice, undefined);
  h.speech.speak('Bacaan baharu. Ayat seterusnya.');
  const first = h.calls.at(-1); assert.equal(first.voice, voice);
  h.synth.voices = [{ ...voice, name: 'Another Natural', localService: true }]; h.changed();
  first.onend(); assert.equal(h.calls.at(-1).voice, voice);
  assert.equal(h.synth.additions, 1);
  h.speech.dispose(); assert.equal(h.events.size, 0);
  assert.equal(h.speech.speak('Selepas lupus.'), false);
});

test('legacy voice event property is preserved and restored on disposal', () => {
  let previousCalls = 0, voiceCalls = 0;
  const previous = () => previousCalls++;
  const synth = { onvoiceschanged: previous, getVoices: () => { voiceCalls++; return []; }, cancel() {} };
  const speech = createSpeechService({ environment: { speechSynthesis: synth, SpeechSynthesisUtterance: class {} } });
  synth.onvoiceschanged({}); assert.equal(previousCalls, 1); assert.equal(voiceCalls, 2);
  speech.dispose(); assert.equal(synth.onvoiceschanged, previous);
});

test('Malay speech units retain questions, exclamations, quotes, punctuation and paragraph boundaries without changing source', () => {
  const text = 'Pada hari Ahad, saya dan keluarga pergi ke pantai.\r\n\r\n“Wah, cantiknya pemandangan ini!” kata adik.\r\n\r\nAdakah kamu mahu bermain bersama-sama?';
  assert.deepEqual(speechUnits(text), [
    { text: 'Pada hari Ahad, saya dan keluarga pergi ke pantai.', paragraphEnd: true },
    { text: '“Wah, cantiknya pemandangan ini!” kata adik.', paragraphEnd: true },
    { text: 'Adakah kamu mahu bermain bersama-sama?', paragraphEnd: true },
  ]);
  assert.ok(text.includes('\r\n\r\n')); assert.ok(text.includes('“'));
  const punctuation = "Dr. Ali membawa RM3.50; En. Ahmad berkata: ‘Mari bermain bersama-sama!’";
  assert.equal(speechUnits(punctuation).map(unit => unit.text).join(' '), punctuation);
  assert.equal(speechUnits('Dr. Ali datang. A. Rahman menyapa.').length, 2);
  assert.deepEqual(speechUnits('Baris tanpa tanda\nbaris sambungan\n\nAkhir'), [
    { text: 'Baris tanpa tanda baris sambungan', paragraphEnd: true }, { text: 'Akhir', paragraphEnd: true },
  ]);
  assert.equal(speechUnits("Kata d’Adik, café dan kanak-kanak.")[0].text, "Kata d’Adik, café dan kanak-kanak.");
  assert.deepEqual(speechUnits(' \n\t '), []);
});

test('normal rate is conservative, controls persist as before and pitch never changes with sentence type or speed', t => {
  const h = harness(t);
  h.speech.speak('Saya bersedia. Adakah kamu bersedia? Wah, cantik!');
  assert.equal(h.calls[0].rate, 0.95);
  h.speech.setRate(1.25); assert.equal(h.calls[0].rate, 0.95);
  h.calls[0].onend(); assert.equal(h.calls[1].rate, 1.1875);
  h.speech.setRate(0.75); h.calls[1].onend(); assert.equal(h.calls[2].rate, 0.7125);
  for (const utterance of h.calls) { assert.equal(utterance.pitch, 1); assert.equal(utterance.volume, 1); }
  assert.equal(h.saved.get(RATE_KEY), '0.75');
  assert.equal(h.calls[1].text, 'Adakah kamu bersedia?'); assert.equal(h.calls[2].text, 'Wah, cantik!');
  h.speech.setRate(99); assert.equal(h.speech.rate, 1); assert.equal(NATURAL_RATE, 0.95);
});

test('paragraph gap is brief, pause freezes it, resume continues, and stop/replay clear pending speech', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(t), starts = [];
  let ended = 0;
  h.speech.speak('Ayat satu. Ayat dua.\n\nPerenggan baharu!', { onSentence: (index, text) => starts.push([index, text]), onEnd: () => ended++ });
  h.calls[0].onend(); assert.equal(h.calls.length, 2, 'no added sentence delay');
  h.calls[1].onend(); assert.equal(h.calls.length, 2);
  h.tick(80); assert.equal(h.speech.pause(), true);
  h.tick(1000); assert.equal(h.calls.length, 2);
  assert.equal(h.statuses.at(-1).paused, true);
  h.speech.resume(); h.tick(PARAGRAPH_PAUSE_MS - 81); assert.equal(h.calls.length, 2);
  h.tick(1); assert.equal(h.calls.length, 3);
  assert.deepEqual(starts.map(([i]) => i), [0, 1, 2]);
  h.calls[2].onend(); assert.equal(ended, 1); assert.equal(h.statuses.at(-1).speaking, false);
  h.speech.speak('Mula.\n\nHantu.'); const stale = h.calls.at(-1); stale.onend();
  h.speech.stop(); h.tick(1000); assert.equal(h.calls.at(-1), stale);
  h.speech.speak('Mula.\n\nHantu.'); const replay = h.calls.at(-1);
  assert.equal(replay.text, 'Mula.'); stale.onend(); stale.onerror();
  assert.equal(h.calls.at(-1), replay); assert.equal(h.statuses.at(-1).speaking, true);
});

test('pause at an end-event boundary does not launch another utterance until resumed', t => {
  const h = harness(t);
  h.speech.speak('Mula. Kemudian.'); const first = h.calls[0];
  h.speech.pause(); first.onend(); assert.equal(h.calls.length, 1);
  assert.equal(h.statuses.at(-1).paused, true);
  h.speech.resume(); assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].text, 'Kemudian.');
  first.onerror(); assert.equal(h.statuses.at(-1).speaking, true);
  h.speech.pause(); h.speech.speak('Ulang.'); assert.equal(h.synth.paused, false);
  assert.equal(h.calls.at(-1).text, 'Ulang.');
});

test('errors clear state; repeated playback cancels previous sessions and callbacks cannot cause ghost speech', t => {
  const h = harness(t);
  let errors = 0;
  h.speech.speak('Lama. Sambungan.', { onError: () => errors++ }); const old = h.calls[0];
  h.speech.speak('Baharu.'); old.onend(); old.onerror();
  assert.equal(h.calls.length, 2); assert.equal(errors, 0);
  h.calls[1].onerror(); assert.equal(h.statuses.at(-1).speaking, false);
  h.speech.speak('Jangan mula.', { onSentence: () => h.speech.stop() }); assert.equal(h.calls.length, 2);
  h.synth.getVoices = () => { throw new Error('unavailable'); };
  assert.doesNotThrow(() => h.speech.speak('Masih boleh cuba.'));
  h.synth.speak = () => { throw new Error('failed'); };
  assert.equal(h.speech.speak('Ralat.', { onError: () => errors++ }), false);
  assert.equal(errors, 1); assert.equal(h.statuses.at(-1).speaking, false);
});
