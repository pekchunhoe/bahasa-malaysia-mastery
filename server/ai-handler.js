import {
  executionMode,
  MAX_BODY,
  normalizeFeedback,
  tutorRequest,
  TutorInputError,
} from "../js/tutor-actions.js";
import { createTutorLimiter, clientRateLimit } from "./ai-rate-limit.js";
import { generateTeachingResult, TIMEOUT_MS } from "./gemini.js";
import { TeacherError, MAX_OUTPUT } from "./ai-contract.js";
const messages = {
  INVALID_REQUEST: "Permintaan tidak sah. Semak tulisan dan cuba lagi.",
  AI_NOT_CONFIGURED:
    "Cikgu AI belum disambungkan. Kamu boleh jana prompt dan terus menulis.",
  PROMPT_ONLY: "Gunakan Jana Prompt untuk semakan ini.",
  AI_RATE_LIMIT: "Cikgu AI sibuk. Tunggu seminit sebelum mencuba lagi.",
  AI_TIMEOUT: "Cikgu AI mengambil masa terlalu lama. Cuba lagi kemudian.",
  AI_CANCELLED: "Permintaan dibatalkan.",
  AI_INVALID_RESPONSE: "Maklum balas Cikgu AI tidak lengkap. Cuba lagi.",
  AI_UNAVAILABLE: "Cikgu AI tidak dapat dihubungi. Cuba lagi atau jana prompt.",
};
export function createTeacherHandler({
  env = process.env,
  generate = generateTeachingResult,
  modes = {},
  limiter,
  timeoutMs = TIMEOUT_MS,
} = {}) {
  limiter ??= createTutorLimiter({
    perClient: clientRateLimit(env.AI_CLIENT_RPM),
  });
  return async (request) => {
    const reply = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...(status === 405 ? { Allow: "POST" } : {}),
          ...(status === 429 ? { "Retry-After": "60" } : {}),
        },
      });
    let timer, release;
    const controller = new AbortController(),
      abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    try {
      if (request.method !== "POST")
        return reply({ ok: false, error: { message: "Gunakan POST." } }, 405);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new TeacherError("INVALID_REQUEST", 415);
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin)
        throw new TeacherError("INVALID_REQUEST", 403);
      if (Number(request.headers.get("content-length")) > MAX_BODY)
        throw new TeacherError("INVALID_REQUEST", 413);
      const reader = request.body?.getReader();
      if (!reader) throw new TeacherError("INVALID_REQUEST", 400);
      const chunks = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BODY) {
            await reader.cancel();
            throw new TeacherError("INVALID_REQUEST", 413);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      let raw;
      try {
        raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new TeacherError("INVALID_REQUEST", 400);
      }
      const input = tutorRequest(raw);
      if (executionMode(input.action, modes) === "prompt")
        throw new TeacherError("PROMPT_ONLY", 400);
      if (!env.GEMINI_API_KEY?.trim())
        throw new TeacherError("AI_NOT_CONFIGURED", 503);
      release = limiter.acquire(request, env.VERCEL === "1");
      const cancelled = new Promise((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(new TeacherError("AI_CANCELLED", 499)),
          { once: true },
        );
        if (controller.signal.aborted)
          reject(new TeacherError("AI_CANCELLED", 499));
      });
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new TeacherError("AI_TIMEOUT", 504));
          controller.abort();
        }, timeoutMs);
      });
      const result = await Promise.race([
        generate(input, {
          apiKey: env.GEMINI_API_KEY,
          env,
          signal: controller.signal,
        }),
        timeout,
        cancelled,
      ]);
      if (
        typeof result !== "string" ||
        result.length > MAX_OUTPUT ||
        result.includes(env.GEMINI_API_KEY)
      )
        throw new TeacherError("AI_INVALID_RESPONSE", 502);
      let data;
      try {
        data = normalizeFeedback(JSON.parse(result));
      } catch {
        throw new TeacherError("AI_INVALID_RESPONSE", 502);
      }
      return reply({ ok: true, action: input.action, data });
    } catch (error) {
      const code =
        error instanceof TutorInputError
          ? "INVALID_REQUEST"
          : error instanceof TeacherError
            ? error.code
            : Number(error?.status) === 429
              ? "AI_RATE_LIMIT"
              : "AI_UNAVAILABLE";
      const status =
        error instanceof TutorInputError
          ? 400
          : error instanceof TeacherError
            ? error.status
            : code === "AI_RATE_LIMIT"
              ? 429
              : 503;
      return reply(
        {
          ok: false,
          error: { code, message: messages[code] || messages.AI_UNAVAILABLE },
        },
        status,
      );
    } finally {
      clearTimeout(timer);
      release?.();
      request.signal.removeEventListener("abort", abort);
    }
  };
}
