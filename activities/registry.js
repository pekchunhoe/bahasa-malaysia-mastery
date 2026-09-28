import { renderVocabulary } from "./vocabulary.js";
import { renderPractice } from "./practice.js";
import { renderSentence, renderExpansion } from "./sentence.js";
import { renderParagraph, renderEssay, renderStory } from "./writing.js";
// Add an activity renderer here and its navigation metadata in js/config.js.
export const activityRegistry = {
  vocabulary: { render: renderVocabulary },
  practice: { render: renderPractice, task: "practice" },
  sentence: { render: renderSentence, task: "sentence" },
  expansion: { render: renderExpansion, task: "expansion" },
  paragraph: { render: renderParagraph, task: "paragraph" },
  essay: { render: renderEssay },
  story: { render: renderStory, task: "story" },
};
