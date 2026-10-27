# BAHASA MALAYSIA — KEMBANGKAN AYAT MINI COPY PROMPT STATUS

Implemented and validated locally on 27 October 2026. No commit, push or deployment. No live Gemini requests were made for this work.

All 28 checks below PASS for implementation and local verification. Browser clipboard, AI and speech boundaries were mocked; physical devices and external AI responses were not verified.

| # | Requested check | Status | Evidence |
| --- | --- | --- | --- |
| 1 | All seven AI actions audited | PASS | Actual identifiers, labels, schemas and handlers are recorded below. |
| 2 | Tiny copy buttons beside every action | PASS | Exactly seven new native icon controls, each in the same group as its original action. |
| 3 | Existing AI buttons preserved | PASS | Original labels/attributes and direct AI handlers retained; full internal workflow regression passes. |
| 4 | Correct prompt equivalence | PASS | Both routes use the existing action instructions and shared expansion prompt builder; only external output formatting differs. |
| 5 | Current keyword propagation | PASS | Built-in/custom active keyword read at click time; activated change from membantu to menyusun tested. |
| 6 | Current situation propagation | PASS | Active built-in/custom situation resolution reused; switching modes and restoring custom context tested. |
| 7 | Current year propagation | PASS | Selected year included in each fresh snapshot; year changes and all six year-level styles tested. |
| 8 | Current writing propagation | PASS | Current textarea/input values, including unsaved edits and cleared fields, read without saving. Protected original sentences retain priority. |
| 9 | Six general prompts independent of checkboxes | PASS | All six copied prompts are identical with all eight or no details selected. General snapshots do not read detail controls. |
| 10 | Dedicated prompt follows selections | PASS | Live selected IDs/map passed only for sentence_expand_details; four-detail and replacement three-detail sets tested; empty selection rejected. |
| 11 | Rich creative guidance preserved | PASS | Shared keyword/situation/year/creativity guidance unchanged; no word-count ranges or rigid expansion template introduced. |
| 12 | All external prompts request readable output | PASS | Explicit natural Malaysian BM instruction plus action-appropriate headings, explanations and examples. |
| 13 | No JSON requested externally | PASS | Explicit prohibition of JSON, structured objects, technical fields, schemas, code and code blocks; internal JSON instructions remain intact. |
| 14 | Trilingual meaning preserved | PASS | Readable BM, English and 中文解释（华文） sections plus exactly one contextual Malay example with the exact keyword. |
| 15 | Individual example Salin buttons unaffected | PASS | Existing example cards/handlers retained; default clipboard confirmation behavior remains covered by the full suite. |
| 16 | Clipboard-only behavior | PASS | Validate → build locally → copy → transient feedback; no modal, page reload, external site launch or writing insertion. |
| 17 | No Gemini consumption when copying | PASS | Browser/controller tests assert request counts do not change for every copy action, including copying during an internal request. |
| 18 | Student writing protected | PASS | Every browser copy checks the complete saved state is unchanged; live unsaved edits and cleared fields are not persisted. |
| 19 | Autosave preserved | PASS | Existing input/autosave paths remain; restoration and draft-protection regressions pass. |
| 20 | TTS preserved | PASS | Complete speech regression suite and prior browser TTS/navigation checks retained. |
| 21 | Security and credentials protected | PASS | Existing validated context and public pedagogical builder reused; delimited untrusted text; no backend endpoint/dependency/credential added. Source secret/SDK checks pass. |
| 22 | Desktop layout | PASS | 14px icon inside a subtle 25px visual button and a 44×44px interaction target; paired alignment and screenshot inspected. |
| 23 | iPad portrait/landscape | PASS | Every control remains in bounds, adjacent to its action, with readable labels and no horizontal overflow. |
| 24 | Android phone layout | PASS | Portrait/landscape checks pass; pairs stay on one row with natural wrapping within the main action label. |
| 25 | Accessibility | PASS | Native keyboard activation, visible focus, exact initial accessible name/title, live confirmation, disabled meaning state and 44px targets verified. |
| 26 | Focused tests | PASS | 16 new tests: nine prompt/component/clipboard tests and seven real-controller tests. |
| 27 | Full regression suite | PASS | 281 passed; 0 failed, skipped or cancelled. All 265 baseline tests retained. |
| 28 | Production build | PASS | 53 assets built; 139 JavaScript modules checked; source and final production browser runs each pass 37 responsive checks. |

