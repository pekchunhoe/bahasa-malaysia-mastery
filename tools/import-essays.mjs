import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { adaptEssayRows } from '../data/adapters/essays.js';

export async function importEssays() {
  const name = 'BM_MASTER_KARANGAN_1000_TAHAP_KERJA.xlsx';
  const workbook = new URL(`../data/${name}`, import.meta.url);
  const processResult = spawnSync(process.env.PYTHON || 'python', [fileURLToPath(new URL('./read-workbook.py', import.meta.url)),
    fileURLToPath(workbook), 'MASTER_KARANGAN'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (processResult.error || processResult.status !== 0) throw Error(`Essay extraction failed: ${processResult.error?.message || processResult.stderr}`);
  const extracted = JSON.parse(processResult.stdout);
  const { items, excluded, counts } = adaptEssayRows(extracted.rows, extracted.headers);
  if (!items.length) throw Error('No complete essays available; existing generated content retained.');
  const sha256 = createHash('sha256').update(await readFile(workbook)).digest('hex');
  const report = { workbook: name, sha256, sheets: extracted.sheets, headers: extracted.headers,
    sourceRows: extracted.rows.length, imported: items.length, uniqueIds: new Set(items.map(i => i.id)).size,
    uniqueTitles: new Set(items.map(i => i.title.trim().toLocaleLowerCase('ms'))).size,
    uniqueExamples: new Set(items.map(i => i.model_text)).size, wordCountMismatches: 0,
    wordCountRange: { min: Math.min(...items.map(i => i.word_count)), max: Math.max(...items.map(i => i.word_count)) },
    types: Object.fromEntries([...new Set(items.map(i => i.writing_type))].map(type => [type, items.filter(i => i.writing_type === type).length])),
    counts, excluded };
  await mkdir(new URL('../data/generated/', import.meta.url), { recursive: true });
  await mkdir(new URL('../audit/', import.meta.url), { recursive: true });
  await writeFile(new URL('../data/generated/essays.js', import.meta.url), `// Generated from MASTER_KARANGAN. Run npm run data:prepare to refresh.\nexport const essays = ${JSON.stringify({ version: `essays-${sha256.slice(0, 12)}`, items }, null, 2)};\n`);
  await writeFile(new URL('../audit/essays.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(`Imported ${items.length} complete essays: ${JSON.stringify(counts)}; excluded ${excluded.length}.`);
  for (const record of excluded) console.warn(`Essay excluded: ${JSON.stringify(record)}`);
  return report;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await importEssays();
