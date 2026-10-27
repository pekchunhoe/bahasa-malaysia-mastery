import { e, toast } from "./ui.js";
import { tutorActions } from "../js/tutor-actions.js";
import { copyWithConfirmation } from "./clipboard.js";

export function exampleCards(examples, request) {
  let sentenceNumber = 0;
  return examples.map((example, index) => {
    const label = example.type === 'improvedParagraph' ? 'Contoh perenggan yang dipertingkat'
      : example.type === 'paragraph' ? 'Contoh perenggan' : `Contoh ayat ${++sentenceNumber}`;
    const context = `${tutorActions[request.action].label}${request.paragraphIndex ? ` — Perenggan ${request.paragraphIndex}` : ''}`;
    return `<div class="ai-example-sentence"><div class="ai-example-text"><h4>${label}</h4><p>${e(example.text)}</p></div><button class="small-button" type="button" data-copy-example="${index}" aria-label="Salin ${label.toLowerCase()} — ${e(context)}" aria-live="polite">Salin</button></div>`;
  }).join('');
}
export function attachExampleCopyButtons(result, examples) {
  result.querySelectorAll("[data-copy-example]").forEach((button) => {
    const sentence = examples[Number(button.dataset.copyExample)];
    button.onclick = async () => {
      try {
        await copyWithConfirmation(button, sentence);
      } catch {
        toast("Tidak dapat menyalin sekarang. Cuba lagi.");
      }
    };
  });
}
