import { teacherContent } from "../data/teacher/content.js";
import { normalizeTeacherContent, contentYears, isPublished } from "../data/schema/enrichment.js";
import { master } from "../data/generated/master.js";

// Validate during module loading: the normal production build already loads
// every curriculum pack. No spreadsheet parser or AI belongs in this layer.
const content = normalizeTeacherContent(teacherContent, master.items);
export function supplementaryFor(year, collection = content) {
  const forYear = records => records.filter(r => contentYears(r).includes(year) && isPublished(r));
  return structuredClone({
    version: `${master.version}:${collection.version}`,
    enrichment: { ...master.enrichment, ...Object.fromEntries(collection.enrichment.filter(isPublished).map(r => [r.source_item_id, r])) },
    vocabularyBank: forYear(collection.vocabularyBank).filter(r => r.source_type === "teacher_authored" && r.status === "reviewed"),
    guidedWriting: forYear(collection.guidedWriting),
    storyStarters: forYear(collection.storyStarters),
  });
}

export function attachEnrichment(words, enrichment) {
  // Deliberately no spread of an enrichment record into a reviewed source item.
  return words.map(word => ({ ...word, enrichment: enrichment[word.id] || null }));
}
