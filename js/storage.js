// Adapted from Mandarin Mastery's defensive, versioned local storage boundary.
import { validYear } from "../data/schema/models.js";
import { navigation } from "./config.js";
export const STORAGE_KEY = "bmMastery:state:v1";
const routes = new Set(navigation.map((item) => item.id));
const writingRoutes = new Set([
  "sentence",
  "expansion",
  "paragraph",
  "essay",
  "story",
  "practice",
]);
export function freshState() {
  return {
    version: 1,
    year: 1,
    theme: "all",
    unit: "all",
    practice: {},
    activity: "home",
    selectedVocabulary: [],
    selectedEssayTitle: {},
    selectedEssayContent: {},
    writingFilters: {},
    activeDrafts: {},
    drafts: {},
  };
}
export function hydrate(raw) {
  const base = freshState();
  if (!raw || raw.version !== 1) return base;
  if (validYear(raw.year)) base.year = raw.year;
  if (raw.unit === "all" || (Number.isInteger(Number(raw.unit)) && Number(raw.unit) >= 1 && Number(raw.unit) <= 24)) base.unit = String(raw.unit);
  if (raw.practice && typeof raw.practice === "object")
    for (const [id, progress] of Object.entries(raw.practice)) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !progress || typeof progress !== "object") continue;
      base.practice[id] = {
        attempts: Math.max(0, Math.min(100000, Math.floor(Number(progress.attempts) || 0))),
        revealed: progress.revealed === true,
        correct: progress.correct === true,
        independentCorrect: progress.independentCorrect === true,
      };
    }
  if (routes.has(raw.activity)) base.activity = raw.activity;
  if (typeof raw.theme === "string") base.theme = raw.theme.slice(0, 100);
  if (raw.writingFilters && typeof raw.writingFilters === 'object')
    for (const [key, filters] of Object.entries(raw.writingFilters)) {
      if (!/^[1-6]:(essay|paragraph|story)$/.test(key) || !filters || typeof filters !== 'object') continue;
      base.writingFilters[key] = Object.fromEntries(['query', 'category', 'type']
        .filter(name => typeof filters[name] === 'string').map(name => [name, filters[name].slice(0, 160)]));
    }
  if (Array.isArray(raw.selectedVocabulary))
    base.selectedVocabulary = raw.selectedVocabulary
      .filter((x) => typeof x === "string")
      .slice(0, 50);
  if (raw.selectedEssayTitle && typeof raw.selectedEssayTitle === "object")
    for (const [year, title] of Object.entries(raw.selectedEssayTitle))
      if (validYear(Number(year)) && typeof title === "string")
        base.selectedEssayTitle[year] = title.slice(0, 160);
  if (raw.selectedEssayContent && typeof raw.selectedEssayContent === "object")
    for (const [year, id] of Object.entries(raw.selectedEssayContent))
      if (validYear(Number(year)) && typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id))
        base.selectedEssayContent[year] = id;
  if (raw.drafts && typeof raw.drafts === "object")
    for (const [id, draft] of Object.entries(raw.drafts)) {
      if (
        !/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
        !draft ||
        !validYear(draft.year) ||
        !writingRoutes.has(draft.activity) ||
        typeof draft.text !== "string"
      )
        continue;
      const strings = (object) =>
        object && typeof object === "object" && !Array.isArray(object)
          ? Object.fromEntries(
              Object.entries(object)
                .filter(
                  ([key, value]) =>
                    /^[a-zA-Z0-9_-]{1,50}$/.test(key) &&
                    typeof value === "string",
                )
                .map(([key, value]) => [key, value.slice(0, 8000)]),
            )
          : {};
      base.drafts[id] = {
        id,
        year: draft.year,
        activity: draft.activity,
        title: String(draft.title || "").slice(0, 160),
        itemId: typeof draft.itemId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(draft.itemId) ? draft.itemId : "",
        contentId: typeof draft.contentId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(draft.contentId) ? draft.contentId : "",
        source_type: "pupil",
        enrichmentVersion: typeof draft.enrichmentVersion === "string" ? draft.enrichmentVersion.slice(0, 100) : "",
        text: draft.text.slice(0, 16000),
        revisions: Array.isArray(draft.revisions) ? draft.revisions.filter(v => v && typeof v.text === 'string' && Number.isFinite(Date.parse(v.savedAt)))
          .slice(0, 20).map(v => ({ text: v.text.slice(0, 140000), savedAt: v.savedAt })) : [],
        original:
          typeof draft.original === "string"
            ? draft.original.slice(0, 8000)
            : "",
        fields: strings(draft.fields),
        plan: strings(draft.plan),
        stage: Math.min(7, Math.max(0, Math.floor(Number(draft.stage) || 0))),
        lines: Array.isArray(draft.lines)
          ? draft.lines
              .filter((x) => typeof x === "string")
              .slice(0, 30)
              .map((x) => x.slice(0, 4000))
          : [],
        updatedAt: Number.isFinite(Date.parse(draft.updatedAt))
          ? draft.updatedAt
          : new Date(0).toISOString(),
        curriculumId:
          typeof draft.curriculumId === "string" ? draft.curriculumId : "demo",
        contentVersion:
          typeof draft.contentVersion === "string"
            ? draft.contentVersion
            : "0.1.0",
      };
    }
  if (raw.activeDrafts && typeof raw.activeDrafts === "object")
    for (const [key, id] of Object.entries(raw.activeDrafts))
      if (
        base.drafts[id] &&
        key === `${base.drafts[id].year}:${base.drafts[id].activity}`
      )
        base.activeDrafts[key] = id;
  return base;
}
export function loadState(storage) {
  try {
    return hydrate(
      JSON.parse((storage ?? globalThis.localStorage).getItem(STORAGE_KEY)),
    );
  } catch {
    return freshState();
  }
}
export function saveState(state, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(
      STORAGE_KEY,
      JSON.stringify(state),
    );
    return true;
  } catch {
    return false;
  }
}
