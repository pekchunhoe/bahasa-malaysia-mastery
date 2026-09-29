export const paragraphLabels = [
  'Pendahuluan', 'Isi / Perkembangan', 'Isi / Perkembangan', 'Penutup',
];
export const MAX_ESSAY_TEXT = 16000;
export function validParagraphs(value) {
  return Array.isArray(value) && value.length === 4 && value.every(p => typeof p === 'string');
}
// Keep legacy prose byte-for-byte, including formatting, in the first editor.
export function essayParagraphs(draft) {
  return validParagraphs(draft.paragraphs) ? [...draft.paragraphs] : [draft.text || '', '', '', ''];
}
export function combineEssay(paragraphs) {
  return paragraphs.filter(p => p.length > 0).join('\n\n');
}
export function buildEssayParagraphContext({ title, year, paragraphIndex, paragraphs }) {
  if (!validParagraphs(paragraphs) || !Number.isInteger(paragraphIndex) || paragraphIndex < 1 || paragraphIndex > 4)
    throw new Error('Konteks perenggan tidak sah.');
  return { title, year, paragraphIndex,
    previousParagraphs: paragraphs.slice(0, paragraphIndex - 1),
    studentText: paragraphs[paragraphIndex - 1] };
}
