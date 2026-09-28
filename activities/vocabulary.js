import { renderEnrichment, provenanceLabel } from "../components/enrichment.js";
import { unitPicker, themePicker } from "../components/content.js";
import { e, icon } from "../components/ui.js";
export function vocabularyCards(pack, state, search = "") {
  const words = pack.vocabulary.filter(
    (w) =>
      (state.theme === "all" || w.theme === state.theme) &&
      (!w.unitNo || !state.unit || state.unit === "all" || w.unitNo === Number(state.unit)) &&
      `${w.word} ${w.meaning} ${w.category} ${w.enrichment?.meaning || ""} ${w.enrichment?.simple_definition || ""} ${w.enrichment?.grammatical_category || ""}`
        .toLocaleLowerCase("ms")
        .includes(search.toLocaleLowerCase("ms")),
  );
  return words.length
    ? words
        .map(
          (w) =>
            `<article class="panel word-card"><div class="word-top"><span class="mini-label">${e(w.enrichment?.grammatical_category || w.category || (w.form === "phrase" ? "Entri berbilang perkataan" : "Perkataan"))}</span>${pack.demo ? '<span class="demo-tag">DEMO</span>' : `<span class="small">${w.unitNo ? `Unit ${w.unitNo}` : "Bank tambahan guru"}</span>`}</div><h2>${e(w.word)}</h2>${w.source_type ? `<p class="small source-label">${w.source_type === "reviewed_source" ? "Teks sumber disahkan" : e(provenanceLabel(w.enrichment))}</p>` : ""}${renderEnrichment(w.enrichment, { bank: true })}${w.meaning ? `<p>${e(w.meaning)}</p>` : ""}${w.example ? `<blockquote>${e(w.example)}</blockquote>` : ""}<div class="actions"><button class="small-button" data-speak="${e(w.audioText)}" aria-label="Dengar perkataan ${e(w.word)}">${icon("sound")} Kata</button>${w.example ? `<button class="small-button" data-speak="${e(w.example)}">Dengar ayat</button>` : ""}</div><div class="word-bottom"><button class="text-button" data-select-word="${e(w.id)}">${state.selectedVocabulary.includes(w.id) ? "✓ Kata dipilih" : "+ Pilih kata"}</button>${!w.enrichment ? `<button class="text-button" data-word-ai="${e(w.id)}">${icon("spark")} Terangkan</button><button class="text-button" data-word-example="${e(w.id)}">Contoh ayat</button>` : ""}</div></article>`,
        )
        .join("")
    : '<div class="empty-state"><h3>Tiada kata ditemui</h3><p>Cuba kata lain atau pilih semua tema.</p></div>';
}
export function renderVocabulary({ pack, state }) {
  if (!pack.demo && pack.year >= 4 && !pack.vocabulary.length) return `<section class="panel empty-state"><h2>Tiada bank ejaan untuk Tahun ${pack.year}</h2><p>Master menyediakan ayat imlak bagi tahun ini. Pilih Tahun 1-3 untuk mengulang kaji kata dan frasa, atau buka Latihan Ejaan & Imlak.</p><a class="button" href="#practice">Latihan imlak</a></section>`;
  return `<div class="toolbar panel"><label class="search-field">${icon("search")}<input type="search" id="word-search" placeholder="Cari kata atau frasa..." aria-label="Cari kata"></label>${unitPicker(pack, state)}${themePicker(pack, state)}</div><p class="small muted">${pack.vocabulary.length} kata & frasa untuk Tahun ${pack.year}${pack.demo ? " - DEMO" : pack.vocabulary.some(w => w.source_type === "teacher_authored") ? " - Sumber dilabel pada setiap kad" : " - Sumber: master disahkan"}. Maksud, kategori dan contoh daripada pengayaan master. Pengayaan dijana AI dan diluluskan secara pukal oleh pengguna; bukan semakan individu guru.</p><div class="word-grid" id="word-results">${vocabularyCards(pack, state)}</div>`;
}
