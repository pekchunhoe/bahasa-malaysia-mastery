import { e } from './ui.js';
import { memoryPointView } from '../js/essay-memory.js';

export function memorySentenceHTML(point) {
  const { sentence, highlight } = memoryPointView(point);
  return highlight ? `${e(sentence.slice(0, highlight.start))}<strong>${e(sentence.slice(highlight.start, highlight.end))}</strong>${e(sentence.slice(highlight.end))}` : e(sentence);
}
export function renderMemoryPoints(paragraph) {
  return `<ol class="memory-points">${paragraph.points.map(point => {
    const { primaryKeyword, additionalKeywords } = memoryPointView(point);
    return `<li><div class="memory-keywords">${primaryKeyword ? `<strong>${e(primaryKeyword)}</strong>` : '<span class="muted">Isi penting</span>'}${additionalKeywords.length ? `<span class="memory-supporting">${additionalKeywords.map(e).join(' • ')}</span>` : ''}</div><div class="memory-sentence">${memorySentenceHTML(point)}</div></li>`;
  }).join('')}</ol>`;
}
// Self-contained tables survive rich-text paste without depending on app CSS.
// All text, including each selected word, passes through the shared HTML escape.
export function memoryNotesClipboard(version) {
  if (!version.notes?.paragraphs.length) return null;
  const text = [version.source.title], tables = [];
  for (const paragraph of version.notes.paragraphs) {
    const heading = `Perenggan ${paragraph.paragraphIndex} — ${paragraph.heading}`;
    text.push(heading);
    const rows = paragraph.points.map(point => {
      const { sentence, primaryKeyword, additionalKeywords, highlight } = memoryPointView(point);
      const marked = highlight ? `${sentence.slice(0, highlight.start)}**${sentence.slice(highlight.start, highlight.end)}**${sentence.slice(highlight.end)}` : sentence;
      text.push(`[KATA KUNCI]\n${[primaryKeyword, ...additionalKeywords].filter(Boolean).join(' | ') || 'Isi penting'}\n\n${marked}`);
      return `<tr><td width="30%" style="width:30%;border:1px solid #cfb6b6;background-color:#faf1f1;padding:8px 10px;text-align:left;vertical-align:top;overflow-wrap:anywhere;font-weight:400;"><strong>${e(primaryKeyword || 'Isi penting')}</strong>${additionalKeywords.length ? `<div style="margin-top:4px;font-size:10pt;font-weight:400;">${additionalKeywords.map(e).join(' • ')}</div>` : ''}</td><td width="70%" style="width:70%;padding:8px 10px;text-align:left;vertical-align:top;font-weight:400;overflow-wrap:anywhere;">${memorySentenceHTML(point)}</td></tr>`;
    }).join('');
    tables.push(`<h2 style="font-size:13pt;margin:16px 0 8px;">${e(heading)}</h2><table aria-label="${e(heading)}" style="width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0 6px;text-align:left;font-weight:400;"><tbody>${rows}</tbody></table>`);
  }
  return { text: text.filter(Boolean).join('\n\n'), html: `<html><body><div style="font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;color:#272222;font-weight:400;"><h1 style="font-size:16pt;margin:0 0 12px;">${e(version.source.title)}</h1>${tables.join('')}</div></body></html>` };
}
