import { e, list, showModal, toast } from "./ui.js";
import { provenanceLabel } from "./enrichment.js";
import { tutorActions } from "../js/tutor-actions.js";
export function openTeacher({ service, request, store }) {
  const controller = new AbortController();
  const modal = showModal(
    "Cikgu AI",
    `<p class="muted">Tahun ${request.year} · ${e(request.title || "Bank Kata & Frasa")}</p><details class="student-reference" open><summary>Tulisan / perkataan kamu</summary><p class="preserve">${e(request.studentText || "Belum ada tulisan.")}</p></details><div id="teacher-result" aria-live="polite"></div><div class="actions"><button class="button primary" id="teacher-run">${e(tutorActions[request.action].label)}</button><button class="button" id="teacher-prompt">Jana prompt</button></div><p class="small muted">Prompt dijana pada peranti ini. Tiada panggilan AI dibuat apabila kamu memilih Jana prompt.</p>`,
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
    result.innerHTML = '<p class="loading">Menyediakan bimbingan…</p>';
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
        result.innerHTML = `<p class="source-label">${e(provenanceLabel(response))}</p><h3>${e(f.summary)}</h3><h4>Kesalahan yang perlu dibetulkan</h4>${f.errors.length ? list(f.errors) : "<p>Tiada kesalahan khusus dilaporkan.</p>"}<h4>Cadangan untuk menjadikan ayat lebih baik</h4>${f.suggestions.length ? list(f.suggestions) : "<p>Tiada cadangan tambahan.</p>"}<p>${e(f.explanation)}</p>${f.example ? `<div class="notice"><strong>Contoh AI — bukan jawapan untuk disalin</strong><p>${e(f.example)}</p></div>` : ""}<p class="small muted">Cadangan kata AI bukan data kurikulum rasmi.</p>`;
      }
      store.runtime.ai = "ready";
    } catch (error) {
      if (!controller.signal.aborted) {
        result.innerHTML = `<p class="error" role="alert">${e(error.message)}</p>`;
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
