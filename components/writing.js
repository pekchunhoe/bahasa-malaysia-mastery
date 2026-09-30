import { e, icon } from "./ui.js";
import { actionActivities, tutorActions } from "../js/tutor-actions.js";
import { writingCounts } from "../js/learning-service.js";
import { essayParagraphs, paragraphLabels, MAX_ESSAY_TEXT } from '../js/essay-paragraphs.js';
export function teacherButtons(activity, paragraphIndex) {
  const actions = (actionActivities[activity] || []).filter(action => activity !== 'essay' || (paragraphIndex ? action !== 'essay_review' : action === 'essay_review'));
  return `<div class="teacher-actions">${actions.map((action, index) => {
    const label = tutorActions[action].label;
    const button = `<button type="button" class="button ${index === 0 ? "tint" : "subtle"}" data-ai="${action}" ${paragraphIndex ? `data-ai-paragraph="${paragraphIndex}" aria-label="${e(label)} — Perenggan ${paragraphIndex}"` : ''}>${icon(index === 0 ? "spark" : "chevron")}${e(label)}${tutorActions[action].mode === "prompt" ? '<span class="mini-label">Jana prompt</span>' : ""}</button>`;
    return paragraphIndex ? `<div class="teacher-action-pair" role="group" aria-label="${e(label)} — Perenggan ${paragraphIndex}">${button}<button type="button" class="button subtle" data-jana-prompt="${action}" data-prompt-paragraph="${paragraphIndex}" aria-label="Jana Prompt — ${e(label)} — Perenggan ${paragraphIndex}" aria-live="polite">Jana Prompt</button></div>` : button;
  }).join("")}</div>`;
}
export function editor(
  draft,
  {
    label = "Penulisan saya",
    placeholder = "Tulis dengan kata-kata sendiri…",
    rows = 7,
    combined = false,
  } = {},
) {
  if (draft.activity === 'essay' && !combined) {
    const paragraphs = essayParagraphs(draft);
    return `<div class="essay-paragraphs">${paragraphs.map((text, i) => `<section class="essay-paragraph" aria-labelledby="paragraph-heading-${i + 1}"><h3 id="paragraph-heading-${i + 1}"><label for="essay-paragraph-${i + 1}">Perenggan ${i + 1} — ${e(paragraphLabels[i])}</label></h3><textarea id="essay-paragraph-${i + 1}" data-essay-paragraph="${i + 1}" rows="${draft.year <= 2 ? 5 : 7}" maxlength="${MAX_ESSAY_TEXT}" placeholder="Tulis idea kamu sendiri…">${e(text)}</textarea><p class="small save-state" data-save-status aria-live="polite"></p><h4>Cikgu AI · Perenggan ${i + 1}</h4>${teacherButtons('essay', i + 1)}</section>`).join('')}<section class="essay-combined" aria-labelledby="combined-heading"><h2 id="combined-heading">Karangan Lengkap</h2><p>Gabungan tulisan kamu dikemas kini secara automatik. Baiki tulisan dalam perenggan di atas.</p>${editor(draft, { label: 'Karangan Lengkap (paparan sahaja)', rows: 14, combined: true })}${teacherButtons('essay')}</section></div>`;
  }
  const count = writingCounts(draft.text);
  return `<div class="editor-header"><label for="student-text">${e(label)}</label><span class="save-state" data-save-status></span></div><textarea id="student-text" ${combined ? 'readonly aria-readonly="true"' : 'data-draft-field="text"'} rows="${rows}" maxlength="16000" placeholder="${e(placeholder)}">${e(draft.text)}</textarea><div class="editor-footer"><span id="writing-count">${count.words} perkataan · ${count.sentences} ayat</span><button class="text-button" data-read-writing>${icon("sound")} Dengar tulisan</button></div><div class="local-check"><button class="small-button" data-local-check>Semak asas tulisan (tanpa AI)</button><p class="small">Semakan huruf besar, tanda akhir dan ruang sahaja; bukan penilaian tatabahasa penuh.</p><div id="local-feedback" role="status" aria-live="polite"></div></div><div class="speech-toolbar"><button class="small-button" data-speech="pause">Jeda</button><button class="small-button" data-speech="resume">Sambung</button><button class="small-button" data-speech="stop">Henti</button><label>Kelajuan <select id="speech-rate" aria-label="Kelajuan bacaan"><option value="0.75">Perlahan</option><option value="1" selected>Biasa</option><option value="1.25">Laju</option></select></label></div><p id="speech-current" class="speech-current" aria-live="polite"></p>`;
}
export function teacherCard(activity) {
  if (activity === 'essay') return '';
  return `<aside class="panel teacher-card"><div class="teacher-icon">${icon("spark")}</div><h3>Belajar bersama Cikgu AI</h3><p>Kamu yang menulis. Cikgu membantu kamu berfikir dan membaiki tulisan.</p>${teacherButtons(activity)}<p class="small muted">Cadangan dipaparkan berasingan. Tulisan kamu kekal milik kamu.</p></aside>`;
}
