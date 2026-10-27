import { e } from './ui.js';
import { unitPicker } from './content.js';
import { renderEnrichment } from './enrichment.js';
import { MAX_KEYWORD, containsKeyword, expansionKeyword, expansionVocabulary, keywordFeedback } from '../js/expansion.js';

export function keywordOptions(pack, draft, query = '', unit = 'all') {
  const selected = expansionKeyword(pack, draft).entry;
  const words = expansionVocabulary(pack).filter(word =>
    (unit === 'all' || !word.unitNo || String(word.unitNo) === String(unit)) &&
    word.word.toLocaleLowerCase('ms').includes(query.trim().toLocaleLowerCase('ms')));
  if (selected && !words.some(word => word.id === selected.id)) words.unshift(selected);
  return `<option value="">Pilih kata kunci</option>${words.map(word => `<option value="${e(word.id)}"${word.id === selected?.id ? ' selected' : ''}>${e(word.word)}${word.unitNo ? ` · Unit ${word.unitNo}` : ''}</option>`).join('')}`;
}
export function renderExpansionKeyword(pack, draft, state) {
  const { mode, keyword, entry } = expansionKeyword(pack, draft);
  const support = entry?.enrichment || pack.enrichment?.[entry?.id];
  // Never disclose a source example as a valid keyword example if it misses
  // the focus word. Definitions remain available for the active built-in word.
  const checkedSupport = support ? { ...support,
    example_sentence: containsKeyword(support.example_sentence, keyword) ? support.example_sentence : '',
    example_sentence_simple: containsKeyword(support.example_sentence_simple, keyword) ? support.example_sentence_simple : '',
  } : null;
  return `<section class="panel expansion-keyword" aria-labelledby="keyword-heading"><h2 id="keyword-heading">Pilih cara menggunakan kata kunci</h2><fieldset class="keyword-modes"><legend class="sr-only">Cara memilih kata kunci</legend>${[['builtin', 'Kata Kunci Sedia Ada'], ['custom', 'Kata Kunci Sendiri']].map(([value, label]) => `<label><input type="radio" name="expansion-mode" data-keyword-mode value="${value}"${mode === value ? ' checked' : ''}><span>${label}</span></label>`).join('')}</fieldset>${mode === 'builtin' ? `<div class="keyword-inputs">${unitPicker(pack, state)}<label class="field" for="keyword-search">Cari kata kunci<input type="search" id="keyword-search" placeholder="Cari perkataan atau frasa" maxlength="80" aria-controls="expansion-keyword-select"></label><label class="field" for="expansion-keyword-select">Kata kunci sedia ada · Tahun ${pack.year}<select id="expansion-keyword-select">${keywordOptions(pack, draft, '', state.unit)}</select></label></div><p class="small">Pilih kata kunci untuk membuka drafnya. Draf terdahulu kekal dalam Draf Saya. Menukar unit hanya menapis pilihan.</p>` : `<form id="custom-keyword-form"><label class="field" for="custom-keyword">Kata kunci saya<input id="custom-keyword" value="${e(draft.fields.customKeywordDraft ?? draft.fields.customKeyword ?? '')}" maxlength="${MAX_KEYWORD}" placeholder="Contoh: membantu" aria-describedby="custom-keyword-help custom-keyword-error" autocomplete="off"></label><p id="custom-keyword-help" class="small">Satu kata atau frasa pendek, maksimum 80 aksara dan 8 perkataan. Tekan Gunakan kata kunci untuk mengaktifkannya.</p><button type="submit" class="button primary">Gunakan kata kunci</button><p id="custom-keyword-error" role="alert"></p></form>`}<p class="keyword-focus" role="status">Kata kunci fokus: <strong>${e(keyword || 'Belum dipilih')}</strong></p><p class="small">Gunakan kata kunci ini dalam ayat asal dan ayat yang kamu kembangkan. Tulisan kamu kekal apabila mod ditukar.</p>${mode === 'builtin' ? renderEnrichment(checkedSupport, { activity: 'expansion' }) : ''}</section>`;
}
export function renderKeywordCheck(text, keyword, id) {
  return `<p id="${id}" class="keyword-check small" role="status">${e(text.trim() || !keyword ? keywordFeedback(text, keyword) : '')}</p>`;
}
