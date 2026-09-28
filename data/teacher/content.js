// Authoring boundary, separate from the generated workbook. These are DEMO
// supplements, not reviewed teacher material. Never add AI output as reviewed.
import { writingTopics, activitySets } from "../demo/content.js";

const demo = { source_type: "demo", status: "demo" };
export const teacherContent = {
  version: "phase3-sample-1",
  enrichment: [], // Master enrichment comes exclusively from the validated JSON export.
  // Future independent vocabulary is authored here, never tokenized from imlak.
  // Only teacher_authored + reviewed records are eligible for the pupil bank.
  vocabularyBank: [],
  // Preserve both existing titles and their IDs. Explicit audience years avoid
  // duplicating the same sample record six times or inventing textbook mapping.
  guidedWriting: writingTopics.map(topic => ({
    ...demo, id: topic.id, year: [1, 2, 3, 4, 5, 6], title: topic.title,
    writing_type: topic.genre, prompt: topic.id === "demo-petang"
      ? "Ceritakan pengalaman kamu menghabiskan waktu petang bersama rakan."
      : "Gambarkan sebuah taman yang bersih dengan kata-kata kamu sendiri.",
    planning_questions: topic.questions,
    vocabulary_help: topic.id === "demo-petang" ? ["rakan", "bersama-sama"] : ["bersih", "menjaga"],
    sentence_starters: topic.id === "demo-petang" ? ["Pada suatu petang, ..."] : ["Taman itu ..."],
    paragraph_guidance: ["Mulakan dengan satu idea. Tambah butiran yang berkaitan dengan idea itu."],
    checklist: ["Adakah tulisan saya berkaitan dengan tajuk?", "Adakah idea saya mudah difahami?"],
    sample_outline: ["Perkenalkan situasi pilihan kamu.", "Kembangkan idea dengan butiran sendiri.", "Akhiri dengan perasaan atau pendapat kamu."],
  })),
  storyStarters: [{
    ...demo, id: activitySets.story.id, year: [1, 2, 3, 4, 5, 6],
    title: activitySets.story.title, starter_text: activitySets.story.opening,
    setting: "Di dalam kelas", continuation_prompts: [activitySets.story.hint],
  }],
};
