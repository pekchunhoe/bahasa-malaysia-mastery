import { e, list, showModal, toast } from "./ui.js";
import { provenanceLabel } from "./enrichment.js";
import { hasMeaningfulStudentText, tutorActions } from "../js/tutor-actions.js";

function essayHint(feedback, hasDraft) {
  const examples = feedback.examples
    .map(
      (sentence, index) =>
        `<div class="ai-example-sentence"><p>${e(sentence)}</p><button class="small-button" type="button" data-copy-example="${index}" aria-label="Salin contoh ayat ${index + 1}">Salin</button></div>`,
    )
    .join("");
  return `<section class="ai-hint-result"><h3>Petunjuk untuk kamu</h3><p>${e(feedback.summary)}</p><h4>${hasDraft ? "Kamu boleh sambung dengan..." : "Idea yang boleh kamu pilih"}</h4>${feedback.suggestions.length ? list(feedback.suggestions) : "<p>Pilih satu idea yang paling sesuai dengan tulisan kamu.</p>"}${feedback.questions.length ? `<h4>Cuba fikirkan</h4>${list(feedback.questions)}` : ""}<h4>Contoh ayat</h4><div class="ai-example-list">${examples || "<p>Belum ada contoh ayat. Cuba pilih satu idea dahulu.</p>"}</div><p class="small muted">Contoh ini untuk kamu ubah suai. Tulisan kamu tidak diisi atau diganti secara automatik.</p></section>`;
}

async function copySentence(sentence) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(sentence);
    return;
  }
  const area = document.createElement("textarea");
  area.value = sentence;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("copy unavailable");
}

function attachExampleCopyButtons(result, examples) {
  result.querySelectorAll("[data-copy-example]").forEach((button) => {
    const sentence = examples[Number(button.dataset.copyExample)];
    button.onclick = async () => {
      try {
        await copySentence(sentence);
        button.textContent = "Disalin ✓";
        button.setAttribute("aria-label", "Contoh ayat telah disalin");
        const reset = setTimeout(() => {
          if (!button.isConnected) return;
          button.textContent = "Salin";
          button.setAttribute("aria-label", `Salin contoh ayat ${Number(button.dataset.copyExample) + 1}`);
        }, 1800);
        reset.unref?.();
      } catch {
        toast("Tidak dapat menyalin sekarang. Cuba lagi.");
      }
    };
  });
}

export function openTeacher({ service, request, store }) {
  const controller = new AbortController();
  const modal = showModal(
    "Cikgu AI",
    `<p class="muted">Tahun ${request.year} · ${e(request.title || "Bank Kata & Frasa")}</p><details class="student-reference" open><summary>${request.paragraphIndex ? `Perenggan ${request.paragraphIndex} · Tulisan kamu` : "Tulisan / perkataan kamu"}</summary><p class="preserve">${e(request.studentText || "Belum ada tulisan.")}</p></details>${request.previousParagraphs?.length ? `<details class="student-reference"><summary>Perenggan terdahulu</summary>${request.previousParagraphs.map((text, i) => `<h4>Perenggan ${i + 1}</h4><p class="preserve">${e(text || "Belum ada tulisan.")}</p>`).join("")}</details>` : ""}<div id="teacher-result" aria-live="polite"></div><div class="actions"><button class="button primary" id="teacher-run">${e(tutorActions[request.action].label)}</button><button class="button" id="teacher-prompt">Jana prompt</button></div><p class="small muted">Prompt dijana pada peranti ini. Tiada panggilan AI dibuat apabila kamu memilih Jana prompt.</p>`,
    () => {
      controller.abort();
      store.runtime.ai = "idle";
    },
  );
  const result = modal.querySelector("#teacher-result"),
    run = modal.querySelector("#teacher-run"),
    promptButton = modal.querySelector("#teacher-prompt");
  const execute = async (mode) => {
    if (store.runtime.ai === "loading") return;
    store.runtime.ai = "loading";
    run.disabled = promptButton.disabled = true;
    result.innerHTML = `<p class="loading">${request.action === "essay_next_step" ? "Menyediakan petunjuk…" : "Menyediakan bimbingan…"}</p>`;
    try {
      const response = await service.request(request, {
        signal: controller.signal,
        mode,
      });
      if (controller.signal.aborted) return;
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
        if (f.kind === "essay_hint") {
          result.innerHTML = `<p class="source-label">${e(provenanceLabel(response))}</p>${essayHint(f, hasMeaningfulStudentText(request.studentText))}`;
          attachExampleCopyButtons(result, f.examples);
        } else {
          result.innerHTML = `<p class="source-label">${e(provenanceLabel(response))}</p><h3>${e(f.summary)}</h3><h4>Kesalahan yang perlu dibetulkan</h4>${f.errors.length ? list(f.errors) : "<p>Tiada kesalahan khusus dilaporkan.</p>"}<h4>Cadangan untuk menjadikan ayat lebih baik</h4>${f.suggestions.length ? list(f.suggestions) : "<p>Tiada cadangan tambahan.</p>"}<p>${e(f.explanation)}</p>${f.example ? `<div class="notice"><strong>Contoh AI — bukan jawapan untuk disalin</strong><p>${e(f.example)}</p></div>` : ""}<p class="small muted">Cadangan kata AI bukan data kurikulum rasmi.</p>`;
        }
      }
      store.runtime.ai = "ready";
    } catch (error) {
      if (!controller.signal.aborted) {
        result.innerHTML = `<p class="error" role="alert">${e(request.action === "essay_next_step" ? "Cikgu AI belum dapat memberikan petunjuk sekarang. Cuba sekali lagi." : error.message)}</p>`;
        store.runtime.ai = "error";
      }
    } finally {
      if (!controller.signal.aborted)
        run.disabled = promptButton.disabled = false;
    }
  };
  run.onclick = () => execute();
  promptButton.onclick = () => execute("prompt");
  execute();
}
