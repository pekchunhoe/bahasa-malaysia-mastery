import {
  buildTutorPrompt,
  essayHintFeedbackSchema,
  feedbackSchema,
} from "../js/tutor-actions.js";
import { TeacherError, MAX_OUTPUT } from "./ai-contract.js";
export const TIMEOUT_MS = 35000;
// Same SDK and Interactions route as the source project; server configuration only.
export function selectGeminiModel(action, env = process.env) {
  const model = env.GEMINI_FAST_MODEL;
  if (!model?.trim())
    throw new TeacherError("AI_MODEL_NOT_CONFIGURED", 500);
  const advanced = ["paragraph_review", "essay_review"].includes(action);
  return {
    model,
    maxTokens: advanced ? 1800 : 900,
  };
}
export async function generateTeachingResult(input, { apiKey, env, signal }) {
  const route = selectGeminiModel(input.action, env);
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const result = await ai.interactions.create(
    {
      model: route.model,
      system_instruction: buildTutorPrompt(input),
      input: "Berikan bimbingan untuk DATA MURID di atas.",
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema:
          input.action === "essay_next_step"
            ? essayHintFeedbackSchema
            : feedbackSchema,
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
