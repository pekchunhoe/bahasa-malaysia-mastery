import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createDeploymentUpdateNotice } from '../components/deployment-update.js';
import { createStore } from '../js/state.js';
import { getCurriculumPack } from '../js/curriculum-service.js';
import { STORAGE_KEY } from '../js/storage.js';
const currentVersion = 'bmMastery-111111111111';
const nextVersion = 'bmMastery-222222222222';
const settle = () => new Promise(resolve => setImmediate(resolve));
function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
    dispatch(name) { return listeners.get(name)?.(); },
  };
}
async function watcherHarness(t, { production = true, buildVersion = currentVersion, onUpdate = () => {} } = {}) {
  const temp = await mkdtemp(path.join(tmpdir(), "bm-version-"));
  const descriptors = Object.fromEntries(
    ["window", "document", "navigator", "fetch"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const state = { announcements: 0, checks: 0, reloads: 0, response: () => Response.json({ version: buildVersion }) };
  globalThis.window = { ...eventTarget(), location: { reload: () => state.reloads++ } };
  globalThis.document = { ...eventTarget(), visibilityState: "visible" };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });
  globalThis.fetch = async (url, options) => {
    assert.ok(url.pathname.endsWith('/version.json'));
    assert.equal(options.cache, "no-store");
    state.checks++;
    return state.response(options.signal);
  };
  let watcher;
  t.after(async () => {
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
  });
  const source = await readFile(new URL('../js/deployment-version.js', import.meta.url), 'utf8');
  await writeFile(path.join(temp, 'version.mjs'), production ? source.replace('__BUILD_VERSION__', buildVersion) : source);
  const module = await import(pathToFileURL(path.join(temp, 'version.mjs')));
  watcher = module.watchForDeploymentUpdate(() => { state.announcements++; onUpdate(); });
  await watcher.check();
  return { state, watcher, window: globalThis.window, document: globalThis.document, navigator: globalThis.navigator };
}

test('production watcher detects a later deployment once, coalesces concurrent events and never reloads', async t => {
  const { state, watcher, window, document } = await watcherHarness(t);
  assert.equal(state.checks, 1);
  assert.equal(state.announcements, 0);
  let resolve;
  state.response = () => new Promise(done => { resolve = done; });
  const checking = watcher.check();
  window.dispatch('focus'); window.dispatch('online'); document.dispatch('visibilitychange');
  assert.equal(watcher.check(), checking);
  assert.equal(state.checks, 2);
  resolve(Response.json({ version: nextVersion })); await checking;
  for (let i = 0; i < 3; i++) { await watcher.check(); window.dispatch('focus'); document.dispatch('visibilitychange'); }
  assert.equal(state.announcements, 1);
  assert.equal(state.checks, 2);
  assert.equal(state.reloads, 0);
});

test('network, invalid metadata and offline checks stay quiet and a later successful check recovers', async t => {
  const { state, watcher, window, navigator } = await watcherHarness(t);
  for (const response of [
    () => { throw new TypeError('offline'); }, () => new Response('unavailable', { status: 503 }),
    () => new Response('not JSON'), ...[null, {}, { version: '' }, { version: ' ' }, { version: 2 },
      { version: 'another-app-222222222222' }, { version: '__BUILD_VERSION__' }].map(value => () => Response.json(value)),
  ]) {
    state.response = response; await watcher.check();
    assert.equal(state.announcements, 0);
  }
  state.response = () => Response.json({ version: nextVersion });
  const before = state.checks;
  navigator.onLine = false; await watcher.check();
  assert.equal(state.checks, before);
  navigator.onLine = true; await window.dispatch('online');
  assert.equal(state.announcements, 1);
  assert.equal(state.reloads, 0);
});

