// Adapted from the source's single speech owner and cancellable sentence sequence.
import { sentences } from "./learning-service.js";
export const RATE_KEY = "bmMastery:speechRate";
export function selectMalayVoice(voices = []) {
  const lang = (voice) =>
    String(voice.lang || "")
      .replaceAll("_", "-")
      .toLowerCase();
  return (
    voices.find((v) => lang(v) === "ms-my") ||
    voices.find((v) => /^ms(?:-|$)/.test(lang(v))) ||
    null
  );
}
export function createSpeechService({
  environment = globalThis,
  onChange = () => {},
} = {}) {
  let rate = 1,
    session = 0,
    current = null,
    speaking = false,
    paused = false;
  const notify = () => onChange({ speaking, paused, rate });
  const supported = () =>
    Boolean(
      environment.speechSynthesis && environment.SpeechSynthesisUtterance,
    );
  const stop = () => {
    session++;
    current = null;
    speaking = paused = false;
    try {
      environment.speechSynthesis?.cancel();
    } catch {}
    notify();
  };
  try {
    const saved = Number(environment.localStorage?.getItem(RATE_KEY));
    if ([0.75, 1, 1.25].includes(saved)) rate = saved;
  } catch {}
  return {
    supported,
    availability() {
      let voices = [];
      try { voices = environment.speechSynthesis?.getVoices?.() || []; } catch {}
      return { supported: supported(), malayVoice: voices.some(v => /^ms[-_]MY$/i.test(v.lang)) };
    },
    stop,
    get rate() {
      return rate;
    },
    setRate(value) {
      rate = [0.75, 1, 1.25].includes(Number(value)) ? Number(value) : 1;
      try {
        environment.localStorage?.setItem(RATE_KEY, String(rate));
      } catch {}
      notify();
    },
    pause() {
      try {
        if (!speaking || paused) return false;
        environment.speechSynthesis.pause();
        paused = true;
        notify();
        return true;
      } catch {
        stop();
        return false;
      }
    },
    resume() {
      try {
        if (!paused) return false;
        environment.speechSynthesis.resume();
        paused = false;
        notify();
        return true;
      } catch {
        stop();
        return false;
      }
    },
    speak(
      text,
      { onSentence = () => {}, onEnd = () => {}, onError = () => {} } = {},
    ) {
      const parts = sentences(text);
      if (!supported() || !parts.length) return false;
      stop();
      const token = session;
      let index = 0;
      const advance = () => {
        if (token !== session) return;
        if (index >= parts.length) {
          speaking = paused = false;
          current = null;
          notify();
          onEnd();
          return;
        }
        try {
          const utterance = new environment.SpeechSynthesisUtterance(
            parts[index],
          );
          current = utterance;
          utterance.lang = "ms-MY";
          utterance.rate = rate;
          const voice = selectMalayVoice(
            environment.speechSynthesis.getVoices?.() || [],
          );
          if (voice) utterance.voice = voice;
          utterance.onend = () => {
            if (session !== token || current !== utterance) return;
            index++;
            advance();
          };
          utterance.onerror = () => {
            if (session !== token) return;
            stop();
            onError();
          };
          speaking = true;
          paused = false;
          onSentence(index, parts[index]);
          notify();
          environment.speechSynthesis.speak(utterance);
        } catch {
          stop();
          onError();
        }
      };
      advance();
      return speaking;
    },
  };
}