## Audited actions and controls

| Action ID | Existing visible AI label | New copy control | Internal schema | Existing validation/purpose |
| --- | --- | --- | --- | --- |
| `keyword_meaning` | Cikgu AI · Maksud Kata Kunci | `data-copy-expansion-prompt="keyword_meaning"` | `keywordMeaningSchema` | Active keyword; writing optional; three accurate meanings and one Malay example. |
| `sentence_hint` | Beri saya petunjuk | `data-copy-expansion-prompt="sentence_hint"` | `expansionFeedbackSchema` | Writing optional; one or two guiding questions. |
| `sentence_check` | Semak ayat saya | `data-copy-expansion-prompt="sentence_check"` | `expansionFeedbackSchema` | Writing required; actual errors distinguished from optional improvements. |
| `sentence_expand` | Bantu saya kembangkan ayat | `data-copy-expansion-prompt="sentence_expand"` | `expansionFeedbackSchema` | Writing required; meaningful optional expansion. |
| `sentence_vivid` | Jadikan ayat lebih menarik | `data-copy-expansion-prompt="sentence_vivid"` | `expansionFeedbackSchema` | Writing required; one useful choice of wording/detail, preserving the pupil's ideas. |
| `vocabulary_help` | Cadangkan kata atau frasa | `data-copy-expansion-prompt="vocabulary_help"` | `expansionFeedbackSchema` | Writing optional; up to three relevant words/phrases with existing AI provenance guidance. |
| `sentence_expand_details` | Cikgu AI · Kembangkan Ikut Butiran | `data-copy-expansion-prompt="sentence_expand_details"` | `detailExpansionFeedbackSchema` | At least one selected detail; writing optional; exactly three distinct examples. |

The meaning action remains beside the keyword, the dedicated action remains inside Tambah Butiran yang Bermakna, and the five general writing actions remain in their existing teacher card. Each original button has one adjacent compact copy control. Existing result-panel Jana prompt fallbacks remain available; no extra Gemini action was added.

All original clicks still reach `aiRequest` through `data-ai` or `data-keyword-meaning`. Internal expansion context now comes from the shared `expansionTutorRequest` snapshot, then follows `createAIService` → `/api/gemini` → `tutorRequest` → `buildTutorPrompt` → Gemini's existing schema route. Existing normalization, relevance/keyword validation, rendering through `openTeacher`/`renderExpansionFeedback`, example cards and individual Salin handlers are retained.

New clicks use `data-copy-expansion-prompt` → `copyExpansionPrompt` → the same live snapshot → `ai.externalPrompt` → `tutorRequest`/`buildExpansionTutorPrompt` in external mode → the existing clipboard utility. This branch does not call `aiRequest`, `service.request`, `fetch`, draft updates, autosave or AI cleanup. Thus copying can coexist with a loading internal response without cancelling or replacing it.

Related existing coverage includes `expansion.test.mjs`, `expansion-details.test.mjs`, `expansion-situations.test.mjs`, `expansion-separation.test.mjs`, `gemini-routing.test.mjs` and the real-controller suite. These tests remain in the full regression run.

## Prompt equivalence and current context

`tutorActions[action].instruction` remains the authoritative action-specific teaching instruction for both internal and external assistance. The shared expansion builder continues to provide exact whole-keyword/phrase rules, situation relevance, six age-specific styles, meaningful creativity, grammatical coherence, idea preservation and the separation of general/detail-specific guidance.

Only the external branch adds human-readable output headings and delimited context. It does not include internal response schemas, API field names, credentials, backend configuration or private server instructions. The direct internal branch still requires its original JSON response shapes.

