// One speech owner for pupil writing, model essays, vocabulary and practice.
import { speechUnits } from './speech-text.js';
export const RATE_KEY = 'bmMastery:speechRate';
export const NATURAL_RATE = 0.95;
export const PARAGRAPH_PAUSE_MS = 180;
const language = voice => String(voice.lang || '').replaceAll('_', '-').toLowerCase();
export function selectMalayVoice(voices = []) {
  const rank = voice => {
    const lang = language(voice), name = String(voice.name || '');
    const locale = lang === 'ms-my' ? 3 : /^ms(?:-|$)/.test(lang) ? 2
      : (!lang || lang === 'und') && /\b(?:malay|bahasa melayu|bahasa malaysia)\b/i.test(name) ? 1 : 0;
    // These labels are hints, not a guarantee of a neural engine or audio quality.
    const quality = /\b(?:natural|neural)\b/i.test(name) ? 2 : /\b(?:enhanced|premium)\b/i.test(name) ? 1 : 0;
    return locale ? locale * 100 + quality * 10 + (voice.localService === true ? 2 : 0) + (voice.default ? 1 : 0) : 0;
  };
  const key = voice => `${language(voice)}|${voice.name || ''}|${voice.voiceURI || ''}`.toLowerCase();
  return [...voices].filter(voice => voice && rank(voice)).sort((a, b) =>
    rank(b) - rank(a) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))[0] || null;
}
export function createSpeechService({ environment = globalThis, onChange = () => {}, now = Date.now } = {}) {
  const synth = environment.speechSynthesis;
  let rate = 1, session = 0, current = null, job = null, speaking = false, paused = false, disposed = false;
  let selectedVoice = null, voiceListener = false, previousVoicesChanged;
  const notify = () => onChange({ speaking, paused, rate });
  const supported = () => !disposed && Boolean(synth && environment.SpeechSynthesisUtterance);
  const refreshVoices = () => {
    try { selectedVoice = selectMalayVoice(synth?.getVoices?.() || []); } catch { /* Keep the last discovered voice. */ }
  };
  const voicesChanged = event => { previousVoicesChanged?.call(synth, event); refreshVoices(); };
  if (supported()) {
    if (synth.addEventListener) synth.addEventListener('voiceschanged', voicesChanged);
    else { previousVoicesChanged = synth.onvoiceschanged; synth.onvoiceschanged = voicesChanged; }
    voiceListener = true;
    refreshVoices();
  }
  const clearGap = () => {
    if (job?.timer != null) {
      clearTimeout(job.timer);
      job.timer = null;
      job.remaining = Math.max(0, job.remaining - (now() - job.gapStarted));
    }
  };
  const stop = () => {
    session++;
    clearGap();
    job = current = null;
    speaking = paused = false;
    try { synth?.cancel(); } catch {}
    notify();
  };
  const fail = active => {
    if (job !== active) return;
    stop();
    active.onError();
  };
  const advance = active => {
    if (job !== active || session !== active.token || paused) return;
    if (active.index >= active.units.length) {
      job = current = null;
      speaking = paused = false;
      notify(); active.onEnd();
      return;
    }
    if (active.remaining > 0) {
      active.gapStarted = now();
      active.timer = setTimeout(() => {
        active.timer = null; active.remaining = 0; advance(active);
      }, active.remaining);
      return;
    }
    try {
      const unit = active.units[active.index];
      const utterance = new environment.SpeechSynthesisUtterance(unit.text);
      current = utterance;
      utterance.lang = active.voice && /^ms(?:-|$)/.test(language(active.voice))
        ? active.voice.lang.replaceAll('_', '-') : 'ms-MY';
      if (active.voice) utterance.voice = active.voice;
      utterance.rate = Number((NATURAL_RATE * rate).toFixed(4));
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => {
        if (job !== active || current !== utterance) return;
        current = null;
        active.index++;
        active.remaining = unit.paragraphEnd && active.index < active.units.length ? PARAGRAPH_PAUSE_MS : 0;
        advance(active);
      };
      utterance.onerror = () => { if (current === utterance) fail(active); };
      active.onSentence(active.index, unit.text);
      // A callback may stop or replace this session.
      if (job !== active) return;
      notify();
      if (job !== active) return;
      synth.speak(utterance);
    } catch { fail(active); }
  };
  try {
    const saved = Number(environment.localStorage?.getItem(RATE_KEY));
    if ([0.75, 1, 1.25].includes(saved)) rate = saved;
  } catch {}
  return {
    supported,
    availability() {
      refreshVoices();
      return { supported: supported(), malayVoice: language(selectedVoice || {}) === 'ms-my' };
    },
    stop,
    dispose() {
      stop(); disposed = true;
      if (voiceListener) {
        if (synth.removeEventListener) synth.removeEventListener('voiceschanged', voicesChanged);
        else if (synth.onvoiceschanged === voicesChanged) synth.onvoiceschanged = previousVoicesChanged;
        voiceListener = false;
      }
    },
    get rate() { return rate; },
    setRate(value) {
      rate = [0.75, 1, 1.25].includes(Number(value)) ? Number(value) : 1;
      try { environment.localStorage?.setItem(RATE_KEY, String(rate)); } catch {}
      // As before, speed changes apply at the next utterance without restarting.
      notify();
    },
    pause() {
      if (!speaking || paused) return false;
      try {
        if (current) synth.pause();
        clearGap(); paused = true; notify(); return true;
      } catch { stop(); return false; }
    },
    resume() {
      if (!paused) return false;
      try {
        synth.resume(); paused = false; notify();
        if (job && !current) advance(job);
        return true;
      } catch { stop(); return false; }
    },
    speak(text, { onSentence = () => {}, onEnd = () => {}, onError = () => {} } = {}) {
      const units = speechUnits(text);
      if (!supported() || !units.length) return false;
      const wasPaused = paused;
      stop(); refreshVoices();
      // Start immediately in the user's gesture even if voices are still loading.
      // Later voiceschanged events affect the NEXT passage, never this snapshot.
      const active = { token: session, units, voice: selectedVoice, index: 0, remaining: 0, timer: null, onSentence, onEnd, onError };
      job = active; speaking = true;
      try { if (wasPaused || synth.paused) synth.resume(); } catch { fail(active); return false; }
      advance(active);
      return speaking;
    },
  };
}
