import { e, list, showModal, toast } from "./ui.js";
import { provenanceLabel } from "./enrichment.js";
import { hasMeaningfulStudentText, tutorActions } from "../js/tutor-actions.js";
import { copyWithConfirmation } from './clipboard.js';
import { exampleCards, attachExampleCopyButtons } from './ai-examples.js';
import { renderExpansionFeedback } from './expansion-ai.js';

function essayHint(feedback, hasDraft, request) {
  const examples = exampleCards(feedback.examples.map(text => ({ type: 'sentence', text })), request);
  return `<section class="ai-hint-result"><h3>Petunjuk untuk kamu</h3><p>${e(feedback.summary)}</p><h4>${hasDraft ? "Kamu boleh sambung dengan..." : "Idea yang boleh kamu pilih"}</h4>${feedback.suggestions.length ? list(feedback.suggestions) : "<p>Pilih satu idea yang paling sesuai dengan tulisan kamu.</p>"}${feedback.questions.length ? `<h4>Cuba fikirkan</h4>${list(feedback.questions)}` : ""}<h4>Contoh ayat</h4><div class="ai-example-list">${examples || "<p>Belum ada contoh ayat. Cuba pilih satu idea dahulu.</p>"}</div><p class="small muted">Contoh ini untuk kamu ubah suai. Tulisan kamu tidak diisi atau diganti secara automatik.</p></section>`;
}

function paragraphHint(feedback, request) {
  const example = feedback.example?.trim();
  const examples = example ? exampleCards([{ type: 'sentence', text: example }], request) : '';
  return `<section class="ai-hint-result"><h3>Petunjuk</h3><p class="guidance-summary">${e(feedback.summary)}</p>${feedback.errors.length ? `<h4>Perkara yang perlu diperhatikan</h4>${list(feedback.errors)}` : ''}${feedback.suggestions.length ? `<h4>Cadangan untuk kamu</h4>${list(feedback.suggestions)}` : ''}${feedback.explanation ? `<p>${e(feedback.explanation)}</p>` : ''}${examples ? `<h4>Contoh ayat</h4><div class="ai-example-list">${examples}</div>` : ''}<p class="small muted">Contoh ini untuk kamu ubah suai. Tulisan kamu tidak diisi atau diganti secara automatik.</p></section>`;
}

