# Ingat Karangan — memory keywords, one-word emphasis and copying

Implemented locally on 4 November 2026. No commit, push or deployment was made.
No production student records, credentials or database schema were changed.

## Existing implementation audit

The existing activity uses `js/memory-controller.js` for explicit generation,
checking, paragraph navigation, visibility, autosave and final copying.
`js/essay-memory.js` keeps practice histories under the pupil's existing essay
draft, isolated by exact source title and paragraph content. Notes were stored
as `{ text, cue }` points with an optional cue of up to 40 characters.
`activities/essay-memory.js` already provides Lihat & Ingat, Tutup & Ingat,
Tulis Semula, AI feedback and Karangan Akhir Saya.

Memory generation and checking already share the configured Gemini endpoint,
SDK integration, model selection, request cache, rate limits, origin validation,
size limits and protected server credentials. Client and server both validate
feedback. The existing clipboard helper supports plain text and a focus- and
selection-preserving local fallback. These paths were extended in place.

## Modified files

| File | Change |
| --- | --- |
| `js/essay-memory.js` | Structured point normalization, Unicode lexical validation, one validated highlight range, legacy compatibility. |
| `js/memory-tutor.js` | Structured Gemini schema and prompts; allowlisted complete points for meaning-based review. |
| `components/memory-notes.js` | Shared escaped sentence/keyword rendering and complete HTML/plain-text revision-note builders. New file. |
| `activities/essay-memory.js` | Reuses the point renderer in both learning/reveal views and adds Salin Isi Penting beside final-essay copy. |
| `components/clipboard.js` | Optional dual-MIME ClipboardItem writing with the existing text fallback. |
| `js/memory-controller.js` | Local notes-copy action, duplicate guard and success/failure announcements. |
| `styles/app.css` | Compact bordered memory boxes, aligned sentence columns and narrow-screen stacking. |
| `tests/fixtures/essay-memory.mjs` | Separate legacy and structured authored fixtures; complete sentences and source-supported supporting cues. |
| `tests/memory-keywords.test.mjs` | 18 focused generation, highlighting, rendering, persistence, clipboard and controller regression tests. New file. |
| `tools/verify-memory-browser.mjs` | Dual-MIME/fallback checks, responsive geometry, long-cue stress checks and native rich-editor paste verification. |
| This report | Implementation decisions, validation evidence, screenshots and limits. |

## Gemini generation and multiple cues

Each point now requests `primaryKeyword`, `additionalKeywords`,
`importantSentence` and `boldWord` in the existing whole-essay generation call.
The normalizer adds `highlight: { start, end }` after validating the word.
The model does not need to calculate character indices.

The prompt asks for a meaningful primary idea and zero or more short supporting
cues drawn from the source: people, places, time, objects and actions. It forbids
invented filler, unnecessary repetition and omissions or artificial splitting
to meet a count. Neither point lists nor supporting-cue arrays have a fixed
minimum/maximum count. Existing overall request, response and individual text
size safeguards remain. Repeated cue strings are deduplicated without changing
their first-occurrence order; long cues wrap.

No extra Gemini calls are made per point. Rendering, hiding, revealing,
navigating, copying and restoring saved notes are local operations.

Semak Tulisan still compares the complete important-point list and original
paragraph with the pupil's independently reconstructed paragraph. The prompt
explicitly accepts equivalent vocabulary and sentence structure; the highlighted
word is a memory aid rather than an exact-word marking requirement. AI checking
does not replace pupil writing.

## Exactly one bold word

`memoryHighlight` tokenizes with Unicode letter, mark and number properties,
including Malay lexical words joined with ordinary or supported Unicode
hyphens. A selected word must be one complete lexical token, must occur literally
in the sentence, and cannot be a common Malay function word or pronoun.
Single-token sentences cannot have their whole sentence highlighted.

Offsets use JavaScript UTF-16 indices, including correct positions after emoji.
Without a supplied range, the first valid exact occurrence is chosen. A supplied
range must identify that exact complete token; repeated words are never all
replaced. Rendering escapes and slices the sentence into before/word/after
segments and inserts exactly one application-owned `<strong>` element.

New generation is strict: missing keyword fields or an invalid selection reject
the response through the existing retryable AI error path. Existing notes and
student writing remain available. Legacy restoration is forgiving: old
`{ text, cue }` records remain readable, and invalid or unavailable highlight
metadata produces ordinary escaped sentence text. Explicit regeneration remains
available. Keyword formatting alone never triggers regeneration.

## Visual layout and memory activities

Each point has its own bordered, softly shaded keyword box on the left and its
corresponding sentence on the right. The primary cue is prominent; supporting
cues use smaller normal text beneath it. Sentence columns have normal weight
except for the single selected word. The existing palette and controls are kept.

Desktop/tablet rows use 30:70 proportional columns. At 480px and below, each box
sits immediately above its own sentence. Long phrases wrap without horizontal
scrolling. The interface still shows one paragraph at a time.

Tutup & Ingat removes both columns when hidden and reveals the same shared
renderer. Tulis Semula continues to show neither the source paragraph nor memory
cues. Existing independent typing, caret preservation during asynchronous checks,
feedback, navigation and final-essay assembly remain covered by regression tests.

## Clipboard implementation

Salin Karangan Akhir retains its original behavior: it copies the pupil's title
and available reconstructed paragraphs in their exact wording and order.

Salin Isi Penting is adjacent and available whenever saved notes exist, even
before reconstruction is complete. It copies the selected source version's title,
all numbered paragraph headings and every point, including points beyond the
third. It excludes assessment comments and reconstructed pupil writing.

