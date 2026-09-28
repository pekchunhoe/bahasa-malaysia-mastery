import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tutorActions,
  actionActivities,
  tutorRequest,
  executionMode,
  buildTutorPrompt,
  cacheIdentity,
  normalizeFeedback,
} from "../js/tutor-actions.js";
import { createAIService } from "../js/ai-teacher.js";
import { createTeacherHandler } from "../server/ai-handler.js";
import { createTutorLimiter } from "../server/ai-rate-limit.js";
import { selectGeminiModel } from "../server/gemini.js";
const input = (changes = {}) => ({
  action: "sentence_check",
  activity: "sentence",
  year: 3,
  title: "Petang",
  studentText: "Ali bermain bola.",
  ...changes,
});
const feedback = {
  ok: true,
  summary: "Ayat kamu jelas.",
  errors: [],
  suggestions: ["Nyatakan tempat jika membantu pembaca."],
  explanation: "Butiran tempat ialah pilihan.",
  example: null,
};
const request = (data, options = {}) =>
  new Request("http://localhost/api/ai/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    ...options,
  });
const mockEnv = { GEMINI_API_KEY: "fixture-only-server-secret" };
const okResponse = (action) =>
  Response.json({ ok: true, action, data: feedback });
test("all ten tutor actions route through a single configuration", () => {
  assert.equal(Object.keys(tutorActions).length, 10);
  for (const [activity, actions] of Object.entries(actionActivities))
    for (const action of actions) {
      const result = tutorRequest(input({ action, activity }));
      assert.equal(result.action, action);
      assert.equal(
        executionMode(action),
        ["paragraph_review", "essay_review"].includes(action)
          ? "prompt"
          : "api",
      );
    }
  assert.equal(
    executionMode("sentence_check", { sentence_check: "prompt" }),
    "prompt",
  );
  assert.throws(() => executionMode("unknown"));
  assert.throws(() => tutorRequest(input({ activity: "vocabulary" })));
});
test("request validation trims values, rejects invalid years/actions/oversize/empty checks", () => {
  assert.equal(
    tutorRequest(input({ studentText: " Ali bermain. " })).studentText,
    "Ali bermain.",
  );
  for (const changes of [
    { year: "3" },
    { year: 0 },
    { year: 7 },
    { action: "write_essay" },
    { studentText: "" },
    { studentText: "x".repeat(16001) },
    { title: "x".repeat(161) },
    { studentText: 5 },
  ])
    assert.throws(() => tutorRequest(input(changes)));
  assert.doesNotThrow(() =>
    tutorRequest(input({ action: "sentence_hint", studentText: "" })),
  );
});
test("every guided-writing action includes selected year/title/student text without local scaffold leakage", () => {
  for (const action of actionActivities.essay) {
    const raw = input({
      action,
      activity: "essay",
      title: "Tajuk Pilihan",
      studentText: "Tulisan sebenar saya.",
      year: 6,
      context: { modelAnswer: "FORBIDDEN_A", hints: "FORBIDDEN_B" },
      plan: "FORBIDDEN_C",
      presetParagraph: "FORBIDDEN_D",
    });
    const clean = tutorRequest(raw),
      prompt = buildTutorPrompt(raw);
    assert.deepEqual(Object.keys(clean), [
      "action",
      "activity",
      "year",
      "title",
      "studentText",
    ]);
    assert.equal(clean.year, 6);
    assert.equal(clean.title, "Tajuk Pilihan");
    assert.equal(clean.studentText, "Tulisan sebenar saya.");
    assert.ok(prompt.includes("Tajuk Pilihan"));
    assert.ok(prompt.includes("Tulisan sebenar saya."));
    assert.ok(!prompt.includes("FORBIDDEN"));
    assert.throws(() => tutorRequest({ ...raw, title: "" }));
  }
});
test("prompt pedagogy changes with year and separates errors from optional suggestions", () => {
  const young = buildTutorPrompt(input({ year: 1 })),
    older = buildTutorPrompt(input({ year: 6 }));
  assert.notEqual(young, older);
  assert.ok(young.includes("paling banyak dua cadangan"));
  assert.ok(older.includes("koheren"));
  assert.ok(young.includes("Jangan mereka-reka kesalahan"));
  assert.ok(young.includes("Cadangan untuk menjadikan ayat lebih baik"));
});
test("cache identity changes with essay title, year, activity and student writing", () => {
  const raw = input({ activity: "essay", action: "essay_next_step" }),
    original = cacheIdentity(raw);
  for (const changes of [
    { title: "Tajuk baharu" },
    { year: 6 },
    { studentText: "Tulisan lain." },
  ])
    assert.notEqual(cacheIdentity({ ...raw, ...changes }), original);
});
test("Generate Prompt never calls the network, including expensive reviews", async () => {
  let calls = 0;
  const service = createAIService({
    fetcher: () => {
      calls++;
      throw new Error("Network forbidden");
    },
  });
  for (const action of ["paragraph_review", "essay_review"]) {
    const result = await service.request(input({ action, activity: "essay" }));
    assert.equal(result.mode, "prompt");
    assert.ok(result.prompt.includes("Ali bermain bola."));
  }
  assert.equal(
    (await service.request(input(), { mode: "prompt" })).mode,
    "prompt",
  );
  assert.equal(calls, 0);
});
test("AI service caches successful responses but not other titles and never mutates pupil text", async () => {
  let calls = 0,
    lastBody;
  const raw = input({ action: "essay_next_step", activity: "essay" }),
    snapshot = structuredClone(raw);
  const service = createAIService({
    fetcher: async (_, options) => {
      calls++;
      lastBody = JSON.parse(options.body);
      return okResponse(raw.action);
    },
  });
  const first = await service.request(raw);
  first.feedback.summary = "tampered";
  const cached = await service.request(raw);
  assert.equal(cached.feedback.summary, feedback.summary);
  assert.equal(calls, 1);
  await service.request({ ...raw, title: "Different title" });
  assert.equal(calls, 2);
  assert.equal(lastBody.title, "Different title");
  assert.deepEqual(raw, snapshot);
});
test("duplicate requests prevented, cancellation passed to fetch, cache expiry enforced", async () => {
  let resolveFetch,
    observedSignal,
    clock = 0,
    calls = 0;
  const service = createAIService({
    now: () => clock,
    fetcher: (_, { signal }) => {
      observedSignal = signal;
      calls++;
      return new Promise((resolve) => {
        resolveFetch = resolve;
      });
    },
  });
  const controller = new AbortController(),
    pending = service.request(input(), { signal: controller.signal });
  await assert.rejects(service.request(input()), /sedang membaca/);
  controller.abort();
  assert.equal(observedSignal.aborted, true);
  resolveFetch(okResponse("sentence_check"));
  await assert.rejects(pending);
  const next = service.request(input());
  resolveFetch(okResponse("sentence_check"));
  await next;
  assert.equal(calls, 2);
  clock = 300001;
  const expired = service.request(input());
  resolveFetch(okResponse("sentence_check"));
  await expired;
  assert.equal(calls, 3);
});
test("malformed or failed responses are not cached and cannot overwrite writing", async () => {
  let calls = 0;
  const service = createAIService({
    fetcher: async () => {
      calls++;
      return Response.json({
        ok: true,
        action: "sentence_check",
        data: { prose: "bad" },
      });
    },
  });
  const raw = input();
  await assert.rejects(service.request(raw));
  await assert.rejects(service.request(raw));
  assert.equal(calls, 2);
  assert.equal(raw.studentText, "Ali bermain bola.");
  assert.throws(() =>
    normalizeFeedback({ ...feedback, suggestions: "not an array" }),
  );
});
test("server validates and allowlists input independently and returns no-store structured feedback", async () => {
  let captured;
  const handler = createTeacherHandler({
    env: mockEnv,
    generate: async (data) => {
      captured = data;
      return JSON.stringify(feedback);
    },
  });
  const response = await handler(
    request(input({ context: { hiddenAnswer: "LEAK" } })),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).data.summary, feedback.summary);
  assert.equal(captured.context, undefined);
});
test("server protects method, origin, content type, body size and invalid input", async () => {
  let calls = 0;
  const handler = createTeacherHandler({
    env: mockEnv,
    generate: async () => {
      calls++;
      return JSON.stringify(feedback);
    },
  });
  const cases = [
    [new Request("http://localhost/api/ai/tutor"), 405],
    [request(input(), { headers: { "Content-Type": "text/plain" } }), 415],
    [
      request(input(), {
        headers: {
          "Content-Type": "application/json",
          Origin: "https://foreign.test",
        },
      }),
      403,
    ],
    [request(input({ studentText: "x".repeat(40000) })), 413],
    [request(input({ year: 9 })), 400],
    [request(input(), { body: "{broken" }), 400],
  ];
  for (const [req, status] of cases) {
    const response = await handler(req);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  assert.equal(calls, 0);
});
test("server rejects bypassing prompt-only modes and handles missing credentials", async () => {
  let calls = 0;
  const handler = createTeacherHandler({
    env: {},
    generate: async () => {
      calls++;
      return JSON.stringify(feedback);
    },
  });
  const review = await handler(
    request(input({ action: "essay_review", activity: "essay" })),
  );
  assert.equal(review.status, 400);
  assert.equal((await review.json()).error.code, "PROMPT_ONLY");
  const missing = await handler(request(input()));
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error.code, "AI_NOT_CONFIGURED");
  assert.equal(calls, 0);
});
test("server does not return secrets, malformed responses or upstream diagnostics", async () => {
  for (const generate of [
    async () =>
      JSON.stringify({ ...feedback, summary: mockEnv.GEMINI_API_KEY }),
    async () => "prose instead of JSON",
    async () => {
      throw new Error(mockEnv.GEMINI_API_KEY);
    },
  ]) {
    const handler = createTeacherHandler({ env: mockEnv, generate }),
      response = await handler(request(input()));
    assert.ok(response.status >= 500);
    assert.ok(!(await response.text()).includes(mockEnv.GEMINI_API_KEY));
  }
});
test("server deadline cancels upstream and releases concurrency", async () => {
  let upstreamSignal;
  const handler = createTeacherHandler({
    env: mockEnv,
    timeoutMs: 10,
    generate: async (_, options) => {
      upstreamSignal = options.signal;
      return new Promise(() => {});
    },
  });
  const response = await handler(request(input()));
  assert.equal(response.status, 504);
  assert.equal(upstreamSignal.aborted, true);
});
test("server propagates request cancellation without retries", async () => {
  const controller = new AbortController();
  let calls = 0;
  const handler = createTeacherHandler({
    env: mockEnv,
    generate: async (_, { signal }) => {
      calls++;
      controller.abort();
      assert.equal(signal.aborted, true);
      return new Promise(() => {});
    },
  });
  const response = await handler(
    request(input(), { signal: controller.signal }),
  );
  assert.equal(response.status, 499);
  assert.equal(calls, 1);
});
test("per-client and concurrent rate limits are bounded and reusable after release/window", () => {
  let now = 0;
  const limiter = createTutorLimiter({
    now: () => now,
    perClient: 2,
    concurrent: 1,
  });
  const first = limiter.acquire(request(input()));
  assert.throws(() => limiter.acquire(request(input())), /AI_RATE_LIMIT/);
  first();
  first();
  const second = limiter.acquire(request(input()));
  second();
  assert.throws(() => limiter.acquire(request(input())), /AI_RATE_LIMIT/);
  now = 60001;
  limiter.acquire(request(input()))();
});
test("model choices remain server-controlled", () => {
  assert.ok(selectGeminiModel("sentence_check").model.includes("flash-lite"));
  assert.equal(
    selectGeminiModel("sentence_check", {
      GEMINI_FAST_MODEL: "configured-fast",
    }).model,
    "configured-fast",
  );
  const clean = tutorRequest(
    input({ model: "browser-selected-expensive-model" }),
  );
  assert.equal(clean.model, undefined);
});