test('long-open tabs check every five minutes and on focus, online, visible pageshow/visibility with cleanup', async t => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const { state, watcher, window, document } = await watcherHarness(t);
  t.mock.timers.tick(299999); assert.equal(state.checks, 1);
  t.mock.timers.tick(1); await settle(); assert.equal(state.checks, 2);
  for (const name of ['focus', 'online', 'pageshow']) { window.dispatch(name); await watcher.check(); }
  document.dispatch('visibilitychange'); await watcher.check();
  assert.equal(state.checks, 6);
  document.visibilityState = 'hidden'; document.dispatch('visibilitychange'); window.dispatch('pageshow');
  assert.equal(state.checks, 6);
  document.visibilityState = 'visible'; document.dispatch('visibilitychange'); await watcher.check();
  assert.equal(state.checks, 7);
  state.response = () => Response.json({ version: nextVersion });
  t.mock.timers.tick(300000); await settle();
  assert.equal(state.announcements, 1);
  watcher.stop(); watcher.stop();
  assert.equal(window.listeners.size, 0); assert.equal(document.listeners.size, 0);
  const before = state.checks;
  t.mock.timers.tick(600000); await watcher.check();
  assert.equal(state.checks, before);
});

test('stopping during response parsing suppresses late notices and aborts the request', async t => {
  const { state, watcher } = await watcherHarness(t);
  let finish, signal;
  state.response = inputSignal => {
    signal = inputSignal;
    return { ok: true, json: () => new Promise(resolve => { finish = resolve; }) };
  };
  const checking = watcher.check(); await settle();
  watcher.stop();
  assert.equal(signal.aborted, true);
  finish({ version: nextVersion }); await checking;
  assert.equal(state.announcements, 0);
});

test('timed-out checks abort quietly and do not prevent later detection', async t => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const { state, watcher } = await watcherHarness(t);
  let signal;
  state.response = inputSignal => new Promise((resolve, reject) => {
    signal = inputSignal; signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  const checking = watcher.check();
  t.mock.timers.tick(15000); await checking;
  assert.equal(signal.aborted, true); assert.equal(state.announcements, 0);
  state.response = () => Response.json({ version: nextVersion }); await watcher.check();
  assert.equal(state.announcements, 1);
});

test('source development creates no update checks or listeners', async t => {
  const { state, watcher, window, document } = await watcherHarness(t, { production: false });
  await watcher.check(); watcher.stop();
  assert.equal(state.checks, 0); assert.equal(state.announcements, 0);
  assert.equal(window.listeners.size, 0); assert.equal(document.listeners.size, 0);
});

test('loading the new build against matching deployment metadata does not start a reload loop', async t => {
  const { state, watcher } = await watcherHarness(t, { buildVersion: nextVersion });
  await watcher.check();
  assert.equal(state.announcements, 0); assert.equal(state.reloads, 0);
});

function noticeDOM(document) {
  const notices = [], classes = new Set();
  const editor = { value: 'Tulisan semasa.', selectionStart: 4, selectionEnd: 4 };
  document.activeElement = editor;
  document.body = { append: notice => notices.push(notice), classList: { add: name => classes.add(name) } };
  document.createElement = tag => {
    assert.equal(tag, 'section');
    const button = { disabled: false }, attributes = {};
    return { attributes, button, setAttribute: (key, value) => { attributes[key] = value; },
      querySelector: selector => { assert.equal(selector, 'button'); return button; } };
  };
  return { notices, classes, editor };
}

test('persistent Malay notice appears only on a confirmed update; draft, caret, selections, AI and autosave stay intact', async t => {
  let show;
  const h = await watcherHarness(t, { onUpdate: () => show() });
  const { notices, classes, editor } = noticeDOM(h.document);
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const store = createStore({ storage });
  store.setYear(5); store.navigate('essay');
  const pack = getCurriculumPack(5), topic = pack.essayTopics[0];
  store.selectTitle(topic.title, topic.id);
  const draft = store.draft('essay', topic.title, pack, { contentId: topic.id });
  const paragraphs = ['Saya pergi ke pantai.', 'Saya bersama keluarga.', 'Kami mandi laut.', 'Saya gembira.'];
  store.updateDraft(draft.id, { paragraphs, stage: 3 });
  store.runtime.ai = 'ready';
  const aiPanel = { innerHTML: 'Maklum balas Cikgu AI.' };
  const before = storage.getItem(STORAGE_KEY), stateBefore = structuredClone(store.state);
  let saves = 0, reloads = 0;
  show = createDeploymentUpdateNotice({ saveBeforeReload: () => { saves++; return store.persist(); },
    onSaveFailure: () => assert.fail('Save should succeed'), reload: () => reloads++ });
  assert.equal(notices.length, 0);
  h.state.response = () => Response.json({ version: nextVersion });
  await h.window.dispatch('focus');
  show(); show(); await h.watcher.check();
  assert.equal(notices.length, 1);
  assert.equal(saves, 0); assert.equal(reloads, 0);
  assert.equal(storage.getItem(STORAGE_KEY), before);
  assert.deepEqual(store.state, stateBefore);
  assert.equal(store.runtime.ai, 'ready'); assert.equal(aiPanel.innerHTML, 'Maklum balas Cikgu AI.');
  assert.equal(h.document.activeElement, editor); assert.equal(editor.selectionStart, 4);
  assert.ok(classes.has('deployment-update-visible'));
  const notice = notices[0];
  assert.equal(notice.className, 'deployment-update-notice');
  assert.deepEqual(notice.attributes, { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  assert.match(notice.innerHTML, /Versi baharu tersedia/);
  assert.match(notice.innerHTML, /Aplikasi telah dikemas kini\. Muat semula untuk menggunakan versi terkini\./);
  assert.match(notice.innerHTML, /<button type="button"[^>]*aria-label="Muat semula aplikasi untuk menggunakan versi terkini">Muat semula<\/button>/);
  // Normal writing and navigation continue while the independent notice remains.
  paragraphs[2] += ' Air laut sejuk.'; store.updateDraft(draft.id, { paragraphs });
  store.navigate('home'); store.navigate('essay'); show();
  assert.equal(notices.length, 1);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)).drafts[draft.id].paragraphs, paragraphs);
  notice.button.onclick(); notice.button.onclick();
  assert.equal(saves, 1); assert.equal(reloads, 1); assert.equal(notice.button.disabled, true);
  const restored = createStore({ storage });
  assert.deepEqual(restored.state.drafts[draft.id].paragraphs, paragraphs);
  assert.equal(restored.state.year, 5); assert.equal(restored.state.activity, 'essay');
  assert.equal(restored.state.selectedEssayTitle[5], topic.title);
  assert.equal(restored.state.selectedEssayContent[5], topic.id);
  assert.equal(restored.state.drafts[draft.id].stage, 3);
});

