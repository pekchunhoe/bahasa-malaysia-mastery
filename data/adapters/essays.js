// Actual MASTER_KARANGAN columns; never infer identity from title or row number.
export const essayHeaders = ['id_tajuk', 'tahun', 'umur_anggaran', 'tahap', 'jenis_karangan',
  'tema', 'tajuk_karangan', 'format_penulisan', 'aktiviti_cadangan', 'status',
  'karangan_contoh', 'bilangan_perkataan', 'status_karangan'];
export const countEssayWords = text => text.trim().split(/\s+/u).filter(Boolean).length;
export function adaptEssayRows(rows, headers = essayHeaders) {
  for (const header of essayHeaders) if (!headers.includes(header)) throw Error(`Missing essay column: ${header}`);
  const ids = new Set(), titles = new Set(), examples = new Set(), items = [], excluded = [];
  for (const [index, row] of rows.entries()) {
    const id = String(row.id_tajuk || '').trim();
    const titleKey = String(row.tajuk_karangan || '').trim().normalize('NFC').toLocaleLowerCase('ms');
    if (ids.has(id) || (titleKey && titles.has(titleKey))) throw Error(`Duplicate essay ID/title at row ${index + 2}: ${id}`);
    if (id) ids.add(id);
    if (titleKey) titles.add(titleKey);
    const missing = essayHeaders.filter(key => !String(row[key] ?? '').trim());
    if (missing.length || row.status !== 'MUKTAMAD' || row.status_karangan !== 'SIAP') {
      excluded.push({ row: index + 2, id, reason: missing.length ? `Incomplete: ${missing.join(', ')}` : `Status: ${row.status}/${row.status_karangan}` });
      continue;
    }
    const year = Number(row.tahun), words = Number(row.bilangan_perkataan);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !Number.isInteger(year) || year < 1 || year > 6)
      throw Error(`Invalid essay ID/year: ${id}`);
    if (!Number.isInteger(words) || words < 120 || words > 300 || words !== countEssayWords(row.karangan_contoh))
      throw Error(`Essay word count mismatch: ${id} (declared ${words}, actual ${countEssayWords(row.karangan_contoh)})`);
    if (examples.has(row.karangan_contoh)) throw Error(`Duplicate essay example: ${id}`);
    examples.add(row.karangan_contoh);
    items.push({ id, year, title: row.tajuk_karangan, category: row.tema,
      writing_type: row.jenis_karangan, format: row.format_penulisan,
      recommended_activity: row.aktiviti_cadangan, age: Number(row.umur_anggaran), level: row.tahap,
      model_text: row.karangan_contoh, word_count: words,
      source_type: 'essay_master', status: row.status, example_status: row.status_karangan });
  }
  return { items, excluded, counts: Object.fromEntries([1, 2, 3, 4, 5, 6].map(year => [year, items.filter(r => r.year === year).length])) };
}
