// Speech-only segmentation: keep punctuation and quotes, and retain paragraph gaps.
// Do not use the writing-count regex: a line without a full stop is still spoken.
const abbreviation = /(?:\b(?:dr|prof|en|pn|tn|hj|hjh|no|jln|sdn|bhd|dll|dsb)|\b[A-Z]|(?:\b\p{L}\.)+\p{L})\.$/u;

export function speechUnits(text) {
  const paragraphs = String(text ?? '').replace(/\r\n?/g, '\n').split(/\n\s*\n|\u2029/u);
  const units = [];
  for (const paragraph of paragraphs) {
    const source = paragraph.replace(/\s+/gu, ' ').trim();
    if (!source) continue;
    let start = 0;
    for (const match of source.matchAll(/[.!?]+[”’"')\]]*/gu)) {
      const end = match.index + match[0].length;
      const tail = source.slice(end);
      // Decimal numbers, dotted initials and punctuation inside an unbroken word.
      if (tail && !/^\s/u.test(tail)) continue;
      const head = source.slice(start, end);
      if (match[0] === '.' && (abbreviation.test(head) || abbreviation.test(head.toLowerCase()))) continue;
      // Keep quoted dialogue with its attribution: “Wah!” kata adik.
      if (/[”’"']/u.test(match[0]) && /^\s+\p{Ll}/u.test(tail)) continue;
      units.push({ text: head.trim(), paragraphEnd: false });
      start = end;
    }
    if (source.slice(start).trim()) units.push({ text: source.slice(start).trim(), paragraphEnd: false });
    units.at(-1).paragraphEnd = true;
  }
  return units;
}