export function openTeacher({ service, request, store, mount, isCurrent = () => true, triggerButton }) {
  const controller = new AbortController();
  const prefix = mount ? 'meaning-' : '';
  const resultId = `${prefix}teacher-result`, runId = `${prefix}teacher-run`, promptId = `${prefix}teacher-prompt`;
  const cancel = () => {
    if (controller.signal.aborted) return;
    controller.abort();
    store.runtime.ai = 'idle';
    if (triggerButton) triggerButton.disabled = false;
  };
  const context = request.activity === 'expansion'
    ? `<p class="small preserve"><strong>Kata kunci:</strong> ${e(request.keyword)}<br><strong>Situasi:</strong> ${e(request.situation || 'Belum dipilih.')}</p>` : '';
  const content = `<p class="muted">Tahun ${request.year} &middot; ${e(request.title || 'Bank Kata & Frasa')}</p>${context}<details class="student-reference"${mount ? '' : ' open'}><summary>${request.paragraphIndex ? `Perenggan ${request.paragraphIndex} &middot; Tulisan kamu` : 'Tulisan / perkataan kamu'}</summary><p class="preserve">${e(request.studentText || 'Belum ada tulisan.')}</p></details>${request.previousParagraphs?.length ? `<details class="student-reference"><summary>Perenggan terdahulu</summary>${request.previousParagraphs.map((text, i) => `<h4>Perenggan ${i + 1}</h4><p class="preserve">${e(text || 'Belum ada tulisan.')}</p>`).join('')}</details>` : ''}<div id="${resultId}" aria-live="polite"></div><div class="actions"><button type="button" class="button primary" id="${runId}">${mount ? 'Cuba lagi' : e(tutorActions[request.action].label)}</button><button type="button" class="button" id="${promptId}">Jana prompt</button></div><p class="small muted">Prompt dijana pada peranti ini. Tiada panggilan AI dibuat apabila kamu memilih Jana prompt.</p>`;
  let modal;
  if (mount) {
    mount.innerHTML = `<details class="enrichment keyword-meaning-card" open><summary>Maksud Kata Kunci: ${e(request.keyword)}</summary>${content}</details>`;
    modal = mount;
  } else modal = showModal('Cikgu AI', content, cancel);
  const cleanup = () => {
    if (controller.signal.aborted) return;
    cancel();
    if (mount) mount.innerHTML = '';
    else if (modal.open) modal.close();
  };
  const current = () => !controller.signal.aborted && isCurrent();
  const result = modal.querySelector(`#${resultId}`), run = modal.querySelector(`#${runId}`), promptButton = modal.querySelector(`#${promptId}`);
  const execute = async (mode) => {
    if (store.runtime.ai === "loading") return;
    store.runtime.ai = "loading";
    run.disabled = promptButton.disabled = true;
    if (triggerButton) triggerButton.disabled = true;
    result.innerHTML = `<p class="loading">${request.action === "essay_next_step" ? "Menyediakan petunjuk…" : "Menyediakan bimbingan…"}</p>`;
    try {
      const response = await service.request(request, {
        signal: controller.signal,
        mode,
      });
      if (controller.signal.aborted) return;
      if (!isCurrent()) { cleanup(); return; }
      if (response.mode === "prompt") {
        result.innerHTML = `<div class="notice">Prompt siap. Salin dan gunakan dengan pembimbing AI pilihan bersama guru atau penjaga. Semak cadangan sebelum membaiki tulisan sendiri.</div><label class="field">Prompt bimbingan<textarea id="generated-prompt" rows="10" readonly>${e(response.prompt)}</textarea></label><button class="button primary" id="copy-prompt">Salin prompt</button>`;
        result.querySelector("#copy-prompt").onclick = async () => {
          try {
            await navigator.clipboard.writeText(response.prompt);
            toast("Prompt disalin.");
          } catch {
            const area = result.querySelector("textarea");
            area.focus();
            area.select();
            toast("Pilih Salin pada peranti kamu untuk menyalin prompt.");
          }
        };
      } else {
        const f = response.feedback;
        if (request.activity === 'expansion') {
          result.innerHTML = `<p class="source-label">${e(provenanceLabel(response))}</p>${renderExpansionFeedback(f, request)}`;
          attachExampleCopyButtons(result, f.kind === 'keyword_meaning' ? [f.contoh_ayat] : f.examples.map(example => example.text));
        } else if (f.kind === "essay_hint") {
          result.innerHTML = `<p class="source-label">${e(provenanceLabel(response))}</p>${essayHint(f, hasMeaningfulStudentText(request.studentText), request)}`;
          attachExampleCopyButtons(result, f.examples);
        } else if (f.kind === 'essay_examples' || f.kind === 'essay_vivid') {
          const vivid = f.kind === 'essay_vivid';
          const examples = [...(vivid && f.improvedParagraph ? [{ type: 'improvedParagraph', text: f.improvedParagraph }] : []), ...f.examples];
          result.innerHTML = `<p class="source-label">${e(provenanceLabel(response))}</p><section class="ai-hint-result"><h3>${vivid ? e(tutorActions[request.action].label) : 'Cadangan untuk kamu'}</h3><p>${e(f.summary)}</p>${f.suggestions.length ? list(f.suggestions) : ''}<div class="ai-example-list">${exampleCards(examples, request)}</div><p class="small muted">Contoh ini ialah pilihan untuk kamu ubah suai. Gunakan hanya butiran yang benar bagi cerita kamu. Tulisan kamu tidak diisi atau diganti secara automatik.</p></section>`;
          attachExampleCopyButtons(result, examples.map(example => example.text));
        } else {
          const isParagraphHint = request.action === 'sentence_hint' && request.paragraphIndex;
          result.innerHTML = `<p class="source-label">${e(provenanceLabel(response))}</p>${isParagraphHint ? paragraphHint(f, request) : `<h3>${e(f.summary)}</h3><h4>Kesalahan yang perlu dibetulkan</h4>${f.errors.length ? list(f.errors) : "<p>Tiada kesalahan khusus dilaporkan.</p>"}<h4>Cadangan untuk menjadikan ayat lebih baik</h4>${f.suggestions.length ? list(f.suggestions) : "<p>Tiada cadangan tambahan.</p>"}<p>${e(f.explanation)}</p>${f.example ? `<div class="notice"><strong>Contoh AI — bukan jawapan untuk disalin</strong><p>${e(f.example)}</p></div>` : ""}<p class="small muted">Cadangan kata AI bukan data kurikulum rasmi.</p>`}`;
          if (isParagraphHint && f.example?.trim()) attachExampleCopyButtons(result, [f.example.trim()]);
        }
      }
      store.runtime.ai = "ready";
    } catch (error) {
      if (current()) {
        result.innerHTML = `<p class="error" role="alert">${e(request.action === "essay_next_step" ? "Cikgu AI belum dapat memberikan petunjuk sekarang. Cuba sekali lagi." : error.message)}</p>`;
        store.runtime.ai = "error";
      }
    } finally {
      if (current()) {
        run.disabled = promptButton.disabled = false;
        if (triggerButton) triggerButton.disabled = false;
      }
    }
  };
  run.onclick = () => execute();
  promptButton.setAttribute('aria-live', 'polite');
  promptButton.setAttribute('aria-label', `Jana Prompt — ${tutorActions[request.action].label}${request.paragraphIndex ? ` — Perenggan ${request.paragraphIndex}` : ''}`);
  promptButton.onclick = () => request.paragraphIndex
    ? copyWithConfirmation(promptButton, service.externalPrompt(request)).catch(() => toast('Tidak dapat menyalin sekarang. Cuba lagi.'))
    : execute("prompt");
  execute();
  return cleanup;
}
