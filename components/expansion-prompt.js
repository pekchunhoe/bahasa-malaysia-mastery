import { e, icon } from './ui.js';
import { tutorActions } from '../js/tutor-actions.js';

// A small visible utility inside a full 44px keyboard/touch target.
export function expansionActionPair(action, aiButton, { disabled = false } = {}) {
  return `<div class="expansion-ai-pair" role="group" aria-label="${e(tutorActions[action].label)}">${aiButton}<button type="button" class="mini-prompt-button" data-copy-expansion-prompt="${e(action)}" aria-label="Salin Prompt" title="Salin Prompt untuk digunakan dalam ChatGPT atau Gemini"${disabled ? ' disabled' : ''}>${icon('copy')}</button><span class="mini-prompt-feedback" data-prompt-copy-feedback role="status" aria-live="polite"></span></div>`;
}

const timers = new WeakMap();
export function promptCopyFeedback(button, message) {
  const feedback = button.closest('.expansion-ai-pair').querySelector('[data-prompt-copy-feedback]');
  button.setAttribute('aria-label', 'Salin Prompt');
  clearTimeout(timers.get(feedback));
  feedback.textContent = message;
  const timer = setTimeout(() => { if (feedback.isConnected) feedback.textContent = ''; }, 3500);
  timer.unref?.();
  timers.set(feedback, timer);
}
