import {
  vocabulary,
  activitySets,
  writingTopics,
} from "../data/demo/content.js";
import { normalizeVocabulary, validYear } from "../data/schema/models.js";
import { difficultyFor } from "../data/difficulty.js";
import { master } from "../data/generated/master.js";
import { supplementaryFor, attachEnrichment } from "./enrichment-service.js";
const sources = new Map([
  [
    "demo",
    { version: "0.1.0", demo: true, vocabulary, activitySets, writingTopics },
  ],
]);
sources.set("master-2026", { version: master.version, demo: false, items: master.items,
  vocabulary: [], activitySets: {
    sentence: { title: "Ayat ciptaan saya", seeds: {} },
    expansion: { title: "Tambah butiran yang bermakna", prompts: activitySets.expansion.prompts },
    paragraph: { title: "Perenggan ciptaan saya", prompt: "Pilih satu idea sendiri. Cipta hubungan antara ayat supaya idea kamu jelas. Ayat imlak ialah latihan berasingan, bukan satu cerita yang bersambung.", fields: activitySets.paragraph.fields },
    story: activitySets.story,
    practice: { title: "Latihan Ejaan & Imlak" },
  }, writingTopics, reference: "MASTER_CONTENT", writingDemo: true });

export function filterItems(items, { year, unit = "all", type } = {}) {
  return items.filter(i => (year == null || i.year === year) &&
    (unit === "all" || i.unitNo === Number(unit)) && (!type || i.type === type));
}
export function registerCurriculum(id, source) {
  if (
    !id ||
    !source?.version ||
    !source.activitySets ||
    !Array.isArray(source.writingTopics)
  )
    throw new Error("Invalid curriculum source");
  sources.set(id, {
    ...source,
    vocabulary: normalizeVocabulary(source.vocabulary),
  });
}
export function getCurriculumPack(year, curriculumId = "master-2026", supplementaryContent) {
  if (!validYear(year)) throw new Error("Invalid year");
  const source = sources.get(curriculumId);
  if (!source) throw new Error("Unknown curriculum");
  const items = filterItems(source.items || [], { year });
  const supplemental = source.items ? supplementaryFor(year, supplementaryContent) : null;
  const words = source.items ? items.filter(i => i.type === "ejaan" || supplemental.enrichment[i.id]?.word).map(i => ({
    ...i, word: supplemental.enrichment[i.id]?.word || i.text,
    audioText: supplemental.enrichment[i.id]?.word || i.text, yearMin: i.year, yearMax: i.year,
    category: "", meaning: "", example: "", tags: [], source: { kind: "workbook", reference: i.id },
  })) : normalizeVocabulary(source.vocabulary).filter(
    (w) => w.yearMin <= year && w.yearMax >= year,
  );
  return structuredClone({
    language: "ms-MY",
    curriculumId,
    version: source.version,
    enrichmentVersion: supplemental?.version || "",
    year,
    demo: source.demo === true,
    items,
    units: [...new Map(items.map(i => [i.unitNo, { no: i.unitNo, title: i.unit, theme: i.theme }])).values()],
    themes: [...new Set((source.items ? items : words).map((w) => w.theme).filter(Boolean))],
    writingDemo: source.writingDemo === true,
    vocabularySource: source.demo ? "data/demo/content.js" : source.reference,
    vocabulary: supplemental ? [
      ...attachEnrichment(words, supplemental.enrichment).map(w => ({ ...w,
        source_type: w.type === "ejaan" ? "reviewed_source" : w.enrichment.source_type })),
      ...supplemental.vocabularyBank.map(w => ({
        id: w.id, word: w.word, audioText: w.word, yearMin: year, yearMax: year,
        source_type: w.source_type, source: { kind: "teacher_authored", reference: w.id },
        category: "", meaning: "", example: "", theme: "", tags: [], enrichment: w,
      })),
    ] : words,
    enrichment: supplemental?.enrichment || {},
    storyStarters: supplemental?.storyStarters || [],
    activitySets: source.activitySets,
    writingTopics: supplemental ? supplemental.guidedWriting.map(t => ({
      ...t, genre: t.writing_type, questions: t.planning_questions || [],
      yearMin: year, yearMax: year,
    })) : source.writingTopics.filter(
      (t) => t.yearMin <= year && t.yearMax >= year,
    ),
    difficultyProfile: difficultyFor(year),
  });
}
export function resolveSuggestedVocabulary(word, pack) {
  const match = pack.vocabulary.find(
    (entry) =>
      entry.word.toLocaleLowerCase("ms") ===
      word.trim().toLocaleLowerCase("ms"),
  );
  return match
    ? { source: "curated", entry: match }
    : { source: "ai", word, authoritative: false };
}
