import { normalizeVocabulary } from "../schema/models.js";
// Legacy generic boundary retained for independently authored vocabulary packs.
// mapRow receives the original row; no Excel headers are prescribed here.
export function adaptVocabularyRows(rows, mapRow) {
  if (!Array.isArray(rows) || typeof mapRow !== "function")
    throw new Error("Rows and a workbook-specific mapper are required");
  return normalizeVocabulary(rows.map((row, index) => mapRow(row, index)));
}

export const masterHeaders = ["item_id", "tahun", "jenis", "tema_no", "tema",
  "unit_no", "unit", "item_no", "teks_sumber", "teks_app", "status_semakan",
  "aktif", "isu_semakan", "fail_sumber", "lokasi_sumber", "edisi"];

export function adaptMasterRows(rows, headers = masterHeaders) {
  for (const header of masterHeaders)
    if (!headers.includes(header)) throw new Error(`Missing master column: ${header}`);
  const ids = new Set(), items = [], audit = [];
  const str = (value) => String(value ?? "").trim();
  for (const row of rows) {
    const active = row.aktif === true || row.aktif === 1 || /^(true|1)$/i.test(str(row.aktif));
    if (str(row.status_semakan) !== "Disahkan" || !active || !str(row.teks_app)) continue;
    const id = str(row.item_id), year = Number(row.tahun), type = str(row.jenis);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || ids.has(id)) throw new Error(`Invalid or duplicate item_id: ${id}`);
    if (!Number.isInteger(year) || year < 1 || year > 6 || !["ejaan", "imlak"].includes(type))
      throw new Error(`Invalid year/type: ${id}`);
    const number = (value, required = false) => {
      if (!str(value) && !required) return null;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid metadata: ${id}`);
      return n;
    };
    ids.add(id);
    const text = str(row.teks_app);
    items.push({ id, year, type, text,
      form: type === "imlak" ? "sentence" : /\s/u.test(text) ? "phrase" : "word",
      themeNo: number(row.tema_no), theme: str(row.tema), unitNo: number(row.unit_no, true),
      unit: str(row.unit), itemNo: number(row.item_no, true), edition: str(row.edisi) });
    audit.push({ id, teks_sumber: row.teks_sumber, fail_sumber: row.fail_sumber,
      lokasi_sumber: row.lokasi_sumber, isu_semakan: row.isu_semakan });
  }
  return { items, audit };
}
