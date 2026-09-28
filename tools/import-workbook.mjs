import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { adaptMasterRows } from "../data/adapters/excel.js";
import { validateMaster } from "./validate-master.mjs";

export async function importWorkbook() {
  const workbook = new URL("../data/BM_MASTER_EJAAN_IMLAK_2026_MUKTAMAD.xlsx", import.meta.url);
  const jsonBytes = await readFile(new URL("../data/bm_content_2026_app_ready.json", import.meta.url));
  const exported = JSON.parse(jsonBytes);
  const result = spawnSync(process.env.PYTHON || "python", [
    fileURLToPath(new URL("./read-workbook.py", import.meta.url)), fileURLToPath(workbook),
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0)
    throw new Error(`Workbook import requires Python 3 (set PYTHON if needed): ${result.error?.message || result.stderr}`);
  const extracted = JSON.parse(result.stdout);
  const validation = validateMaster(extracted, exported);
  if (!validation.ok) throw new Error(`Excel/JSON validation failed; no records published:\n${validation.errors.join('\n')}`);
  const { audit } = adaptMasterRows(extracted.rows, extracted.headers);
  // JSON is the runtime source; Excel supplies audit-only edition/provenance.
  const originals = new Map(extracted.rows.map(row => [row.item_id, row]));
  const { items: normalizedItems } = adaptMasterRows(exported.items.map(item => ({ ...item, aktif: true,
    edisi: originals.get(item.item_id).edisi })));
  const jsonById = new Map(exported.items.map(item => [item.item_id, item]));
  const items = normalizedItems.map(item => ({ ...item, status_semakan: jsonById.get(item.id).status_semakan }));
  const enrichment = Object.fromEntries(exported.items.map(item => {
    const v = item.vocabulary;
    return [item.item_id, {
      source_item_id: item.item_id, ...(v.vocab_id ? { vocab_id: v.vocab_id } : {}),
      word: v.kata_frasa, source_type: v.content_source, content_source: v.content_source,
      status: v.status, pengesahan: v.pengesahan, approval_method: exported.approval_method,
      ...Object.fromEntries(Object.entries({ meaning: v.maksud_mudah,
        grammatical_category: v.kategori_kata, example_sentence: v.contoh_ayat,
        sentence_hint: v.petunjuk_bina_ayat, expansion_hint: v.petunjuk_kembangkan,
        root_word: v.kata_dasar, spelling_focus: v.fokus_ejaan }).filter(([, value]) => value)),
      ...(v.kata_berkaitan ? { related_words: v.kata_berkaitan.split(';').map(word => word.trim()).filter(Boolean) } : {}),
    }];
  }));
  const hash = createHash("sha256").update(await readFile(workbook)).digest("hex");
  const jsonHash = createHash("sha256").update(jsonBytes).digest("hex");
  const counts = Object.fromEntries([1, 2, 3, 4, 5, 6].map(year => [year, items.filter(i => i.year === year).length]));
  const output = new URL("../data/generated/", import.meta.url);
  const auditDir = new URL("../audit/", import.meta.url);
  await mkdir(output, { recursive: true });
  await mkdir(auditDir, { recursive: true });
  await writeFile(new URL("master.js", output), `// Generated from validated app-ready JSON by npm run data:prepare. Do not edit.\nexport const master = ${JSON.stringify({ version: `2026-${jsonHash.slice(0, 12)}`, content_release: exported.content_release, approval_method: exported.approval_method, items, enrichment }, null, 2)};\n`);
  await writeFile(new URL("workbook.json", auditDir), JSON.stringify({ workbook: "BM_MASTER_EJAAN_IMLAK_2026_MUKTAMAD.xlsx", sha256: hash,
    json: "bm_content_2026_app_ready.json", jsonSha256: jsonHash, validation,
    sheets: extracted.sheets, headers: extracted.headers, sourceRows: extracted.rows.length, exported: items.length,
    excluded: extracted.rows.length - items.length, counts, provenance: audit }, null, 2) + "\n");
  console.log(`Imported ${items.length} reviewed items: ${JSON.stringify(counts)}. Audit stays outside public assets.`);
  return { items, audit, counts };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await importWorkbook();
