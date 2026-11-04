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
const lexicalWords = /[\p{L}\p{M}\p{N}]+(?:[-‐‑][\p{L}\p{M}\p{N}]+)*/gu;
const functionWords = new Set('dan yang di ke dari daripada kepada pada untuk dengan oleh dalam itu ini ialah adalah atau serta akan telah sudah kami kita saya mereka dia kamu ia seorang sebuah sebiji'.split(' '));
// Offsets use JavaScript UTF-16 indices. Match entire Unicode lexical tokens,
// then select ONE occurrence; never replace every matching substring.
export function memoryHighlight(sentence, boldWord, range) {
  if (typeof sentence !== 'string' || typeof boldWord !== 'string' ||
      !/^\p{L}[\p{L}\p{M}\p{N}]*(?:[-‐‑][\p{L}\p{M}\p{N}]+)*$/u.test(boldWord) ||
      functionWords.has(boldWord.toLocaleLowerCase('ms'))) return null;
  const words = [...sentence.matchAll(lexicalWords)];
  if (words.length < 2) return null;
  const match = words.find(word => word[0] === boldWord &&
    (range === undefined || (range?.start === word.index && range?.end === word.index + word[0].length)));
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}
export function memoryPointView(point) {
  const sentence = typeof point.importantSentence === 'string' ? point.importantSentence : point.text || '';
  return { sentence, primaryKeyword: point.primaryKeyword ?? point.cue ?? '',
    additionalKeywords: Array.isArray(point.additionalKeywords) ? point.additionalKeywords : [],
    highlight: memoryHighlight(sentence, point.boldWord, point.highlight) };
}
export function normalizeMemoryPoint(point, { requireKeywords = false } = {}) {
  if (!point || typeof point !== 'object') invalid();
  const structured = requireKeywords || ['importantSentence', 'primaryKeyword', 'additionalKeywords', 'boldWord', 'highlight'].some(key => Object.hasOwn(point, key));
  const sentence = requireKeywords ? point.importantSentence : structured ? point.importantSentence ?? point.text : point.text;
  if (!short(sentence, 800)) invalid();
  if (!structured) {
    if (typeof point.cue !== 'string' || point.cue.length > 40) invalid();
    return { text: sentence.trim(), cue: point.cue.trim() };
  }
  const primary = requireKeywords ? point.primaryKeyword : point.primaryKeyword ?? point.cue;
  const primaryKeyword = short(primary, 160) ? primary.trim() : '';
  const validAdditional = Array.isArray(point.additionalKeywords) && point.additionalKeywords.every(cue => short(cue, 160));
  const boldWord = typeof point.boldWord === 'string' ? point.boldWord : '';
  const highlight = memoryHighlight(sentence.trim(), boldWord, point.highlight);
  if (requireKeywords && (!primaryKeyword || !validAdditional || !highlight)) invalid();
  const seen = new Set([primaryKeyword.toLocaleLowerCase('ms')]);
  const additionalKeywords = (Array.isArray(point.additionalKeywords) ? point.additionalKeywords : [])
    .filter(cue => short(cue, 160)).map(cue => cue.trim()).filter(cue => {
      const key = cue.toLocaleLowerCase('ms');
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  return { primaryKeyword, additionalKeywords, importantSentence: sentence.trim(), boldWord, highlight };
}
export function normalizeMemoryNotes(raw, paragraphs, options) {
  if (!raw || !Array.isArray(raw.paragraphs) || raw.paragraphs.length !== paragraphs.length) invalid();
  return { paragraphs: raw.paragraphs.map((p, i) => {
    if (!p || p.paragraphIndex !== i + 1 || !short(p.heading, 160) ||
        !Array.isArray(p.points) || !p.points.length) invalid();
    return { paragraphIndex: i + 1, heading: p.heading.trim(),
      points: p.points.map(point => normalizeMemoryPoint(point, options)) };
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
