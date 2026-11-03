# Karangan Berpandu direct review — 3 November 2026

## Result and original cause

Both `paragraph_review` and `essay_review` were marked `mode: "prompt"` in the
shared action registry. The frontend therefore built a local prompt, while the
backend rejected these actions with `PROMPT_ONLY`. Whole-essay review also used
the older generic internal prompt rather than the richer canonical essay guidance.

Both Karangan Berpandu review actions now call `/api/gemini` immediately and
display validated teacher feedback in the existing Cikgu AI dialog. Execution
mode is scoped by activity: Bina Perenggan retains its local review, and all
other actions retain their previous mode and model configuration.

The server pins these two essay-activity requests to **`gemini-3.5-flash-lite`**.
The exact identifier and structured-output capability are documented in
[Google's model reference](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).
No new Gemini client, endpoint, secret, environment setting or dependency was added.

## Writing context and feedback

`essayReviewRequest` takes a read-only snapshot of all four actual textareas,
including changes without input/autosave events. A paragraph review explicitly
validates its 1–4 index and uses that paragraph plus earlier paragraphs as
context only. Whole-essay review combines every nonempty editor in order,
preserving internal paragraph content and paragraph breaks. Existing request
validation still trims outer whitespace. The read-only combined preview is not
used as the source of truth.

Both modes use the same title, actual topic year (including Semua Tahun), genre,
current stage, live planning notes, and existing `writingGuidance` purpose,
questions, format and checklist. Sample master essays are excluded. Guidance
requires specific, constructive Malaysian Malay feedback, meaningful strengths,
language and idea development checks, preserved voice/facts, proportionate
examples and no invented grades or rubrics. Paragraph scope and holistic essay
scope are explicit.

The main review action syncs current writing and preserves the existing revision
snapshot behavior before requesting feedback. It never applies corrections.
The existing client cache, in-flight request guard, disabled trigger, loading
indicator, request abort, safe error messages and manual retry remain in use.
Closing, navigating or leaving cancels the active review; stale context is not
displayed as a current review.

`buildEssayTutorInstructions` is the canonical educational/data source for both
output modes. Internal prompts append the existing six-field JSON contract
(`ok`, `summary`, `errors`, `suggestions`, `explanation`, `example`). The server
and client validate it before rendering escaped Malay headings and prose.
Students never see raw JSON. External prompts append readable Malay headings,
explanations and suggestions, explicitly prohibiting machine output. They
contain no JSON output request, schema, internal keys or API response template.

## Miniature copy controls

Every one of the four paragraph review instances and the single whole-essay
action has exactly one adjacent copy icon. The controls reuse Kembangkan Ayat's
14px icon, 25px visible outline, 44×44px keyboard/touch target, 2px grid gap,
tooltip and live success/failure status. Main labels remain unchanged. Other
paragraph actions retain their existing Jana Prompt buttons.

Copying builds the external prompt from the same fresh snapshot without calling
the API, saving, creating a revision, replacing writing, opening a review or
clearing feedback. It uses the existing clipboard fallback and focus/selection
restoration. Failure is reported locally and the next click retries with current
context. Native keyboard activation and repeated copying are covered.

## Security and existing controls

The same-origin POST/content-type/body-size/action/year/context validation and
shared per-client, total and concurrent rate limiter remain in force. There is
no separate application user-login layer in this repository; none was invented
or bypassed. Existing Gemini authentication stays server-side. SDK errors and
invalid responses remain sanitized and never generate fabricated feedback or
automatic model fallback. Untrusted title, notes, genre and writing are quoted
as data with escaped delimiters and an explicit instruction not to obey text
inside them. Arbitrary request properties and sample answers are stripped.
Genre lookup now uses own-property checks because review requests introduce
untrusted genre strings at the server boundary.

## Validation

- `npm test`: **288 passed, 0 failed**. Includes real SDK serialization with
  mocked upstream HTTP for both new routes, exact model/schema, current context,
  all paragraph indices/years, complete essay order, independent copying,
  unchanged student text, loading/double-click prevention, quota sharing,
  invalid responses, safe errors, readable prompt contracts and existing module
  regressions. No real provider requests were made.
- `npm run build`: passed; 53 public assets. `npm run check`: passed; syntax,
  whitespace, conflict markers and public-asset credential/SDK scan. This is a
  plain JavaScript project without a separate TypeScript check.
- Local headless Edge functional/layout checks passed with mocked API/clipboard
  responses: correct unsaved paragraph, full essay, feedback rendering, duplicate
  clicks, keyboard copy, clipboard denial/retry, 429 retry and malformed-response
  retry. All five review pairs were measured at every viewport below.

| Viewport | Size | Page overflow | Overlap/truncation | Feedback overflow |
| --- | --- | --- | --- | --- |
| Desktop | 1440×1000 | None | None | None |
| iPad portrait | 768×1024 | None | None | None |
| iPad landscape | 1024×768 | None | None | None |
| Android | 360×800 | None | None | None |
| Narrow Android | 320×720 | None | None | None |

Screenshots and measurements (local ignored test artifacts):

- [Desktop paragraph actions](../test-results/essay-review/desktop-paragraph-actions.png)
- [Desktop essay actions](../test-results/essay-review/desktop-essay-actions.png)
- [iPad portrait paragraph actions](../test-results/essay-review/ipad-portrait-paragraph-actions.png)
- [iPad portrait essay actions](../test-results/essay-review/ipad-portrait-essay-actions.png)
- [Desktop feedback](../test-results/essay-review/desktop-feedback.png)
- [iPad portrait feedback](../test-results/essay-review/ipad-portrait-feedback.png)
- [Machine-readable viewport results](../test-results/essay-review/results.json)

Reproduce with the local dev server running:

```powershell
node tools/verify-essay-review-browser.mjs
```

The restricted execution host initially stalled both the existing expansion
browser script and the new script at renderer attachment. For the successful
isolated test run, `$env:BM_TEST_NO_SANDBOX = '1'` was set for the test process
only. This optional switch affects the temporary local-only headless process;
it does not change installed browser settings or application security. The
temporary test profile is removed at teardown. No package was installed.

These are desktop Chromium viewport checks, not physical iPad/Safari or Android
device testing. OS clipboard hardware and actual Gemini quality remain untested.
No local `GEMINI_API_KEY`, `.env` or `.env.local` was available, so live Gemini
validation was not possible. The model is verified in mocked SDK request bodies,
not in a real Gemini response. Existing in-memory limits remain per function
instance; deployment-wide limits still belong in the existing hosting controls.

## Fully generated external examples

Both examples come directly from `buildExternalTutorPrompt` with realistic Year 3
writing about helping mother prepare breakfast. The selected paragraph contains
a missing full stop. The essay contains all four paragraphs in order. Both
complete prompts include the title, year, guidance and planning notes and were
checked to contain no request for JSON, machine keys or an internal output schema.
The words “Jangan jawab dalam JSON” explicitly prohibit that format.

- [Complete paragraph-review prompt](KARANGAN_DIRECT_REVIEW_PARAGRAPH_PROMPT.txt)
- [Complete whole-essay prompt](KARANGAN_DIRECT_REVIEW_ESSAY_PROMPT.txt)

## Exact changed-file inventory

Application:

- `js/app.js`: shared live review snapshot, direct review/copy handlers and cleanup.
- `js/tutor-actions.js`: activity-scoped modes, bounded context validation,
  canonical teaching instructions and separate presentation contracts.
- `js/ai-teacher.js`: passes activity to the shared execution-mode selector.
- `js/writing-guidance.js`: safe own-property genre lookup.
- `server/gemini.js`: pins only the two essay reviews to the required model.
- `server/ai-handler.js`: passes validated activity to mode/model selection.
- `components/writing.js`: review action groups and compact copy controls.
- `components/expansion-prompt.js`: shared mini style/status reuse with scoped labels.
- `components/ai-teacher.js`: readable review feedback using the existing contract.
- `styles/app.css`: bounded review-pair layout and wrapping.

Tests/tooling:

- `tests/essay-review.test.mjs` (new).
- `tests/fixtures/essay-review.mjs` (new).
- `tools/verify-essay-review-browser.mjs` (new).
- `tests/ai.test.mjs`, `tests/essay-external-prompts.test.mjs`,
  `tests/essay-paragraphs.test.mjs`, `tests/gemini-routing.test.mjs`,
  `tests/phase3-controller.test.mjs`: regression coverage and updated expectations
  for intentionally changed review defaults.

Documentation:

- `README.md`, `VERIFICATION.md`.
- `audit/KARANGAN_DIRECT_REVIEW.md` (this report, new).
- `audit/KARANGAN_DIRECT_REVIEW_PARAGRAPH_PROMPT.txt` (new).
- `audit/KARANGAN_DIRECT_REVIEW_ESSAY_PROMPT.txt` (new).

No commit, push, deployment, production-data change, secret or environment-file
change was performed. Generated curriculum content remains unchanged.
