import { e, icon } from "./ui.js";
import { actionActivities, tutorActions } from "../js/tutor-actions.js";
import { writingCounts } from "../js/learning-service.js";
export function teacherButtons(activity) {
  return `<div class="teacher-actions">${(actionActivities[activity] || []).map((action, index) => `<button class="button ${index === 0 ? "tint" : "subtle"}" data-ai="${action}">${icon(index === 0 ? "spark" : "chevron")}${e(tutorActions[action].label)}${tutorActions[action].mode === "prompt" ? '<span class="mini-label">Jana prompt</span>' : ""}</button>`).join("")}</div>`;
}
export function editor(
  draft,
  {
    label = "Penulisan saya",
    placeholder = "Tulis dengan kata-kata sendiri…",
    rows = 7,
  } = {},
) {
  const count = writingCounts(draft.text);
  return `<div class="editor-header"><label for="student-text">${e(label)}</label><span class="save-state" data-save-status></span></div><textarea id="student-text" data-draft-field="text" rows="${rows}" maxlength="16000" placeholder="${e(placeholder)}">${e(draft.text)}</textarea><div class="editor-footer"><span id="writing-count">${count.words} perkataan · ${count.sentences} ayat</span><button class="text-button" data-read-writing>${icon("sound")} Dengar tulisan</button></div><div class="local-check"><button class="small-button" data-local-check>Semak asas tulisan (tanpa AI)</button><p class="small">Semakan huruf besar, tanda akhir dan ruang sahaja; bukan penilaian tatabahasa penuh.</p><div id="local-feedback" role="status" aria-live="polite"></div></div><div class="speech-toolbar"><button class="small-button" data-speech="pause">Jeda</button><button class="small-button" data-speech="resume">Sambung</button><button class="small-button" data-speech="stop">Henti</button><label>Kelajuan <select id="speech-rate" aria-label="Kelajuan bacaan"><option value="0.75">Perlahan</option><option value="1" selected>Biasa</option><option value="1.25">Laju</option></select></label></div><p id="speech-current" class="speech-current" aria-live="polite"></p>`;
}
export function teacherCard(activity) {
  return `<aside class="panel teacher-card"><div class="teacher-icon">${icon("spark")}</div><h3>Belajar bersama Cikgu AI</h3><p>Kamu yang menulis. Cikgu membantu kamu berfikir dan membaiki tulisan.</p>${teacherButtons(activity)}<p class="small muted">Cadangan dipaparkan berasingan. Tulisan kamu kekal milik kamu.</p></aside>`;
}
