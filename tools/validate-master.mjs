// Compare the read-only audit workbook to the application export by identity.
export function validateMaster(extracted, exported) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const tables = extracted.tables;
  const master = tables.MASTER_CONTENT.rows;
  const enrichment = tables.ENRICHMENT.rows;
  const focus = tables.VOCAB_FOCUS.rows;
  const index = (rows, key, label) => {
    const map = new Map();
    for (const row of rows) {
      check(Boolean(row[key]) && !map.has(row[key]), `${label}: missing/duplicate ${key} ${row[key]}`);
      map.set(row[key], row);
    }
    return map;
  };
  const originals = index(master, 'item_id', 'MASTER_CONTENT');
  const supplements = index([...enrichment, ...focus], 'source_item_id', 'Supplement');
  const items = index(exported.items, 'item_id', 'JSON');
  index(focus, 'vocab_id', 'VOCAB_FOCUS');
  check(master.length === 1080 && items.size === 1080, 'Expected 1080 master/JSON IDs');
  check(enrichment.length === 720 && focus.length === 360, 'Expected 720 enrichment and 360 focus records');
  check(exported.schema_version === 1, 'Unsupported JSON schema');
  check(exported.approval_method === 'pengesahan_pukal_oleh_pengguna', 'Invalid approval method');
  for (const [key, expected] of Object.entries({ total: 1080, ejaan: 720, imlak: 360 }))
    check(exported.counts?.[key] === expected, `JSON counts.${key}: expected ${expected}`);
  const compare = (id, field, a, b) => {
    // Only blank/null and Excel numeric strings are equivalent. Text is exact.
    if (String(a ?? '') !== String(b ?? '')) errors.push(`${id} ${field}: Excel=${JSON.stringify(a)} JSON=${JSON.stringify(b)}`);
  };
  for (const row of master) {
    const id = row.item_id, item = items.get(id), sup = supplements.get(id);
    check(Boolean(item), `${id}: missing JSON item`);
    check(Boolean(sup), `${id}: missing supplement`);
    if (!item || !sup) continue;
    for (const key of ['item_id', 'tahun', 'jenis', 'tema_no', 'tema', 'unit_no', 'unit', 'item_no', 'teks_app', 'status_semakan'])
      compare(id, key, row[key], item[key]);
    check(row.status_semakan === 'Disahkan' && (row.aktif === true || row.aktif === '1'), `${id}: master not verified/active`);
    const lower = Number(row.tahun) <= 3;
    check(row.jenis === (lower ? 'ejaan' : 'imlak'), `${id}: year/type mismatch`);
    check((lower ? enrichment : focus).includes(sup), `${id}: supplement in wrong table`);
    compare(id, 'supplement.tahun', row.tahun, sup.tahun);
    compare(id, 'supplement.unit_no', row.unit_no, sup.unit_no);
    compare(id, 'source reference', row.teks_app, lower ? sup.perkataan_rujukan : sup.ayat_imlak_rujukan);
    const v = item.vocabulary;
    check(Boolean(v), `${id}: missing JSON vocabulary`);
    if (!v) continue;
    const mapping = {
      vocab_id: 'vocab_id', kata_frasa: lower ? 'perkataan_rujukan' : 'kata_frasa',
      maksud_mudah: 'maksud_mudah', kategori_kata: 'kategori_kata',
      contoh_ayat: lower ? 'contoh_ayat' : 'contoh_ayat_baharu',
      petunjuk_bina_ayat: lower ? 'petunjuk_bina_ayat' : 'petunjuk_penggunaan',
      petunjuk_kembangkan: 'petunjuk_kembangkan', kata_dasar: 'kata_dasar',
      kata_berkaitan: 'kata_berkaitan', fokus_ejaan: 'fokus_ejaan', content_source: 'content_source',
      status: lower ? 'enrichment_status' : 'status',
      ayat_diperkaya: 'ayat_diperkaya', kesalahan_lazim: 'kesalahan_lazim',
    };
    for (const [jsonKey, excelKey] of Object.entries(mapping)) compare(id, `vocabulary.${jsonKey}`, sup[excelKey], v[jsonKey]);
    check(v.content_source === 'ai_generated' && v.status === 'diluluskan', `${id}: incorrect supplement provenance/status`);
    check(sup.semakan_guru === 'Diluluskan secara pukal oleh pengguna' && v.pengesahan === 'pukal_oleh_pengguna', `${id}: incorrect bulk approval`);
    check(!sup.ayat_diperkaya && !sup.kesalahan_lazim && !v.ayat_diperkaya && !v.kesalahan_lazim, `${id}: expected blank reserved fields`);
  }
  for (const id of supplements.keys()) check(originals.has(id), `${id}: orphan supplement`);
  for (const id of items.keys()) check(originals.has(id), `${id}: extra JSON item`);
  const ejaan = master.filter(r => r.jenis === 'ejaan');
  const phrases = ejaan.filter(r => /\s/u.test(r.teks_app)).length;
  check(ejaan.length === 720 && master.length - ejaan.length === 360, 'Expected 720 ejaan/360 imlak');
  check(phrases === 81, `Expected 81 multiword ejaan, found ${phrases}`);
  for (let year = 1; year <= 6; year++) for (let unit = 1; unit <= 24; unit++)
    check(master.filter(r => Number(r.tahun) === year && Number(r.unit_no) === unit).length === (year <= 3 ? 10 : 5), `Year ${year} unit ${unit}: incorrect count`);
  return { ok: errors.length === 0, errors, total: master.length, ejaan: ejaan.length,
    imlak: master.length - ejaan.length, enrichment: enrichment.length, focus: focus.length,
    uniqueIds: originals.size, multiwordEjaan: phrases,
    repeatedTextOccurrences: master.length - new Set(master.map(r => r.teks_app)).size,
    approvalMethod: exported.approval_method };
}
