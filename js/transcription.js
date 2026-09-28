// Local transcription feedback only. Creative writing never calls this comparator.
const spacing = text => String(text).normalize("NFC").trim().replace(/\s+/gu, " ");
const words = text => text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) || [];
export function compareTranscription(reference, attempt) {
  const expected = spacing(reference), actual = spacing(attempt);
  if (!actual) return { correct: false, errors: ["Taip percubaan kamu dahulu."], suggestions: [] };
  const a = words(expected), b = words(actual), errors = [];
  if (a.map(w => w.toLocaleLowerCase("ms")).join(" ") !== b.map(w => w.toLocaleLowerCase("ms")).join(" "))
    errors.push("Semak ejaan, bilangan dan susunan perkataan.");
  if (a.length === b.length && a.some((w, i) => w.toLocaleLowerCase("ms") === b[i].toLocaleLowerCase("ms") && w !== b[i]))
    errors.push("Semak huruf besar dan huruf kecil.");
  // Preserve punctuation positions relative to word boundaries, not just totals.
  const punctuation = text => text.replace(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu, "W").replace(/\s+/gu, "");
  const expectedPunctuation = punctuation(expected), actualPunctuation = punctuation(actual);
  if (expectedPunctuation.replaceAll("W", "") !== actualPunctuation.replaceAll("W", "") ||
      (a.length === b.length && expectedPunctuation !== actualPunctuation))
    errors.push("Semak tanda baca dan kedudukannya.");
  if (actual !== expected && !errors.length) errors.push("Semak jarak antara perkataan dan tanda baca.");
  return { correct: actual === expected, errors, suggestions: [] };
}
