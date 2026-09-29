import {
  buildTutorPrompt,
  cacheIdentity,
  executionMode,
  normalizeFeedback,
  tutorRequest,
} from "./tutor-actions.js";
export function createAIService({
  fetcher = globalThis.fetch,
  modes = {},
  now = Date.now,
  timeoutMs = 40000,
} = {}) {
  const cache = new Map(),
    pending = new Set();
  return {
    prompt: buildTutorPrompt,
    async request(raw, { signal, mode } = {}) {
      signal?.throwIfAborted();
      const request = tutorRequest(raw);
      // A manual local fallback can never upgrade a prompt-only task to paid API.
      if (
        mode === "prompt" ||
        executionMode(request.action, modes) === "prompt"
      )
        return { mode: "prompt", prompt: buildTutorPrompt(request) };
      const key = cacheIdentity(request),
        cached = cache.get(key);
      if (cached && cached.expires > now())
        return structuredClone(cached.result);
      if (pending.has(key))
        throw new Error("Cikgu AI sedang membaca. Tunggu sebentar.");
      pending.add(key);
      const controller = new AbortController();
      let timedOut = false;
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      const timer = setTimeout(() => {
        timedOut = true;
        abort();
      }, timeoutMs);
      try {
        const response = await fetcher("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit",
        });
        const envelope = await response.json();
        if (!response.ok || envelope.ok !== true)
          throw new Error(
            envelope.error?.message ||
              "Cikgu AI tidak dapat dihubungi. Cuba lagi kemudian.",
          );
        if (envelope.action !== request.action)
          throw new Error("Maklum balas tidak sepadan. Cuba lagi.");
        const result = {
          mode: "api",
          source_type: "ai_generated",
          feedback: normalizeFeedback(envelope.data),
        };
        controller.signal.throwIfAborted();
        if (cache.size >= 40) cache.delete(cache.keys().next().value);
        cache.set(key, {
          result: structuredClone(result),
          expires: now() + 5 * 60 * 1000,
        });
        return result;
      } catch (error) {
        if (signal?.aborted) throw error;
        if (timedOut)
          throw new Error(
            "Cikgu AI mengambil masa terlalu lama. Cuba lagi atau jana prompt.",
          );
        if (error instanceof TypeError || error instanceof SyntaxError)
          throw new Error("Sambungan terganggu. Cuba lagi atau jana prompt.");
        throw error;
      } finally {
        clearTimeout(timer);
        pending.delete(key);
        signal?.removeEventListener("abort", abort);
      }
    },
    clearCache() {
      cache.clear();
    },
  };
}