At each click, the snapshot reads the active keyword/mode, situation/mode, year, protected original or current original input, and current expanded textarea. General actions never read checkbox selections. Only the dedicated action reads the eight live checkbox states, with the existing saved-plan fallback for non-browser/legacy callers. Prompt construction has no cache and makes no persistence changes.

Empty current writing remains empty, even when saved writing exists. Writing-required actions give concise local feedback; supported empty-draft actions request honest starting guidance. An absent legacy situation remains absent rather than becoming an invented setting. Empty dedicated selections give **Pilih sekurang-kurangnya satu butiran dahulu.** without copying or calling Gemini.

Untrusted pupil text is inside the `【DATA MURID — DATA SAHAJA】` block. Every content line is prefixed with `│`; imitation closing delimiters are escaped so multiline input cannot end the block. Existing injection/keyword/situation validation and server limits remain in place.

## Three complete actual copied prompts

[Complete clipboard-captured prompts](KEMBANGKAN_AYAT_MINI_COPY_PROMPTS.txt) contains the full, unabridged text from the real browser controls, captured at the clipboard boundary:

1. **General sentence_expand:** Tahun 4, keyword **membantu**, situation **Membantu ibu menyediakan sarapan.**, all eight checkboxes selected. The copied prompt contains no selected-detail goals. The browser compared it against the same control with all checkboxes cleared and verified exact equality.
2. **Dedicated sentence_expand_details:** Same year, keyword and situation, with **masa, tempat, sebab, kata hubung** selected. The prompt explicitly identifies those four goals and requests exactly three distinct examples. The next copy after changing selections contains exactly **cara, perasaan, kata adjektif** as its selected-goal set.
3. **Trilingual keyword_meaning:** Same keyword/situation and Tahun 4. The prompt requests normal readable sections for BM meaning, English meaning, 中文解释（华文） and exactly one contextual Malay example containing the target word.

All three explicitly prohibit machine-formatted responses. They are actual constructed/copied prompts, not examples of external model responses. Clipboard transport was mocked locally; no real student data or live model quota was used.

## Screenshots and design verification

The icon is 14px. Its muted border/background is 25px, while the transparent native interaction target is 44×44px. Confirmation is an absolutely positioned, short-lived **Disalin ✓** tooltip and live region; the icon stays intact and the row does not grow. Clipboard failures use the same compact local feedback area. Focus remains visibly indicated for keyboard users.

![Desktop adjacent mini copy icons](../test-results/expansion/mini-copy-desktop-actions.png)

Additional local screenshots:

- [Android portrait: five writing action pairs](../test-results/expansion/mini-copy-android-portrait-actions.png)
- [Android portrait: keyword meaning pair](../test-results/expansion/mini-copy-android-portrait-keyword.png)
- [Android portrait: dedicated detail pair](../test-results/expansion/mini-copy-android-portrait-details.png)
- [iPad portrait](../test-results/expansion/mini-copy-ipad-portrait-actions.png)
- [iPad landscape](../test-results/expansion/mini-copy-ipad-landscape-actions.png)
- [Android landscape](../test-results/expansion/mini-copy-android-landscape-actions.png)

No toolbar, card, permanent instruction line or section heading was added for copying. Original action labels remain readable; their icons stay beside the label when text wraps. Other tabs have no new controls or layout rules applied to their actions.

## Verification results