`memoryNotesClipboard` builds one table per paragraph and one row per point.
The left cell has an inline border, subtle background, padding, 30% width and a
bold primary cue, with supporting cues separated underneath. The right cell has
70% width, normal text weight and the same single-word renderer as the UI. Inline
alignment, vertical alignment and spacing make the HTML self-contained.
Every title, heading, cue, sentence segment and attribute value is escaped.
AI-generated HTML is never inserted as executable markup.

`copyRichText` writes `text/html` and `text/plain` together in one ClipboardItem.
Unsupported rich writing or a rejected rich write falls back to the shared
plain-text helper, including its local execCommand fallback and focus handling.
Plain text uses labelled `[KATA KUNCI]` groups, pipe-separated cues and optional
single-word Markdown emphasis, without ASCII tables.

Announcements occur only after successful completion:

- Rich: `✅ Isi penting berjaya disalin!`
- Plain: `✅ Isi penting disalin dalam format teks.` followed by the explanation
  that bordered boxes cannot be retained in plain text.
- Failure: a retry/clipboard-access message without a success indicator.

Each copy button has its own polite status region, a pending-write duplicate
guard and no autosave or AI side effects.

## Saved-data compatibility

Storage keys, essay identities and source histories are unchanged. Existing
sentences/cues, student writing and checking results survive hydration. Structured
notes additionally retain supporting keywords, the selected word and validated
range. Older feedback note keys remain usable. Invalid highlight metadata does
not erase the sentence. Regeneration never clears writing or existing feedback;
feedback for older notes remains labelled as an earlier check.

## Validation results

| Check | Result |
| --- | --- |
| `npm test` | PASS: 320 tests, 0 failures. |
| Focused memory tests | PASS: 32 tests across existing and new memory suites. |
| `npm run build` | PASS: 58 static assets; build `bmMastery-78b6222dc74a`. |
| `npm run check` | PASS: syntax, whitespace/conflicts, protected browser assets and existing language checks. |
| `git diff --check` | PASS. |
| Source and production browser verifier | PASS in isolated Edge 156.0.4314.58 profiles. |
| Native clipboard paste | PASS into Edge contenteditable on both source and production previews: six paragraph tables, 21 rows, visible keyword borders/backgrounds and one bold word per sentence. |
| Rich/text denial and fallback | PASS: rich success, rich-to-text fallback, total denial, local text fallback and retry; no premature success. |
| Existing final-essay copy | PASS: partial and complete pupil text, failures and fallback. |
| Memory regression | PASS: hide/reveal, writing, checking, delayed responses, reload/autosave, changed source versions and essay identity isolation. |
| Security regression | PASS: escaped hostile markup; shared input validation, origin/body limits, credentials isolation, rate/concurrency limits and redacted errors remain covered. |

Responsive verification used these viewport sizes on both source and production:

| Viewport | Layout and result |
| --- | --- |
| Desktop, 1440 × 1000 | Two columns; no overflow or clipping. |
| iPad landscape, 1024 × 768 | Two columns; no overflow or clipping. |
| iPad portrait, 768 × 1024 | Two columns; no overflow or clipping. |
| Android size, 360 × 800 | Each box directly above its sentence; no overflow or clipping. |
| Narrow mobile, 320 × 720 | Each box directly above its sentence; no overflow or clipping. |

Each viewport also checks all workspace buttons for at least 44px height,
normal-weight sentence text, one bold lexical word, visible keyword borders and
backgrounds, three supporting cues and deliberately long wrapping phrases.

The initial sandboxed browser renderer stalled at startup. The same isolated
local harness passed outside that process sandbox. Temporary test profiles were
removed. Fixture AI responses were used; no live Gemini quota was consumed.

## Evidence and screenshots

Generated local artifacts are in ignored `test-results/` directories:

- [Desktop notes](../test-results/essay-memory/desktop-learn.png)
- [iPad portrait notes](../test-results/essay-memory/ipad-portrait-learn.png)
- [Android notes](../test-results/essay-memory/android-learn.png)
- [Final essay and adjacent copy controls](../test-results/essay-memory/desktop-final.png)
- [Actual native rich-text paste](../test-results/essay-memory/desktop-native-rich-paste.png)
- [Source browser results](../test-results/essay-memory/results.json)
- [Production browser results](../test-results/essay-memory-production/results.json)
- [Copied HTML](../test-results/essay-memory/clipboard-notes.html)
- [Native pasted HTML](../test-results/essay-memory/native-pasted-notes.html)
- [Plain-text notes](../test-results/essay-memory/clipboard-notes.txt)
- [Complete automated test log](../test-results/memory-keyword-unit-tests.log)

## Compatibility limits

The successful native paste was verified in an Edge rich-text editing surface,
including actual Clipboard API writing and Ctrl+V insertion. Microsoft Word and
Google Docs were not tested. Their HTML sanitization, clipboard permissions and
paste settings can alter borders, spacing or fonts. Identical appearance in all
editors is not promised; text-only paste cannot retain bordered boxes.

iPad/Android checks emulate viewport dimensions in desktop Edge; physical
devices, Safari and screen readers were not tested. Semantic cue quality and
coverage were checked against authored fixtures and prompt requirements; live
Gemini output quality was not evaluated or guaranteed by these deterministic
tests. The model remains responsible for selecting source-supported ideas.

All work remains available for local review. No dependency or deployment
configuration changes were required.
