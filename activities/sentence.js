import { expansionActionPair } from '../components/expansion-prompt.js';
import { stimulus } from "../components/content.js";
import { e, field, icon, list } from "../components/ui.js";
import { editor, teacherCard } from "../components/writing.js";
import { scaffoldFields } from "../js/config.js";
import { sentencePreview } from "../js/learning-service.js";
import { tutorActions } from '../js/tutor-actions.js';
import { detailExpansionAction } from '../js/expansion-tutor.js';
import { expansionDetails, expansionKeyword } from '../js/expansion.js';
import { renderExpansionKeyword, renderKeywordCheck } from '../components/expansion-keyword.js';
import { renderExpansionSituation } from '../components/expansion-situation.js';
export function renderSentence({ pack, draft, state }) {
  const task = pack.activitySets.sentence,
    profile = pack.difficultyProfile;
  const fields = scaffoldFields.map(([key, label], index) =>
    field(
      label,
      draft.fields[key] || "",
      `data-scaffold="${key}"`,
      task.seeds[key] || "",
    ),
  );
  return `${stimulus(pack, state, draft)}<div class="workspace-grid"><div><section class="panel"><span class="eyebrow">FIKIR & BINA</span><h2>${e(task.title)}</h2><p>${e(task.prompt || (pack.year <= 3 ? "Tulis ayat asli menggunakan perkataan atau frasa yang dipilih." : "Tulis ayat baharu menggunakan kata atau frasa fokus. Pilih pelaku, tempat atau tujuan sendiri."))}</p><div class="notice">${e(profile.guidance)} Soalan ini pilihan untuk membantu idea, bukan formula wajib.</div><div class="fields-grid">${fields.slice(0, profile.fields).join("")}</div>${profile.fields < 6 ? `<details><summary>Tambah butiran pilihan</summary><div class="fields-grid">${fields.slice(profile.fields).join("")}</div></details>` : ""}<div class="preview-box"><span class="eyebrow">GABUNGAN IDEA KAMU</span><p id="sentence-preview">${e(sentencePreview(draft.fields) || "Idea kamu akan muncul di sini.")}</p><p class="small">Baca dan ubah susunan jika perlu. Ayat yang baik jelas dan bermakna.</p><button class="small-button" data-use-preview>Gunakan sebagai permulaan</button></div></section><section class="panel writing-panel">${editor(draft, { placeholder: "Siapakah yang kamu bayangkan? Apakah yang dilakukannya?" })}</section></div><div>${pack.demo ? `<section class="panel soft"><span class="eyebrow">CONTOH DEMO</span><p class="example">${e(task.examples[profile.exampleIndex])}</p><button class="text-button" data-speak="${e(task.examples[profile.exampleIndex])}">${icon("sound")} Dengar contoh</button><p class="small muted">Tulis ayat kamu sendiri. Tidak semua butiran diperlukan.</p></section>` : ""}${teacherCard("sentence")}</div></div>`;
}
export function renderExpansion({ pack, draft, state }) {
  const task = pack.activitySets.expansion;
  const { keyword } = expansionKeyword(pack, draft);
  return `<div class="expansion-activity">${renderExpansionKeyword(pack, draft, state)}${renderExpansionSituation(draft)}<div class="workspace-grid expansion-workspace"><div><section class="panel"><span class="eyebrow">BERMULA DENGAN SATU AYAT</span><h2>${e(task.title)}</h2><p>Tulis ayat sendiri menggunakan kata kunci fokus, kemudian tambah butiran yang sesuai.</p>${draft.original ? `<div class="original"><span class="small">Ayat asal kamu · disimpan</span><p>${e(draft.original)}</p><p class="small">Ayat asal kekal sebagai rujukan. Pilih Draf baharu untuk memulakan ayat asal yang lain; draf ini kekal disimpan.</p></div>` : `<label class="field">Ayat asal<input id="original-input" value="${e(draft.fields.originalDraft || '')}" maxlength="1000" placeholder="Tulis ayat asal kamu di sini" aria-describedby="original-keyword-check"></label><div class="actions"><button class="button primary" data-lock-original>Mulakan dengan ayat saya</button>${pack.demo ? '<button class="button" data-demo-original>Guna ayat demo</button>' : ''}</div>`}${renderKeywordCheck(draft.original || draft.fields.originalDraft || '', keyword, 'original-keyword-check')}<section class="expansion-detail-section" aria-labelledby="expansion-detail-heading"><h3 id="expansion-detail-heading">Tambah Butiran yang Bermakna</h3><p>Pilih butiran yang ingin dimasukkan dalam ayat.</p><fieldset class="expansion-detail-options"><legend>Pilih butiran</legend><div class="chips">${expansionDetails.map(detail => `<label class="chip"><input type="checkbox" data-detail="${detail.id}" aria-describedby="guide-${detail.id}" ${draft.plan[detail.id] === 'yes' ? 'checked' : ''}><span>${e(detail.label)}</span></label>`).join('')}</div></fieldset><div class="actions">${expansionActionPair(detailExpansionAction, `<button type="button" class="button tint" data-ai="${detailExpansionAction}" aria-describedby="detail-ai-status">${icon("spark")}${e(tutorActions[detailExpansionAction].label)}</button>`)}</div><p id="detail-ai-status" class="small" role="status" aria-live="polite"></p><div id="expansion-detail-result"></div><div id="expansion-detail-guidance">${expansionDetails.map(detail => `<p id="guide-${detail.id}" class="small detail-guidance"${draft.plan[detail.id] === 'yes' ? '' : ' hidden'}><strong>${e(detail.label)}:</strong> ${e(detail.guidance)}</p>`).join('')}</div></section></section><section class="panel writing-panel">${editor(draft, { label: 'Ayat yang saya kembangkan' })}${renderKeywordCheck(draft.text, keyword, 'expanded-keyword-check')}</section></div>${teacherCard('expansion')}</div></div>`;
}
