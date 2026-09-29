import { test } from "node:test";
import assert from "node:assert/strict";
import { createTeacherHandler } from "../server/ai-handler.js";
import { createAIService } from "../js/ai-teacher.js";
import { actionActivities, buildTutorPrompt, essayHintFeedbackSchema, tutorActions, tutorRequest } from "../js/tutor-actions.js";
import endpoint from "../api/gemini.js";
import legacyEndpoint from "../api/ai/tutor.js";
import { openTeacher } from "../components/ai-teacher.js";
import { toast } from "../components/ui.js";

const env = {
  GEMINI_API_KEY: "fixture-only-private-key",
  GEMINI_FAST_MODEL: "configured-model-from-environment",
  GEMINI_ADVANCED_MODEL: "must-never-be-used",
  GEMINI_MODEL: "must-never-be-used-either",
};
const feedback = {
  ok: true, summary: "Ayat kamu jelas.", errors: [],
  suggestions: ["Tambah butiran jika perlu."], explanation: "Ini cadangan pilihan.", example: null,
};
const input = (action = "sentence_check", changes = {}) => ({
  action, activity: Object.keys(actionActivities).find(key => actionActivities[key].includes(action)),
  year: 3, title: "Keluarga Saya", studentText: 'Ibu berkata, "Mari makan."\nSaya gembira — café 😊.',
  ...changes,
});
const request = data => new Request("http://localhost/api/gemini", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
});
const handlerOptions = {
  env, limiter: { acquire: () => () => {} }, logger: { warn() {} },
};
const sdkResponse = text => Response.json({
  id: "fixture-interaction", status: "completed", model: env.GEMINI_FAST_MODEL,
  steps: [{ type: "model_output", content: [{ type: "text", text }] }],
});

test("legacy endpoint exports the same handler", () => {
  assert.equal(endpoint, legacyEndpoint);
});

test("every direct action traverses frontend, shared handler and real SDK with only the configured model", async t => {
  const captured = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const upstream = new Request(url, init);
    assert.equal(new URL(upstream.url).hostname, "generativelanguage.googleapis.com");
    assert.ok(!upstream.url.includes(env.GEMINI_API_KEY));
    assert.equal(upstream.headers.get("x-goog-api-key"), env.GEMINI_API_KEY);
    captured.push(await upstream.json());
    return sdkResponse(JSON.stringify(feedback));
  });
  const handler = createTeacherHandler(handlerOptions);
  const service = createAIService({ fetcher: (url, options) => {
    assert.equal(url, "/api/gemini");
    assert.ok(!JSON.stringify(options).includes(env.GEMINI_API_KEY));
    return handler(new Request("http://localhost" + url, options));
  } });
  for (const [action, config] of Object.entries(tutorActions)) {
    if (config.mode !== "api") continue;
    const raw = input(action, { model: "client-override-ignored" });
    const original = structuredClone(raw);
    const result = await service.request(raw);
    assert.deepEqual(result.feedback, feedback);
    assert.deepEqual(raw, original);
    const sent = captured.at(-1);
    assert.equal(sent.model, env.GEMINI_FAST_MODEL);
    assert.equal(sent.system_instruction, buildTutorPrompt(raw));
    assert.equal(sent.store, false);
    assert.equal(sent.response_format.mime_type, "application/json");
    assert.equal(sent.generation_config.max_output_tokens, 900);
    if (action === "essay_next_step")
      assert.deepEqual(sent.response_format.schema, essayHintFeedbackSchema);
  }
  assert.equal(captured.length, 8);
});

test("missing server settings fail before SDK invocation with explicit safe diagnostics", async () => {
  for (const [key, code] of [["GEMINI_API_KEY", "AI_NOT_CONFIGURED"], ["GEMINI_FAST_MODEL", "AI_MODEL_NOT_CONFIGURED"]]) {
    for (const value of [undefined, "", "   "]) {
      let calls = 0;
      const handler = createTeacherHandler({ ...handlerOptions, env: { ...env, [key]: value },
        generate: async () => { calls++; return JSON.stringify(feedback); },
      });
      const response = await handler(request(input()));
      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.error.code, code);
      assert.equal(body.error.configuration, `${key} is not configured`);
      assert.equal(calls, 0);
    }
  }
});

test("SDK errors make one attempt, never switch models and redact upstream secrets from response and logs", async t => {
  for (const [upstreamStatus, code] of [[400, "AI_MODEL_ERROR"], [401, "AI_AUTH_ERROR"], [403, "AI_AUTH_ERROR"], [404, "AI_MODEL_ERROR"], [429, "AI_RATE_LIMIT"], [500, "AI_UNAVAILABLE"], [503, "AI_UNAVAILABLE"]]) {
    await t.test(String(upstreamStatus), async t => {
      const models = [], logs = [];
      t.mock.method(globalThis, "fetch", async (url, init) => {
        models.push((await new Request(url, init).json()).model);
        return Response.json({ error: { code: upstreamStatus, message: `Private diagnostic ${env.GEMINI_API_KEY}` } }, { status: upstreamStatus });
      });
      const handler = createTeacherHandler({ ...handlerOptions, logger: { warn: (...args) => logs.push(args) } });
      const response = await handler(request(input()));
      const body = await response.json();
      assert.equal(body.error.code, code);
      assert.deepEqual(models, [env.GEMINI_FAST_MODEL]);
      assert.ok(!JSON.stringify({ body, logs }).includes(env.GEMINI_API_KEY));
      assert.ok(!JSON.stringify(logs).includes("Private diagnostic"));
    });
  }
});

