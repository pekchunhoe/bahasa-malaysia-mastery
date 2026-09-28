import { e } from "./ui.js";
import { unitPicker, themePicker } from "./content.js";
import { renderEnrichment } from "./enrichment.js";

export function suggestedVocabulary(pack, state = {}) {
  return pack.vocabulary.filter(w =>
    (!state.unit || state.unit === "all" || !w.unitNo || w.unitNo === Number(state.unit)) &&
    (!state.theme || state.theme === "all" || w.theme === state.theme));
}

export function vocabularySupport(pack, state = {}) {
  const words = suggestedVocabulary(pack, state);
  const selected = new Set(state.selectedVocabulary || []);
  const shown = [...words].sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id))).slice(0, 12);
  return `<section class="panel"><h2>Kosa kata untuk idea kamu</h2><p>Pilih unit atau tema yang berkaitan dengan tulisan kamu. Gunakan kata yang sesuai dan tulis dengan idea sendiri.</p><div class="support-filters">${unitPicker(pack, state)}${themePicker(pack, state)}</div><details class="enrichment"><summary>Lihat cadangan kosa kata (${shown.length} daripada ${words.length})</summary>${shown.map(word => `<details><summary>${e(word.word)}</summary>${renderEnrichment(word.enrichment, { bank: true })}<p class="small">Tahun ${pack.year}${word.unitNo ? ` · Unit ${word.unitNo}` : ""}${word.theme ? ` · ${e(word.theme)}` : ""}</p></details>`).join("") || '<p>Tiada kosa kata bagi penapis ini. Cuba unit atau tema lain.</p>'}<a class="button" href="#vocabulary">Lihat semua di Bank Kata & Frasa</a></details></section>`;
}
