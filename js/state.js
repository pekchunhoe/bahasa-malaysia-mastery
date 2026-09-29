import { loadState, saveState } from "./storage.js";
import { validYear } from "../data/schema/models.js";
import { navigation } from "./config.js";
import { writingTopicsFor } from "./essay-service.js";
import { essayParagraphs, combineEssay, validParagraphs, MAX_ESSAY_TEXT } from './essay-paragraphs.js';
export function createStore({
  storage,
  now = () => new Date().toISOString(),
  makeId = () => globalThis.crypto.randomUUID(),
} = {}) {
  let state = loadState(storage);
  let persistent = true;
  const listeners = new Set();
  const runtime = { ai: "idle", speech: { speaking: false, paused: false } };
  const persist = () => {
    persistent = saveState(state, storage);
    for (const fn of listeners) fn(state, persistent);
    return persistent;
  };
  return {
    get state() {
      return state;
    },
    get persistent() {
      return persistent;
    },
    runtime,
    persist,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    navigate(activity) {
      if (!navigation.some((item) => item.id === activity))
        throw new Error("Unknown activity");
      state.activity = activity;
      persist();
    },
    setYear(year) {
      if (!validYear(year)) throw new Error("Invalid year");
      state.year = year;
      state.unit = "all";
      state.theme = "all";
      persist();
    },
    setTheme(theme) {
      state.theme = String(theme);
      persist();
    },
    setWritingFilter(activity, name, value) {
      if (!['essay', 'paragraph', 'story'].includes(activity) || !['query', 'category', 'type'].includes(name)) throw Error('Invalid writing filter');
      const key = `${state.year}:${activity}`;
      state.writingFilters[key] = { ...(state.writingFilters[key] || {}), [name]: String(value).slice(0, 160) };
      persist();
    },
    resetWritingFilters(activity) {
      delete state.writingFilters[`${state.year}:${activity}`];
      persist();
    },
    setUnit(unit) {
      if (unit !== "all" && (!Number.isInteger(Number(unit)) || Number(unit) < 1 || Number(unit) > 24))
        throw new Error("Invalid unit");
      state.unit = String(unit);
      persist();
    },
    practice(id, changes) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid item ID");
      state.practice[id] = { ...(state.practice[id] || { attempts: 0, revealed: false }), ...changes };
      persist();
    },
    selectVocabulary(id) {
      state.selectedVocabulary = [
        ...new Set([...state.selectedVocabulary, id]),
      ].slice(-20);
      persist();
    },
    selectTitle(title, contentId = "") {
      state.selectedEssayTitle[state.year] = title;
      state.selectedEssayContent[state.year] = contentId;
      persist();
    },
    draft(activity, title, pack, { fresh = false, itemId = "", contentId = "" } = {}) {
      const key = `${state.year}:${activity}`;
      let draft = fresh ? null : state.drafts[state.activeDrafts[key]];
      const authored = writingTopicsFor(pack, activity);
      const sameTitle = (authored || []).filter(record => record.title === title);
      const canAdopt = sameTitle.length === 1 && sameTitle[0].id === contentId;
      // Only migrate an unambiguous legacy title. Never guess between starters
      // or reassign a draft that already has a stable identity.
      const matchesContent = d => d.contentId === contentId || (!d.contentId && d.title === title && canAdopt);
      if (draft && (contentId ? matchesContent(draft) : activity !== "essay" || draft.title === title) && (!itemId || draft.itemId === itemId)) {
        if (contentId && !draft.contentId) { draft.contentId = contentId; persist(); }
        return draft;
      }
      if (!fresh && contentId)
        draft = Object.values(state.drafts).reverse().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .find(d => d.year === state.year && d.activity === activity && matchesContent(d));
      if (!fresh && itemId)
        draft = Object.values(state.drafts).reverse().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .find(d => d.year === state.year && d.activity === activity && d.itemId === itemId);
      if (!fresh && activity === "essay" && !contentId)
        draft = Object.values(state.drafts).find(
          (d) =>
            d.year === state.year &&
            d.activity === activity &&
            d.title === title,
        );
      if (!draft) {
        const id = makeId();
        draft = {
          id,
          year: state.year,
          activity,
          title,
          itemId,
          contentId,
          source_type: "pupil",
          enrichmentVersion: pack.enrichmentVersion || "",
          text: "",
          ...(activity === 'essay' ? { paragraphs: ['', '', '', ''] } : {}),
          original: "",
          revisions: [],
          fields: {},
          plan: {},
          lines: [],
          stage: 0,
          updatedAt: now(),
          curriculumId: pack.curriculumId,
          contentVersion: pack.essayTopics?.some(topic => topic.id === contentId) ? pack.essayCatalog.version : pack.version,
        };
        state.drafts[id] = draft;
      }
      if (contentId && !draft.contentId) draft.contentId = contentId;
      state.activeDrafts[key] = draft.id;
      persist();
      return draft;
    },
    updateDraft(id, changes) {
      const draft = state.drafts[id];
      if (!draft) throw new Error("Unknown draft");
      if (draft.activity === 'essay' && ('paragraphs' in changes || 'text' in changes)) {
        const paragraphs = 'paragraphs' in changes ? changes.paragraphs : essayParagraphs({ text: changes.text });
        if (!validParagraphs(paragraphs) || combineEssay(paragraphs).length > MAX_ESSAY_TEXT)
          throw new Error('Karangan melebihi had 16,000 aksara.');
        draft.paragraphs = [...paragraphs];
        changes = { ...changes, text: combineEssay(paragraphs) };
      }
      for (const key of ["text", "fields", "plan", "stage", "lines"])
        if (Object.hasOwn(changes, key))
          draft[key] = structuredClone(changes[key]);
      // The first expansion sentence is an immutable baseline.
      if (!draft.original && typeof changes.original === "string")
        draft.original = changes.original;
      draft.updatedAt = now();
      persist();
      return draft;
    },
    snapshotDraft(id) {
      const draft = state.drafts[id];
      if (!draft) throw Error('Unknown draft');
      const text = draft.activity === 'story' ? [...draft.lines, draft.text].filter(Boolean).join('\n\n') : draft.text;
      if (!text.trim()) return false;
      if (draft.revisions.at(-1)?.text === text) return true;
      if (draft.revisions.length >= 20) return false;
      draft.revisions.push({ text, savedAt: now() });
      persist();
      return true;
    },
    resume(id) {
      const draft = state.drafts[id];
      if (!draft) return false;
      state.year = draft.year;
      state.activity = draft.activity;
      state.theme = "all";
      state.unit = "all";
      state.activeDrafts[`${draft.year}:${draft.activity}`] = id;
      if (draft.activity === "essay") {
        state.selectedEssayTitle[draft.year] = draft.title;
        state.selectedEssayContent[draft.year] = draft.contentId || "";
      }
      persist();
      return true;
    },
    deleteDraft(id) {
      delete state.drafts[id];
      for (const key of Object.keys(state.activeDrafts))
        if (state.activeDrafts[key] === id) delete state.activeDrafts[key];
      persist();
    },
  };
}
