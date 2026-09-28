// Limited surface checks only; never a grammar grade or reference comparison.
export function checkWritingBasics(text) {
  const value = String(text ?? ""), trimmed = value.trim(), messages = [];
  if (!trimmed) return { scope: "surface_only", messages: ["Tulis ayat kamu dahulu."] };
  const firstLetter = trimmed.match(/\p{L}/u)?.[0];
  if (firstLetter && firstLetter !== firstLetter.toLocaleUpperCase("ms"))
    messages.push("Semak huruf besar pada permulaan tulisan.");
  if (!/[.!?][\u201d\u2019"')\]]*$/u.test(trimmed))
    messages.push("Semak tanda baca pada akhir tulisan, seperti noktah, tanda soal atau tanda seru.");
  if (/[ \t]{2,}/u.test(trimmed)) messages.push("Semak ruang berulang antara perkataan.");
  if (value !== trimmed) messages.push("Semak ruang kosong di awal atau akhir tulisan.");
  return { scope: "surface_only", messages };
}
