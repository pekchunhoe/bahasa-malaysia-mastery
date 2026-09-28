// Read the private master before loading the generated public curriculum.
import { mkdir, cp, readdir, writeFile, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import { importWorkbook } from "./import-workbook.mjs";
await importWorkbook();
const { getCurriculumPack } = await import("../js/curriculum-service.js");
const root = fileURLToPath(new URL("..", import.meta.url)),
  out = path.join(root, "dist");
if (path.dirname(out) !== path.resolve(root) || path.basename(out) !== "dist")
  throw new Error("Invalid output directory");
for (let year = 1; year <= 6; year++) getCurriculumPack(year);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of [
  "index.html",
  "icon.svg",
  "styles",
  "js",
  "components",
  "activities",
  "data",
])
  await cp(path.join(root, name), path.join(out, name), { recursive: true, filter: (source) => !source.endsWith(".xlsx") && !source.endsWith("bm_content_2026_app_ready.json") && !source.includes(`${path.sep}adapters`) });
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await files(file)));
    else result.push(file);
  }
  return result;
}
const assets = (await files(out)).sort(),
  digest = createHash("sha256");
for (const file of assets) {
  digest.update(path.relative(out, file).replaceAll("\\", "/"));
  digest.update(await readFile(file));
}
const version = `bmMastery-${digest.digest("hex").slice(0, 12)}`;
const module = path.join(out, "js/deployment-version.js");
await writeFile(
  module,
  (await readFile(module, "utf8")).replace(
    "__BUILD_VERSION__",
    version,
  ),
);
await writeFile(
  path.join(out, "version.json"),
  JSON.stringify({ version }) + "\n",
);
console.log(
  `Built ${assets.length + 1} static assets in dist (${version}). Server-only API: /api/ai/tutor.`,
);
