import { fileURLToPath } from 'node:url';
import { importWorkbook } from './import-workbook.mjs';
import { importEssays } from './import-essays.mjs';
export async function prepareData() {
  await importWorkbook();
  await importEssays();
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareData();
