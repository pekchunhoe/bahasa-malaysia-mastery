// Memory practice belongs to a pupil draft and an exact source version.
// Neither model essays nor original paragraphs can enter the final writing.
export function memorySource(state) {
  const draft = state.drafts[state.activeDrafts[`${state.year}:essay`]];
  const selected = state.selectedEssayContent[state.year];
  const title = state.selectedEssayTitle[state.year];
  if (!draft || draft.activity !== 'essay' || draft.year !== state.year ||
      (selected && draft.contentId !== selected) || (title && draft.title !== title)) return null;
  const paragraphs = (Array.isArray(draft.paragraphs) ? draft.paragraphs : [draft.text])
    .flatMap(text => text.split(/\r?\n\s*\r?\n/)).map(text => text.trim()).filter(Boolean);
  return { draft, source: paragraphs.length ? { title: draft.title, paragraphs } : null };
}
export const sourceIdentity = source => JSON.stringify([source.title, source.paragraphs]);
export function ensureMemoryVersion(draft, source) {
  draft.memory ??= { versions: [] };
  let index = draft.memory.versions.findIndex(v => sourceIdentity(v.source) === sourceIdentity(source));
  if (index < 0) {
    index = draft.memory.versions.length;
    draft.memory.versions.push({ source: structuredClone(source), notes: null,
      writing: source.paragraphs.map(() => ''), feedback: source.paragraphs.map(() => null),
      paragraph: 0, activity: 0, finalOpen: true });
  }
  return index;
}
const invalid = () => { throw Error('Maklum balas Cikgu AI tidak lengkap. Cuba lagi.'); };
const short = (value, max) => typeof value === 'string' && !!value.trim() && value.length <= max;
export function normalizeMemoryNotes(raw, paragraphs) {
  if (!raw || !Array.isArray(raw.paragraphs) || raw.paragraphs.length !== paragraphs.length) invalid();
  return { paragraphs: raw.paragraphs.map((p, i) => {
    if (!p || p.paragraphIndex !== i + 1 || !short(p.heading, 160) ||
        !Array.isArray(p.points) || !p.points.length || !p.points.every(point =>
          point && short(point.text, 800) && typeof point.cue === 'string' && point.cue.length <= 40)) invalid();
    return { paragraphIndex: i + 1, heading: p.heading.trim(),
      points: p.points.map(point => ({ text: point.text.trim(), cue: point.cue.trim() })) };
  }) };
}
export function normalizeMemoryReview(raw, points) {
  if (!raw || !Array.isArray(raw.points) || raw.points.length !== points.length ||
      !short(raw.suggestion, 1000)) invalid();
  const assessments = raw.points.map((point, i) => {
    if (!point || point.pointIndex !== i + 1 || !['penuh', 'sebahagian', 'tiada'].includes(point.status) ||
        !short(point.comment, 500)) invalid();
    return { pointIndex: i + 1, status: point.status, comment: point.comment.trim() };
  });
  for (const key of ['sequence', 'language']) {
    if (!raw[key] || !['betul', 'perlu_dibaiki'].includes(raw[key].status) || !short(raw[key].comment, 700)) invalid();
  }
  return { points: assessments, remembered: assessments.filter(p => p.status === 'penuh').length,
    total: points.length, sequence: { status: raw.sequence.status, comment: raw.sequence.comment.trim() },
    language: { status: raw.language.status, comment: raw.language.comment.trim() }, suggestion: raw.suggestion.trim() };
}
export function finalMemoryEssay(version) {
  const paragraphs = version.writing.filter(text => text.trim());
  return paragraphs.length ? [version.source.title, ...paragraphs].filter(Boolean).join('\n\n') : '';
}
export function hydrateMemory(raw) {
  if (!raw || !Array.isArray(raw.versions)) return undefined;
  const versions = [];
  for (const v of raw.versions) {
    if (!v?.source || typeof v.source.title !== 'string' || v.source.title.length > 160 ||
        !Array.isArray(v.source.paragraphs) || !v.source.paragraphs.length ||
        !v.source.paragraphs.every(p => short(p, 16000)) || v.source.paragraphs.join('\n\n').length > 16000 ||
        !Array.isArray(v.writing) || v.writing.length !== v.source.paragraphs.length ||
        !v.writing.every(p => typeof p === 'string' && p.length <= 16000)) continue;
    let notes = null;
    try { if (v.notes) notes = normalizeMemoryNotes(v.notes, v.source.paragraphs); } catch { /* Keep pupil writing. */ }
    const feedback = v.source.paragraphs.map((_, i) => {
      const f = v.feedback?.[i];
      try {
        if (typeof f?.writing === 'string' && f.writing.length <= 16000 && typeof f.notesKey === 'string' && f.notesKey.length <= 24000) {
          const checkedNotes = normalizeMemoryNotes({ paragraphs: [{ ...JSON.parse(f.notesKey), paragraphIndex: 1 }] }, ['source']);
          return { writing: f.writing, notesKey: f.notesKey,
            result: normalizeMemoryReview(f.result, checkedNotes.paragraphs[0].points) };
        }
      } catch { /* Malformed feedback must never discard pupil writing. */ }
      return null;
    });
    versions.push({ source: structuredClone(v.source), writing: [...v.writing], notes, feedback,
      paragraph: Number.isInteger(v.paragraph) ? Math.max(0, Math.min(v.source.paragraphs.length - 1, v.paragraph)) : 0,
      activity: [0, 1, 2].includes(v.activity) ? v.activity : 0, finalOpen: v.finalOpen !== false });
  }
  return { versions };
}
