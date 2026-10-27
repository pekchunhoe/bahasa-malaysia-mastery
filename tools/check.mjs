import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
async function files(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (
      ["node_modules", "dist", ".git", ".npm-cache", "test-results"].includes(
        entry.name,
      )
    )
      continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await files(file)));
    else found.push(file);
  }
  return found;
}
const all = await files(root);
// Check actual published assets too, after a build, without inspecting dependencies.
try {
  all.push(...await files(path.join(root, "dist")));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
let checked = 0;
for (const file of all) {
  if (/\.(?:m?js|css|html|json|md|svg)$/.test(file)) {
    const source = await readFile(file, "utf8");
    if (/[ \t]+\r?$/m.test(source)) throw new Error(`Trailing whitespace: ${file}`);
    if (/^(?:<{7}|={7}|>{7})(?: |$)/m.test(source)) throw new Error(`Conflict marker: ${file}`);
  }
  if (/\.(?:m?js)$/.test(file)) {
    const result = spawnSync(process.execPath, ["--check", file], {
      encoding: "utf8",
    });
    if (result.status !== 0) throw new Error(result.stderr);
    checked++;
  }
  if (
    /^(?:(?:js|components|activities|data|styles|dist)[\\/]|index\.html$)/.test(
      path.relative(root, file),
    ) && /\.(?:js|css|html|json)$/.test(file)
  ) {
    const source = await readFile(file, "utf8");
    if (
      /AIza[\w-]{20,}|GEMINI_API_KEY|GEMINI_FAST_MODEL|GOOGLE_API_KEY|@google\/genai|GoogleGenAI|GoogleGenerativeAI|generativelanguage\.googleapis\.com/u.test(
        source,
      )
    )
      throw new Error(
        `Secret/server import in browser asset: ${file}`,
      );
    const relative = path.relative(root, file).replaceAll('\\', '/').replace(/^dist\//, '');
    // The requested trilingual meaning card is the sole intentional Chinese UI.
    // Keep the original language check everywhere else, independently of secrets.
    if (/[\u3400-\u9fff]/u.test(source) && relative !== 'components/expansion-ai.js')
      throw new Error(`Unexpected Chinese label outside keyword meaning: ${file}`);
  }
}
console.log(
  `Checked ${checked} JavaScript modules and source whitespace/conflict markers; browser assets contain no Gemini credentials or SDK imports; Chinese UI is limited to keyword meaning.`,
);
