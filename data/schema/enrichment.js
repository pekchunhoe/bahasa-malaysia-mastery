import { validYear } from "./models.js";

// Supplementary content only. Source LearningItem fields are deliberately absent.
export const grammaticalCategories = ["kata nama", "kata kerja", "kata adjektif",
  "kata tugas", "frasa", "kata majmuk", "penjodoh bilangan"];
const provenance = ["source_type", "status", "author", "reviewed_by", "reviewed_at"];
const vocabularyText = ["meaning", "simple_definition", "grammatical_category",
  "example_sentence", "example_sentence_simple", "opposite_word", "notes_for_teacher"];
const vocabularyLists = ["related_words"];
const writingText = ["theme", "unit", "prompt", "writing_type", "model_text", "notes_for_teacher"];
const writingLists = ["planning_questions", "vocabulary_help", "sentence_starters",
  "paragraph_guidance", "checklist", "sample_outline"];
const storyText = ["starter_text", "setting", "challenge", "notes_for_teacher"];
const storyLists = ["characters", "vocabulary_hints", "continuation_prompts"];
const identifier = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
export const contentYears = record => Array.isArray(record.year) ? record.year : [record.year];
export const isPublished = record => record.status === "reviewed" || record.status === "demo";

function normalize(record, required, texts, lists, identity) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Invalid supplementary record");
  const allowed = new Set([...required, ...texts, ...lists, ...provenance]);
  for (const key of Object.keys(record))
    if (!allowed.has(key)) throw new Error(`Unknown supplementary field: ${key}`);
  if (!identifier(record[identity])) throw new Error(`Invalid supplementary identity: ${identity}`);
  if (!["teacher_authored", "demo"].includes(record.source_type) ||
      !["draft", "reviewed", "demo"].includes(record.status) ||
      (record.source_type === "demo") !== (record.status === "demo"))
    throw new Error("Demo and reviewed teacher provenance must remain distinct");
  if (record.source_type === "teacher_authored" && record.status === "reviewed" &&
      (!["author", "reviewed_by", "reviewed_at"].every(k => typeof record[k] === "string" && record[k].trim()) ||
       !/^\d{4}-\d{2}-\d{2}$/.test(record.reviewed_at) || !Number.isFinite(Date.parse(record.reviewed_at)) ||
       new Date(record.reviewed_at).toISOString().slice(0, 10) !== record.reviewed_at))
    throw new Error("Reviewed teacher content requires author, reviewed_by and reviewed_at (YYYY-MM-DD)");
  const output = { [identity]: record[identity], source_type: record.source_type, status: record.status };
  for (const key of [...texts, ...provenance.slice(2), ...required.filter(k => k !== identity && k !== "year")]) {
    if (record[key] == null) continue;
    if (typeof record[key] !== "string") throw new Error(`Expected text: ${key}`);
    if (record[key].trim()) output[key] = record[key].trim();
  }
  for (const key of lists) {
    if (record[key] == null) continue;
    if (!Array.isArray(record[key]) || record[key].some(v => typeof v !== "string")) throw new Error(`Expected text list: ${key}`);
    output[key] = record[key].map(v => v.trim()).filter(Boolean);
  }
  if (required.includes("year")) {
    const years = contentYears(record);
    if (!years.length || !years.every(validYear) || new Set(years).size !== years.length) throw new Error("Invalid supplementary year");
    output.year = Array.isArray(record.year) ? [...years] : record.year;
  }
  for (const key of required) if (output[key] == null || output[key] === "") throw new Error(`Missing supplementary ${key}`);
  if (output.grammatical_category && !grammaticalCategories.includes(output.grammatical_category))
    throw new Error("Unknown grammatical category; leave uncertain categories empty");
  return output;
}

/**
 * Optional enrichment is keyed by source_item_id, never by text. Independent
 * vocabulary, essays and stories have their own globally unique IDs and year
 * (1..6 or an explicit array). Optional fields are omitted when blank.
 * source_type/status: demo/demo or teacher_authored/draft|reviewed.
 */
export function normalizeTeacherContent(raw, sourceItems) {
  if (!raw || typeof raw.version !== "string" || !raw.version.trim()) throw new Error("Supplementary version required");
  for (const key of Object.keys(raw))
    if (!["version", "enrichment", "vocabularyBank", "guidedWriting", "storyStarters"].includes(key)) throw new Error(`Unknown supplementary collection: ${key}`);
  const master = new Map(sourceItems.map(i => [i.id, i]));
  const used = new Set();
  const collection = (key, required, texts, lists, identity = "id") => {
    if (!Array.isArray(raw[key] ?? [])) throw new Error(`Invalid collection: ${key}`);
    return (raw[key] || []).map(record => {
      const normalized = normalize(record, required, texts, lists, identity);
      const id = normalized[identity];
      if (used.has(id) || (identity === "id" && master.has(id))) throw new Error(`Duplicate supplementary identity: ${id}`);
      used.add(id);
      return normalized;
    });
  };
  const enrichment = collection("enrichment", ["source_item_id"], vocabularyText, vocabularyLists, "source_item_id");
  for (const record of enrichment) {
    const source = master.get(record.source_item_id);
    if (!source || source.type !== "ejaan" || source.year > 3) throw new Error(`Enrichment must reference a Tahun 1-3 ejaan ID: ${record.source_item_id}`);
  }
  return {
    version: raw.version,
    enrichment,
    vocabularyBank: collection("vocabularyBank", ["id", "year", "word"], vocabularyText, vocabularyLists),
    guidedWriting: collection("guidedWriting", ["id", "year", "title"], writingText, writingLists),
    storyStarters: collection("storyStarters", ["id", "year", "title", "starter_text"], storyText, storyLists),
  };
}
