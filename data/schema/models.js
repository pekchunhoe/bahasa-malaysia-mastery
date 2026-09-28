/**
 * @typedef {Object} LearningItem
 * @property {string} id Stable workbook item_id, never a sheet row number.
 * @property {number} year
 * @property {'ejaan'|'imlak'} type
 * @property {'word'|'phrase'|'sentence'} form Display distinction only, not grammatical/idiom classification.
 * @property {string} text Reviewed teks_app. An entry is never split into words.
 * @property {number|null} themeNo
 * @property {string} theme Empty if not supplied.
 * @property {number} unitNo
 * @property {string} unit Empty if not supplied.
 * @property {number} itemNo
 * @property {string} edition
 *
 * @typedef {Object} VocabularyEntry
 * @property {string} id
 * @property {string} word
 * @property {number} yearMin
 * @property {number} yearMax
 * @property {number=} year
 * @property {string} category
 * @property {string} meaning
 * @property {string} example
 * @property {string} theme
 * @property {string[]} tags
 * @property {string=} notes
 * @property {string=} audioText
 * @property {{kind:string,reference:string}} source
 *
 * @typedef {Object} CurriculumPack
 * @property {'ms-MY'} language
 * @property {string} curriculumId
 * @property {string} version
 * @property {number} year
 * @property {boolean} demo
 * @property {string[]} themes
 * @property {string} vocabularySource
 * @property {VocabularyEntry[]} vocabulary
 * @property {LearningItem[]} items
 * @property {{no:number,title:string,theme:string}[]} units
 * @property {Object} activitySets
 * @property {Object[]} writingTopics
 * @property {Object} difficultyProfile
 */
export function validYear(year) {
  return Number.isInteger(year) && year >= 1 && year <= 6;
}
export function normalizeVocabulary(records) {
  if (!Array.isArray(records)) throw new Error("Vocabulary must be an array");
  const ids = new Set();
  return records.map((record) => {
    if (
      !record ||
      typeof record.id !== "string" ||
      !record.id.trim() ||
      ids.has(record.id)
    )
      throw new Error("Vocabulary IDs must be unique");
    ids.add(record.id);
    const yearMin = record.yearMin ?? record.year,
      yearMax = record.yearMax ?? record.year;
    if (!validYear(yearMin) || !validYear(yearMax) || yearMin > yearMax)
      throw new Error("Invalid vocabulary year range");
    for (const field of ["word", "category", "meaning", "example", "theme"])
      if (typeof record[field] !== "string" || !record[field].trim())
        throw new Error(`Missing vocabulary ${field}`);
    if (
      !record.source ||
      typeof record.source.kind !== "string" ||
      typeof record.source.reference !== "string"
    )
      throw new Error("Vocabulary source required");
    return {
      id: record.id,
      word: record.word.trim(),
      yearMin,
      yearMax,
      category: record.category,
      meaning: record.meaning,
      example: record.example,
      theme: record.theme,
      tags: Array.isArray(record.tags)
        ? record.tags.filter((tag) => typeof tag === "string")
        : [],
      notes: typeof record.notes === "string" ? record.notes : "",
      audioText:
        typeof record.audioText === "string" ? record.audioText : record.word,
      source: { kind: record.source.kind, reference: record.source.reference },
    };
  });
}