test("network and malformed SDK responses are controlled and never retried", async t => {
  for (const kind of ["network", "malformed"]) await t.test(kind, async t => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls++;
      if (kind === "network") throw new TypeError("Connection failed");
      return sdkResponse("not JSON");
    });
    const response = await createTeacherHandler(handlerOptions)(request(input()));
    const body = await response.json();
    assert.equal(body.error.code, kind === "network" ? "AI_NETWORK_ERROR" : "AI_INVALID_RESPONSE");
    assert.equal(calls, 1);
  });
});

test("empty checks and oversized writing fail locally, blank hints and long valid writing preserve input", async () => {
  let captured;
  const handler = createTeacherHandler({ ...handlerOptions, generate: async raw => {
    captured = raw; return JSON.stringify(feedback);
  } });
  for (const studentText of ["", "x".repeat(16001)])
    assert.equal((await handler(request(input("sentence_check", { studentText })))).status, 400);
  for (const raw of [input("sentence_hint", { studentText: "" }), input("sentence_check", { studentText: "a".repeat(15990) + "\nCafé 😊" })]) {
    assert.equal((await handler(request(raw))).status, 200);
    assert.deepEqual(captured, tutorRequest(raw));
  }
});

test("teacher buttons render feedback/errors and copy external prompts without changing student work", async t => {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: "", textContent: "", disabled: false,
      dataset: { copyExample: /^\[data-copy-example="(\d+)"\]$/.exec(selector)?.[1] },
      setAttribute() {},
      querySelector: node,
      querySelectorAll(selector) {
        return selector === "[data-copy-example]"
          ? [node('[data-copy-example="0"]'), node('[data-copy-example="1"]')]
          : [];
      },
      classList: { add() {}, remove() {} },
      showModal() { this.open = true; }, close() { this.open = false; this.onclose?.(); },
    });
    return nodes.get(selector);
  };
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let copied, calls = 0, fail = false;
  Object.defineProperty(globalThis, "document", { configurable: true, value: { querySelector: node } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async text => { copied = text; } } } });
  t.after(() => {
    clearTimeout(toast.timer);
    for (const [key, descriptor] of [["document", originalDocument], ["navigator", originalNavigator]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const handler = createTeacherHandler({ ...handlerOptions, generate: async () => {
    calls++;
    if (fail) throw Object.assign(new Error("quota"), { status: 429 });
    return JSON.stringify(feedback);
  } });
  const service = createAIService({ fetcher: (url, options) => handler(new Request("http://localhost" + url, options)) });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const store = { runtime: { ai: "idle" }, state: { draft: { text: input().studentText } } };
  const saved = structuredClone(store.state);
  for (const action of ["sentence_check", "essay_next_step", "word_explanation"]) {
    openTeacher({ service, request: input(action), store });
    await settle();
    assert.equal(store.runtime.ai, "ready");
    assert.ok(node("#teacher-result").innerHTML.includes(feedback.summary));
    assert.equal(node("#teacher-run").disabled, false);
    await node("#teacher-run").onclick();
    assert.deepEqual(store.state, saved);
  }
  const hintFeedback = {
    ok: true,
    summary: "Kamu sudah memperkenalkan suasana pagi itu dengan baik.",
    suggestions: ["Ceritakan acara yang kamu sertai."],
    questions: ["Siapakah yang memberi sokongan kepada kamu?"],
    examples: ["Saya berbaris di hadapan padang.", "Rakan-rakan saya bersorak dengan kuat."],
  };
  const hintService = createAIService({
    fetcher: async () => Response.json({ ok: true, action: "essay_next_step", data: hintFeedback }),
  });
  const hintRequest = input("essay_next_step", {
    activity: "essay",
    title: "Hari Sukan Sekolah Saya",
    studentText: "Pada pagi itu, saya memakai baju sukan biru.",
  });
  openTeacher({ service: hintService, request: hintRequest, store });
  await settle();
  assert.match(node("#teacher-result").innerHTML, /Kamu boleh sambung dengan/);
  assert.match(node("#teacher-result").innerHTML, /Contoh ayat/);
  assert.equal((node("#teacher-result").innerHTML.match(/data-copy-example/g) || []).length, 2);
  await node('[data-copy-example="0"]').onclick();
  assert.equal(copied, hintFeedback.examples[0]);
  assert.equal(node('[data-copy-example="0"]').textContent, "Disalin ✓");
  assert.deepEqual(store.state, saved);
  assert.equal(calls, 3);
  service.clearCache();
  fail = true;
  openTeacher({ service, request: input(), store });
  await settle();
  assert.equal(store.runtime.ai, "error");
  assert.match(node("#teacher-result").innerHTML, /role="alert"/);
  assert.equal(node("#teacher-run").disabled, false);
  assert.deepEqual(store.state, saved);
  const before = calls;
  await node("#teacher-prompt").onclick();
  await node("#copy-prompt").onclick();
  assert.equal(copied, buildTutorPrompt(input()));
  for (const action of ["paragraph_review", "essay_review"]) {
    openTeacher({ service, request: input(action), store });
    await settle();
    assert.match(node("#teacher-result").innerHTML, /Salin prompt/);
    assert.deepEqual(store.state, saved);
  }
  assert.equal(calls, before);
});
