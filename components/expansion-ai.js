import { e, list } from './ui.js';
import { exampleCards } from './ai-examples.js';

export function renderExpansionFeedback(feedback, request) {
  if (feedback.kind === 'keyword_meaning') {
    return `<section class="keyword-meaning-output"><h3>Maksud Kata Kunci: ${e(feedback.keyword)}</h3>
      <dl class="meaning-languages"><div lang="ms"><dt>Bahasa Melayu</dt><dd>${e(feedback.maksud_bm)}</dd></div>
      <div lang="en"><dt>English</dt><dd>${e(feedback.meaning_en)}</dd></div>
      <div lang="zh-Hans"><dt>中文（华文）</dt><dd>${e(feedback.meaning_zh)}</dd></div></dl>
      <div class="ai-example-list">${exampleCards([{ type: 'sentence', text: feedback.contoh_ayat }], request)}</div></section>`;
  }
  const examples = feedback.examples.map(example => ({ type: 'sentence', text: example.text }));
  return `<section class="ai-hint-result expansion-ai-feedback"><h3>Petunjuk untuk kamu</h3><p class="guidance-summary">${e(feedback.summary)}</p>
    ${feedback.errors.length ? `<h4>Perkara yang perlu diperhatikan</h4>${list(feedback.errors)}` : ''}
    ${feedback.suggestions.length ? `<h4>Cadangan untuk kamu</h4>${list(feedback.suggestions)}` : ''}
    ${feedback.explanation ? `<p>${e(feedback.explanation)}</p>` : ''}
    ${examples.length ? `<div class="ai-example-list">${exampleCards(examples, request)}</div>` : ''}
    <p class="small muted">Contoh ialah pilihan untuk kamu ubah suai. Tulisan kamu kekal disimpan.</p></section>`;
}
