import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
test("version watcher revalidates and announces once without reloading or erasing state", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "bm-version-"));
  const descriptors = Object.fromEntries(
    ["window", "document", "navigator", "fetch"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const noop = () => {},
    events = { addEventListener: noop, removeEventListener: noop };
  let latest = "test-v1",
    announcements = 0,
    checks = 0,
    reloads = 0;
  globalThis.window = { ...events, location: { reload: () => reloads++ } };
  globalThis.document = { ...events, visibilityState: "visible" };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });
  globalThis.fetch = async (_, options) => {
    assert.equal(options.cache, "no-store");
    checks++;
    return Response.json({ version: latest });
  };
  let watcher;
  try {
    const source = (
      await readFile(
        new URL("../js/deployment-version.js", import.meta.url),
        "utf8",
      )
    ).replace(
      "__BUILD_VERSION__",
      "test-v1",
    );
    await writeFile(path.join(temp, "version.mjs"), source);
    const module = await import(pathToFileURL(path.join(temp, "version.mjs")));
    watcher = module.watchForDeploymentUpdate(() => announcements++);
    await watcher.check();
    assert.equal(announcements, 0);
    latest = "test-v2";
    await watcher.check();
    await watcher.check();
    assert.equal(announcements, 1);
    assert.equal(reloads, 0);
    assert.ok(checks >= 2);
  } finally {
    watcher?.stop();
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    const resolved = path.resolve(temp);
    if (
      path.dirname(resolved) !== path.resolve(tmpdir()) ||
      !path.basename(resolved).startsWith("bm-version-")
    )
      throw new Error("Invalid temporary directory");
    await rm(resolved, { recursive: true, force: true });
  }
});
test("HTTP server serves the module graph and blocks server files and secrets", async () => {
  const child = spawn(process.execPath, ["tools/serve.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: "4187", GEMINI_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Server startup timeout: " + output)),
        10000,
      );
      child.stdout.on("data", (data) => {
        output += data;
        if (output.includes("http://localhost:4187")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.stderr.on("data", (data) => {
        output += data;
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited ${code}: ${output}`));
      });
    });
    const base = "http://127.0.0.1:4187";
    for (const resource of [
      "/",
      "/styles/app.css",
      "/js/app.js",
      "/data/demo/content.js",
      "/components/ai-teacher.js",
      "/activities/writing.js",
      "/activities/master-writing.js",
      "/components/essay-catalog.js",
      "/js/essay-service.js",
      "/data/generated/essays.js",
    ]) {
      const response = await fetch(base + resource);
      assert.equal(response.status, 200, resource);
      assert.ok(response.headers.get("Cache-Control").includes("no-cache"));
      if (resource === "/") {
        const html = await response.text();
        assert.ok(html.includes('lang="ms-MY"'));
        assert.ok(html.includes('name="viewport"'));
      }
    }
    for (const resource of [
      "/server/gemini.js",
      "/.env",
      "/package.json",
      "/node_modules/@google/genai/package.json",
      "/data/BM_MASTER_EJAAN_IMLAK_2026_MUKTAMAD.xlsx",
      "/audit/workbook.json",
      "/data/adapters/excel.js",
      "/data/BM_MASTER_KARANGAN_1000_TAHAP_KERJA.xlsx",
      "/data/adapters/essays.js",
      "/audit/essays.json",
    ])
      assert.equal((await fetch(base + resource)).status, 403, resource);
    assert.equal(
      (await fetch(base + "/version.json")).headers.get("Cache-Control"),
      "no-store",
    );
    const api = await fetch(base + "/api/ai/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sentence_check",
        activity: "sentence",
        year: 1,
        title: "",
        studentText: "Saya bermain.",
      }),
    });
    assert.equal(api.status, 503);
    assert.equal(api.headers.get("Cache-Control"), "no-store");
    assert.equal((await api.json()).error.code, "AI_NOT_CONFIGURED");
  } finally {
    child.kill();
  }
});
