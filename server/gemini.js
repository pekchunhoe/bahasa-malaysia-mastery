import { buildTutorPrompt, feedbackSchema } from "../js/tutor-actions.js";
import { TeacherError, MAX_OUTPUT } from "./ai-contract.js";
export const TIMEOUT_MS = 35000;
// Same SDK and Interactions route as the source project; server configuration only.
export function selectGeminiModel(action, env = {}) {
  const advanced = ["paragraph_review", "essay_review"].includes(action);
  return {
    model: advanced
      ? env.GEMINI_ADVANCED_MODEL || "gemini-3.6-flash"
      : env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite",
    maxTokens: advanced ? 1800 : 900,
  };
}
export async function generateTeachingResult(input, { apiKey, env, signal }) {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey }),
    route = selectGeminiModel(input.action, env);
  const result = await ai.interactions.create(
    {
      model: route.model,
      system_instruction: buildTutorPrompt(input),
      input: "Berikan bimbingan untuk DATA MURID di atas.",
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: feedbackSchema,
      },
      generation_config: { max_output_tokens: route.maxTokens },
    },
    { signal, timeout: TIMEOUT_MS, maxRetries: 0 },
  );
  if (
    !["completed", undefined].includes(result.status) ||
    !result.output_text ||
    result.output_text.length > MAX_OUTPUT
  )
    throw new TeacherError("AI_INVALID_RESPONSE", 502);
  return result.output_text;
}