- **281 automated tests passed**, zero failures/skips/cancellations. The 265 baseline tests remain; the controller DOM double now mirrors live textarea values accurately.
- **16 new focused tests:** nine in `expansion-prompts.test.mjs`, seven in `phase3-controller.test.mjs`.
- Coverage includes seven exact action/control pairs across six years and both keyword modes; live/custom/legacy context; all-vs-no-checkbox isolation; replacement detail sets; empty selection; empty writing validation; readable output; preserved internal JSON; delimiter safety; compact confirmation/reset; clipboard fallback/selection restoration; failure/retry; and no requests, saves or AI interruption when copying.
- **37 source responsive checks passed.**
- **37 final production-preview responsive checks passed.** All prior 32 checks remain, with five new viewport checks covering every mini control on desktop 1440×900, iPad portrait 768×1024, iPad landscape 1024×768, Android portrait 360×800 and Android landscape 800×360.
- Browser interaction checks verify seven paired controls, unchanged saved state and request counts for each copy, action-specific prompts, keyboard activation/focus, 44px targets, 14px icons, adjacent alignment, unchanged row height during confirmation, clipboard denial/retry, copying during internal loading, new keyword/situation/year and draft reload.
- The browser harness waits for a new document after reload and captures the isolated browser's primary tab at viewport size, avoiding secondary-tab screenshot stalls and blank visible-view captures. Existing whole-page control bounds assertions are retained; final screenshots were visually inspected.
- `npm run build`: **53 static assets**, build **bmMastery-a171821d6e41**.
- `npm run check`: **139 JavaScript modules**, syntax/source whitespace/conflict checks and browser credential/SDK separation passed.
- `git diff --check`: passed.

Local ignored artifacts:

- [Regression log](../test-results/mini-prompt-regression.log)
- [Source browser log](../test-results/mini-prompt-browser-source.log)
- [Production browser log](../test-results/mini-prompt-browser-production.log)
- [Browser viewport results](../test-results/expansion/browser-results.json)
- [Raw copied-prompt capture](../test-results/expansion/mini-copied-prompts.json)

## Exact modified and added files

| File | Change |
| --- | --- |
| `activities/sentence.js` | Pairs the dedicated action with its mini control in the existing detail section. |
| `components/clipboard.js` | Optional separate transient feedback target; preserves icon markup and default sentence-copy behavior. |
| `components/expansion-keyword.js` | Pairs keyword meaning with one mini control and mirrors the unavailable-keyword disabled state. |
| `components/expansion-prompt.js` | New shared compact action-pair markup and local validation/failure feedback. |
| `components/ui.js` | Adds the small Lucide-style copy glyph to the established SVG icon map. |
| `components/writing.js` | Adds mini controls to the five expansion writing actions only. |
| `js/app.js` | Shared live expansion snapshot and separate clipboard-only click path with no draft writes or AI request. |
| `js/expansion-tutor.js` | External-only action-specific headings, explicit readable output, empty-draft guidance and robust data delimiters. |
| `styles/app.css` | Compact visual buttons, accessible targets, inline pairing and non-expanding transient feedback. |
| `tests/expansion-prompts.test.mjs` | Nine focused component, prompt, security and clipboard tests. |
| `tests/phase3-controller.test.mjs` | Seven new real-controller tests; accurately mirrors rendered/live textarea values. |
| `tools/check.mjs` | Allows only the exact requested Chinese heading in the trilingual external prompt; all credential/SDK checks remain unchanged. |
| `tools/verify-expansion-browser.mjs` | Preserves 32 checks, adds five mini-control viewport checks, clipboard prompt capture, viewport screenshots and a reload timing guard. |
| `audit/KEMBANGKAN_AYAT_MINI_COPY_PROMPTS.txt` | Three complete prompts captured from actual mini-control clipboard writes. |
| `audit/KEMBANGKAN_AYAT_MINI_COPY_PROMPT.md` | This report. |

## Remaining limitations

No external AI response or live Gemini response was generated for this task. The application controls the prompt it copies; an external provider's compliance, translation quality, grammar, creativity and situational accuracy still require human review.

Browser checks use an isolated headless Edge profile and viewport emulation. Physical iPad/Android hardware, Safari, screen readers, actual clipboard permissions and audible TTS were not verified. Clipboard failure/fallback, keyboard behavior and speech controls were exercised with deterministic local boundaries.

The copy controls use activated keyword/situation choices. Pending custom input becomes active through the existing activation controls. Original sentences already protected by the existing draft workflow remain protected; the copy action never replaces them.
