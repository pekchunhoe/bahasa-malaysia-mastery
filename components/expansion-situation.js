import { e } from './ui.js';
import { activeSituation, filterSituations, situationCategories, situations, MAX_SITUATION } from '../js/expansion-situations.js';

export function situationOptions(draft) {
  const active = activeSituation(draft);
  const matches = filterSituations({ category: draft.fields.situationCategory || 'all', query: draft.fields.situationQuery || '' });
  const selected = situations.find(record => record.id === active.situationId);
  const option = record => `<option value="${record.id}"${record.id === active.situationId ? ' selected' : ''}>${record.id} · ${e(record.text)}</option>`;
  return `<option value="">Tanpa situasi</option>${selected && !matches.includes(selected) ? `<optgroup label="Situasi aktif">${option(selected)}</optgroup>` : ''}${matches.map(option).join('')}`;
}
export function renderExpansionSituation(draft) {
  const { situationMode, situation } = activeSituation(draft);
  return `<section class="panel expansion-situation" aria-labelledby="situation-heading">
    <h2 id="situation-heading">Situasi Ayat</h2>
    <fieldset class="keyword-modes"><legend class="sr-only">Cara memilih situasi</legend>${[['builtin', 'Situasi Pilihan'], ['custom', 'Situasi Sendiri']].map(([mode, label]) => `<label><input type="radio" name="situation-mode" data-situation-mode value="${mode}"${situationMode === mode ? ' checked' : ''}><span>${label}</span></label>`).join('')}</fieldset>
    ${situationMode === 'builtin' ? `<div class="situation-inputs">
      <label class="field" for="situation-category">Kategori<select id="situation-category"><option value="all">Semua Kategori</option>${situationCategories.map(category => `<option value="${category.id}"${draft.fields.situationCategory === category.id ? ' selected' : ''}>${e(category.label)}</option>`).join('')}</select></label>
      <label class="field" for="situation-search">Cari situasi<input type="search" id="situation-search" maxlength="100" value="${e(draft.fields.situationQuery || '')}" placeholder="Contoh: keluarga atau sekolah" aria-controls="situation-select" aria-describedby="situation-search-help"></label>
      <label class="field situation-select-field" for="situation-select">Situasi<select id="situation-select">${situationOptions(draft)}</select></label>
      </div><p class="small" id="situation-search-help">100 situasi dalam 10 kategori. Penapis tidak menukar situasi aktif. Pilih situasi untuk menukarnya, atau pilih Tanpa situasi.</p>` : `<form id="custom-situation-form"><label class="field" for="custom-situation">Tulis situasi kamu sendiri<textarea id="custom-situation" rows="3" maxlength="${MAX_SITUATION}" placeholder="Contoh: Saya membantu seorang warga emas melintas jalan." aria-describedby="custom-situation-help custom-situation-error">${e(draft.fields.customSituationDraft ?? draft.fields.customSituation ?? '')}</textarea></label><p id="custom-situation-help" class="small">Maksimum 300 aksara. Tekan Gunakan situasi untuk mengaktifkan perubahan.</p><button type="submit" class="button primary">Gunakan situasi</button><p id="custom-situation-error" role="alert"></p></form>`}
    <p class="situation-focus" role="status"><strong>Situasi aktif:</strong> ${e(situation || 'Belum dipilih. Kamu boleh terus menulis.')}</p>
    <p class="small">Situasi membantu idea kamu. Menukar situasi tidak menggantikan tulisan kamu.</p>
  </section>`;
}
