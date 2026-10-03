# Karangan Berpandu: Jadikan lebih menarik — whole paragraph

Verified on 3 October 2026. No commit or push performed.

## Existing implementation audit

The implementation was traced before editing:

| Concern | Existing path and behaviour |
| --- | --- |
| Button and event | `components/writing.js` builds native `data-ai` / `data-ai-paragraph` buttons. `js/app.js` delegates clicks to `aiRequest`. The action is `essay_vivid`. |
| Current paragraph | `syncEssayEditors` first saves live pupil edits. `buildEssayParagraphContext` in `js/essay-paragraphs.js` selects the entire current editor, not a sentence or selection. |
| Title and year | `aiRequest` supplies the selected title, stable content ID and the selected essay's actual year, falling back to the workspace year. |
| Position and context | Paragraph index 1–4 maps to `paragraphLabels`; stage is preserved. Only preceding paragraphs accompany the current paragraph. Later paragraphs, model essays and hidden planning material are excluded by `tutorRequest`. |
| Pedagogy and prompt | `js/tutor-actions.js` builds shared essay instructions from `data/difficulty.js`, then appends either JSON output instructions or readable Jana Prompt instructions. Title and writing are quoted separately, delimiter glyphs escaped, and every pupil line prefixed. |
| Server route | `js/ai-teacher.js` posts to `/api/gemini`. `api/gemini.js` and the legacy `/api/ai/tutor` export the shared handler in `server/ai-handler.js`. `server/gemini.js` calls the existing Google SDK Interactions API using the configured server model. |
| Old response | `essay_vivid`, `essay_ideas` and `essay_develop` shared `essayExampleFeedbackSchema`: summary, suggestions and typed examples. A paragraph example was optional. |
| Validation | The server parses JSON and calls `normalizeFeedback`; the client independently normalizes before caching. Previously, a sentence example alone satisfied this action. |
| Renderer and copying | `components/ai-teacher.js` renders escaped example text into separate soft-red cards and binds one `onclick` per native button. `components/clipboard.js` copies the associated string only, guards concurrent writes, announces `Disalin ✓`, and resets after 1,800 ms. Its fallback restores focus and selection. |
| Loading and failure | The dialog disables run/prompt controls while loading, supports abort on close, and shows safe retryable errors. Invalid results are not cached. These mechanisms remain intact. |
| Drafts and autosave | `js/app.js` and `js/state.js` save pupil edits and preserve existing revision snapshots before requesting AI. The feedback dialog changes runtime state only; copying has no editor or draft mutation path. |
| Existing tests | Essay example, external prompt, paragraph context, controller, SDK routing, catalog, state, speech and integration tests already cover the shared consumers. |

Root cause: the shared prompt explicitly preferred sentence examples and made a short paragraph optional (discouraging long paragraph examples for younger pupils). The schema and validator accepted sentence-only responses. The renderer could only show whatever optional examples arrived.

## Change and contract

Only `essay_vivid` now selects `essayVividFeedbackSchema`. It retains `ok`, `summary`, `suggestions` and `examples`, and requires `improvedParagraph`:

- Meaningful current writing requires a nonempty, meaningful string. Whitespace/punctuation-only, wrong-type, oversized, obvious markup/JSON/headings and multi-paragraph output fail validation. The same validation runs on the server and client.
- Empty or meaningless current writing requires `null` and continues to receive starter guidance. It cannot display a falsely improved paragraph card.
- `examples` contains zero to three supplementary sentence objects. Neither a sentence nor an old typed paragraph example substitutes for the required field.
- The normalizer trims outer whitespace consistently with existing examples and returns `kind: 'essay_vivid'`. The displayed and copied paragraph strings are identical.

The shared prompt now requires analysis and rewriting of the entire current paragraph, preserving all core ideas through its end, original facts, point of view and voice. Existing year profiles remain authoritative. Earlier writing is explicitly context only. The readable external prompt has the same mandatory whole-paragraph requirement without exposing API fields.

The renderer prepends one dedicated **Contoh perenggan yang dipertingkat** card using the existing soft-red markup and CSS. Supplementary sentence cards follow separately. Each button maps directly to its own normalized string; headings, guidance, suggestions and other examples never enter the clipboard payload. Native button semantics, accessible contextual labels, polite confirmation, visible focus styles, touch targets and clipboard fallback are reused.

No changes to Gemini model selection, token limits, API routing, clipboard implementation, editor handling, storage, curriculum, catalog, speech or CSS were needed.

## Files changed

- `js/tutor-actions.js`: dedicated schema, context-aware validation, whole-paragraph prompt instructions, readable external prompt.
- `server/gemini.js`: select the dedicated schema for this action only.
- `components/ai-teacher.js`: dedicated labelled paragraph card through the existing renderer and copy flow.
- `tests/fixtures/essay-examples.mjs`: distinct vividness fixture.
- `tests/essay-ai-examples.test.mjs`: full context/pedagogy, field validation, empty writing, safe retries, exact copy, reset/repeat, long prose and draft isolation.
- `tests/essay-paragraphs.test.mjs`: use the new response fixture while preserving all-action context coverage.
- `tests/gemini-routing.test.mjs`: verify the actual SDK request schema and unchanged model, endpoint and token settings.
- `tests/phase3-controller.test.mjs`: successful generation/copy through real controllers, unchanged editors and stored paragraphs, subsequent autosave/reload.
- This audit record.

## Verification

| Check | Result |
| --- | --- |
| Focused essay/context/external-prompt/SDK/controller tests | PASS: 78 tests |
| `npm test` including data preparation | PASS: 164 tests, 0 failures |
| `npm run build` | PASS: 42 static assets; `bmMastery-a6f3a2f867f2` |
| `npm run check` | PASS: 106 JavaScript modules plus whitespace/conflict and public-asset checks |
| `git diff --check` | PASS |
| Title/year selection, filtering, stable IDs/model pairing, navigation, drafts, autosave, examples, speech and other AI actions | PASS: existing automated regression coverage |
| Layout and accessibility implementation | Existing wrapping, narrow-screen stacking, 44px targets, native buttons, accessible labels, polite confirmation and focus styles retained; markup/CSS/clipboard checks pass |
| Narrow phone, landscape phone, tablet and desktop browser verification | NOT VERIFIED: browser runtime initialized, selection returned “No browser is available”, documented discovery returned an empty list |
| Real keyboard Enter/Space activation and visual focus | NOT VERIFIED: no available browser; native button semantics and focus-preserving clipboard code retained |
| Live Gemini content quality | NOT VERIFIED: tests mock AI responses; prompts constrain fidelity, coherence and year appropriateness but cannot prove model compliance |

Malformed/truncated model output produces the existing retryable error rather than a false successful sentence-only result. The existing output-token budget is unchanged, so unusually long paragraphs may still encounter that error.
