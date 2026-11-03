import {
  buildTutorPrompt,
  essayHintFeedbackSchema,
  essayExampleActions,
  essayExampleFeedbackSchema,
  essayVividFeedbackSchema,
  feedbackSchema,
  isEssayReview,
} from "../js/tutor-actions.js";
import { TeacherError, MAX_OUTPUT } from "./ai-contract.js";
import { expansionFeedbackSchema, keywordMeaningSchema, detailExpansionFeedbackSchema, detailExpansionAction } from '../js/expansion-tutor.js';
import { memoryNotesSchema, memoryReviewSchema, buildMemoryPrompt } from '../js/memory-tutor.js';
export const TIMEOUT_MS = 35000;
// Same SDK and Interactions route as the source project; server configuration only.
export function selectGeminiModel(action, env = process.env, activity) {
  const model = isEssayReview({ action, activity }) ? 'gemini-3.5-flash-lite' : env.GEMINI_FAST_MODEL;
  if (!model?.trim())
    throw new TeacherError("AI_MODEL_NOT_CONFIGURED", 500);
  const advanced = ["paragraph_review", "essay_review"].includes(action);
  return {
    model,
    maxTokens: action === 'memory_points' ? 8192 : action === 'memory_review' ? 4096
      : advanced ? 1800 : action === 'keyword_meaning' ? 1400 : 900,
  };
}
export async function generateTeachingResult(input, { apiKey, env, signal }) {
  const route = selectGeminiModel(input.action, env, input.activity);
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const result = await ai.interactions.create(
    {
      model: route.model,
      system_instruction: input.activity === 'memory' ? buildMemoryPrompt(input, { includeData: false }) : buildTutorPrompt(input),
      input: input.activity === 'memory' ? `DATA MURID: ${JSON.stringify(input)}` : "Berikan bimbingan untuk DATA MURID di atas.",
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema:
          input.activity === 'memory'
            ? input.action === 'memory_points' ? memoryNotesSchema : memoryReviewSchema
          : input.activity === 'expansion'
            ? input.action === 'keyword_meaning' ? keywordMeaningSchema
              : input.action === detailExpansionAction ? detailExpansionFeedbackSchema : expansionFeedbackSchema
            : input.action === 'essay_vivid'
            ? essayVividFeedbackSchema
            : essayExampleActions.includes(input.action)
              ? essayExampleFeedbackSchema
              : input.action === "essay_next_step"
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