test('reload remains blocked and retryable when the existing local save fails', async t => {
  const h = await watcherHarness(t), { notices } = noticeDOM(h.document);
  let saves = 0, warnings = 0, canSave = false;
  const show = createDeploymentUpdateNotice({ saveBeforeReload: () => { saves++; return canSave; }, onSaveFailure: () => warnings++ });
  show();
  assert.equal(h.state.reloads, 0);
  notices[0].button.onclick();
  assert.equal(warnings, 1); assert.equal(h.state.reloads, 0); assert.equal(notices[0].button.disabled, false);
  canSave = true;
  notices[0].button.onclick(); notices[0].button.onclick();
  assert.equal(saves, 2); assert.equal(h.state.reloads, 1);
});

test('app wires the notice once outside rendering and retains responsive/accessibility styles', async () => {
  const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.equal((app.match(/watchForDeploymentUpdate\(/g) || []).length, 1);
  assert.match(app, /watchForDeploymentUpdate\(createDeploymentUpdateNotice\(\{\s*saveBeforeReload: \(\) => store.persist\(\),\s*onSaveFailure: \(\) => toast\(labels.temporary\)/);
  assert.doesNotMatch(app, /updateAvailable|update-banner|data-update/);
  const css = await readFile(new URL('../styles/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.deployment-update-notice \{[^}]*position: fixed;[^}]*max-width: 620px;[^}]*flex-wrap: wrap;/);
  assert.match(css, /\.deployment-update-notice > div \{[^}]*min-width: 0; overflow-wrap: anywhere/);
  assert.match(css, /\.deployment-update-notice button \{ min-height: 44px; max-width: 100%; white-space: normal/);
  assert.match(css, /\.deployment-update-visible \.main-shell \{ padding-bottom:/);
  assert.match(css, /:focus-visible \{\s*outline: 3px solid var\(--color-focus\)/);
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
    for (const endpoint of ["/api/gemini", "/api/ai/tutor"]) {
      const api = await fetch(base + endpoint, {
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
      assert.equal(api.status, 500);
      assert.equal(api.headers.get("Cache-Control"), "no-store");
      assert.equal((await api.json()).error.code, "AI_NOT_CONFIGURED");
    }
  } finally {
    child.kill();
  }
});
