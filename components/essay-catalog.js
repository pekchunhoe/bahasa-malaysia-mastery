import { e, icon } from './ui.js';
import { speechControls } from './writing.js';
import { essayTopicsForYear, filterEssays, writingTopicsFor } from '../js/essay-service.js';

export const writingFilterKey = (year, activity) => `${year}:${activity}`;

function catalogTopics(pack, draft, filters) {
  return draft.activity === 'essay'
    ? essayTopicsForYear(filters.year || pack.year)
    : writingTopicsFor(pack, draft.activity).filter(t => t.source_type === 'essay_master');
}

export function topicResults(pack, state, draft) {
  const filters = state.writingFilters?.[writingFilterKey(pack.year, draft.activity)] || {};
  const topics = catalogTopics(pack, draft, filters);
  const matches = filterEssays(topics, filters);
  const yearLabel = draft.activity === 'essay' && filters.year === 'all' ? 'Semua Tahun' : `Tahun ${pack.year}`;
  return `<p role="status">${matches.length} daripada ${topics.length} tajuk bagi aktiviti ini · ${yearLabel}</p>${matches.length ? `<label class="field">Pilih tajuk<select id="writing-topic-select"><option value="">Pilih tajuk untuk membuka draf</option>${matches.map(t => `<option value="${e(t.id)}" ${t.id === draft.contentId ? 'selected' : ''}>${e(t.title)}</option>`).join('')}</select></label>` : '<p class="empty-state">Tiada tajuk sepadan. Ubah carian atau kosongkan penapis.</p>'}<button class="small-button" data-reset-writing-filters>Kosongkan penapis</button>`;
}

export function topicPicker(pack, state, draft) {
  if (pack.demo || !pack.essayCatalog) return '';
  if (pack.essayCatalog.status === 'error') return `<section class="panel notice" role="alert"><p>${e(pack.essayCatalog.message)}</p><button class="button" data-reload-essays>Cuba muat semula</button></section>`;
  const filters = state.writingFilters?.[writingFilterKey(pack.year, draft.activity)] || {};
  const topics = catalogTopics(pack, draft, filters);
  const options = (values, chosen) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ms')).map(v => `<option value="${e(v)}" ${chosen === v ? 'selected' : ''}>${e(v)}</option>`).join('');
  const catalogSummary = draft.activity === 'essay' && filters.year === 'all' ? 'Semua tajuk master Tahun 1 hingga Tahun 6.' : `${pack.essayCatalog.count} tajuk master untuk Tahun ${pack.year}.`;
  return `<section class="panel essay-catalog"><h2>Bank Tajuk Karangan</h2><p>${catalogSummary}${draft.activity === 'story' ? ' Rantai Cerita menggunakan tajuk cerita pengalaman dan cerita rekaan.' : ''}</p><div class="essay-filters"><label class="field">Cari tajuk<input type="search" id="essay-search" data-writing-filter="query" value="${e(filters.query || '')}" maxlength="160" placeholder="Cari tajuk atau kata kunci"></label><label class="field">Kategori (tema)<select data-writing-filter="category"><option value="all">Semua kategori</option>${options(topics.map(t => t.category), filters.category)}</select></label><label class="field">Jenis karangan<select data-writing-filter="type"><option value="all">Semua jenis</option>${options(topics.map(t => t.writing_type), filters.type)}</select></label></div><div id="writing-topic-results">${topicResults(pack, state, draft)}</div><p class="small">Penapis tidak menukar draf aktif. Memilih tajuk membuka draf berasingan; tulisan lama kekal dalam Draf Saya.</p><p class="current-writing-title">Draf aktif: <strong>${e(draft.title)}</strong></p></section>`;
}

export function essayExample(topic) {
  if (!topic?.model_text) return '';
  return `<details class="panel essay-reference" data-essay-example><summary>Lihat contoh karangan</summary><p class="source-label">CONTOH RUJUKAN MASTER · ${e(topic.status)} / ${e(topic.example_status)}</p><h2>${e(topic.title)}</h2><p>${e(topic.writing_type)} · ${e(topic.format)} · ${topic.word_count} perkataan</p><p>Contoh untuk dipelajari. Tulis idea kamu sendiri; contoh ini tidak dimasukkan ke dalam draf.</p><div class="essay-model">${e(topic.model_text)}</div><div class="editor-footer example-speech-footer"><span>Baca contoh ini</span><button type="button" class="text-button" data-read-example="${e(topic.id)}" aria-label="Dengar tulisan contoh karangan: ${e(topic.title)}">${icon('sound')} Dengar tulisan</button></div>${speechControls({ statusId: 'example-speech-current', rateId: 'example-speech-rate', rateLabel: 'Kelajuan bacaan contoh' })}<button type="button" class="button" data-hide-example>Sembunyikan contoh</button></details>`;
}

export function revisionHistory(draft) {
  return `<section class="panel" id="writing-revisions"><h3>Versi tulisan saya</h3><p>Simpan versi sebelum membaiki tulisan. Versi juga disimpan apabila kamu meminta bimbingan Cikgu AI. Versi terdahulu kekal berasingan daripada tulisan semasa.</p><button class="small-button" data-save-writing-version>Simpan versi sebelum membaiki</button><details class="enrichment"><summary>Lihat versi tersimpan (${draft.revisions?.length || 0})</summary>${(draft.revisions || []).map((v, i) => `<article><h4>Versi ${i + 1}</h4><p class="small">${e(v.savedAt)}</p><div class="essay-model">${e(v.text)}</div></article>`).join('') || '<p>Belum ada versi tersimpan.</p>'}</details></section>`;
}
