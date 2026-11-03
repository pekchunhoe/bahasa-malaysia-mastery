# Ingat Karangan implementation — 4 November 2026

Implemented locally for review. No commit, push, deployment, production-data
change, dependency, database or additional AI provider was introduced.

## Audit and source selection

- The application is plain HTML/CSS and JavaScript ES modules. `js/config.js`
  supplies navigation, `activities/registry.js` supplies renderers, and
  `js/app.js` coordinates events and the responsive shell.
- Karangan Berpandu saves pupil writing in an active essay draft with four
  editors, a stable draft/content identity and a combined `text` field. Master
  reference essays are separate. There is no explicit completed-essay flag.
- The new feature therefore uses nonempty writing from the currently selected
  pupil essay. Empty editors are omitted; blank-line paragraphs inside an
  editor are separated. The resulting paragraph count is dynamic, including
  short one-paragraph essays and essays with more than four paragraphs. It
  does not infer completion from a prescribed length or the guided stage.
- Source lookup checks year, active draft, selected content ID and selected
  title. It never falls back to another essay or a reference/model answer.
  An empty new draft shows “Siapkan karangan kamu di tab Karangan Berpandu
  dahulu.” with a return link.
- Existing persistence is the versioned `bmMastery:state:v1` localStorage key.
  The same store, synchronous autosave and save-failure status are reused.
- Existing desktop/sidebar, tablet and phone navigation and styles are reused;
  no existing writing page was redesigned.

## Implemented pupil flow

**🧠 Ingat Karangan** is immediately after Karangan Berpandu. Only one paragraph
and one activity are shown at a time, with previous/next navigation and an
actual paragraph count.

1. **👀 1. Lihat & Ingat:** a short heading and every generated important point,
   in sequence. Optional cues support understanding without clipping the list.
2. **🧠 2. Tutup & Ingat:** oral/mental recall with points hidden, then a single
   reveal/hide control for the identical complete list. No typing is required.
3. **✍️ 3. Tulis Semula:** an independent multiline editor, with the source
   paragraph and notes hidden. The mandatory **✨ Cikgu AI — Semak Tulisan**
   button sits immediately below it.

**✨ Cikgu AI — Jana Isi Penting** is deliberate. Notes are saved and reused on
navigation and reload. Regeneration invalidates only that request's client
cache entry, preserving other tutor caches and all pupil writing.

There is no fixed point target or point-count cap in the schema, prompts,
renderer or remembered-count calculation. The prompt requires all genuine
essential ideas and events, forbids invented filler or artificial splitting/
merging, and preserves paragraph boundaries, characters, meaning and sequence.
Output validation requires exactly one indexed analysis per source paragraph.

Checks send the relevant original paragraph, the complete ordered point list
and the exact reconstructed writing. They assess:

- **Isi penting:** one indexed result for every point, distinguished as fully
  recalled, partially recalled or absent/substantially wrong. The application
  counts only `penuh` results; the denominator is the actual point-list length.
  AI-provided totals cannot override this calculation.
- **Urutan peristiwa / idea:** chronology for narratives and logical organisation
  for factual writing.
- **Bahasa Melayu:** understandable standard Malaysian Malay, including grammar,
  structure, vocabulary and clarity. Equivalent meaning and correct alternative
  constructions are explicitly accepted.

Feedback gives concise, specific encouragement without rewriting the paragraph.
The checked writing and note snapshot are saved alongside it. Editing writing
or regenerating different notes visibly marks old feedback. Pending checks
retain current writing, focus and selection; a late result is saved only to
its captured source version and paragraph. Errors permit deliberate retry.

## Final essay and copying

The discoverable, collapsible **📋 Karangan Akhir Saya** section updates whenever
pupil writing changes. It preserves the title, paragraph order, paragraph
breaks, punctuation and exact wording. Unwritten paragraph numbers are shown
as interface guidance; missing paragraphs are never filled from the original
essay or from AI suggestions. Passing AI checks is not required.

**📋 Salin Karangan Akhir** copies only the title and available reconstructed
paragraphs. Incomplete essays remain copyable with a clear notice. Empty
writing disables copying. The existing browser Clipboard API and legacy copy
fallback are reused. “✅ Berjaya disalin!” appears only after a successful API
write or successful fallback; failure offers manual selection/copy guidance.

## Persistence and security

Each essay draft has an additive `memory.versions` history containing its exact
source, full notes, reconstructed writing, latest feedback and checked snapshots,
paragraph/activity selection and final-section disclosure state. Source edits
select a separate fresh workspace, with earlier practice accessible through
**Versi latihan**. Returning to the same source restores its own practice.
Archived practice is clearly labelled. Even if the current source is cleared,
saved source-version practice remains available. No historical writing is
silently deleted or remapped onto a revised essay. Malformed notes/feedback are
discarded independently of otherwise valid writing during hydration.

Both new allowlisted actions use the existing `/api/gemini` handler, server-only
SDK and configured `GEMINI_FAST_MODEL`. Existing essay review model routing is
unchanged. Memory tasks use structured schemas with larger output budgets for
dynamic lists (8,192 generation / 4,096 review tokens).

For memory actions, pupil/source data is sent in the interaction input,
separately from the system instructions. The latter explicitly treat all
essay, title and note values as untrusted data and forbid following embedded
instructions. Inputs and responses are validated on both server and client;
rendered pupil/AI strings are HTML-escaped. These controls reduce injection
risk; they cannot prove an AI's semantic correctness.

Existing same-origin/content-type/body-size checks, no-store responses, request
deadline, zero automatic retries, redacted errors and bounded rate limiter are
retained. Defaults remain four requests per client per minute, 40 total per
instance per minute and four concurrent requests. There was no existing pupil
sign-in/authentication layer to reuse; none was added. The existing limiter is
per function instance, with deployment-wide protection outside this change.
No private essay text or credentials are added to logs or public assets.

## Validation

| Verification | Result |
| --- | --- |
| `npm test` | PASS — 302 tests, zero failures |
| Focused memory coverage | PASS — dynamic 1/2/3/4/5/6-point lists; varying paragraph counts; exact source identity; hide/reveal; independent writing; stale feedback; source histories; quota/errors; malformed responses; cache isolation; storage failure; delayed results |
| Existing server/SDK routing tests | PASS — both new actions traverse the existing real SDK with intercepted/mock upstream responses, configured model and matching schemas; no live requests |
| Existing guided-essay browser verifier | PASS — five viewports; paragraph and full-essay reviews, copying and error handling preserved |
| New memory browser verifier, source and production build | PASS — full workflow and all five viewport sizes on both servers |
| `npm run build` | PASS — 57 static assets; source workbooks/audits/server credentials excluded |
| `npm run check` | PASS — 153 modules; syntax, whitespace/conflicts, browser secret/SDK isolation and UI language checks |
| `git diff --check` | PASS |

The new isolated Edge verifier exercises the actual application with authored
fixture essays and mocked AI/clipboard responses. It verifies tab placement,
six paragraphs in four source editors, all six points, oral recall, independent
writing, all check criteria/counts, old-feedback warnings, typing during a
pending check, quota/invalid-result recovery, partial/full copy, clipboard
denial/fallback, original-essay preservation, tab switching, reload, source
editing and isolation between selected essay titles.

| Desktop Edge viewport | Result |
| --- | --- |
| Desktop 1440 × 1000 | PASS — no horizontal overflow or clipped controls |
| Tablet landscape 1024 × 768 | PASS — no horizontal overflow or clipped controls |
| Tablet portrait 768 × 1024 | PASS — no horizontal overflow or clipped controls |
| Android-sized 360 × 800 | PASS — no horizontal overflow or clipped controls |
| Narrow mobile 320 × 720 | PASS — no horizontal overflow or clipped controls |

All memory-workspace button targets measured at least 44 px high. Screenshots
were visually inspected for desktop, tablet and mobile. These are desktop Edge
viewport checks, not physical iPad/Safari or Android device verification.
The isolated test process uses the existing optional `BM_TEST_NO_SANDBOX=1`
compatibility switch because normal sandboxed renderer attachment stalled on
this host. Only temporary test profiles are used, then removed.

Local review artifacts (ignored by Git):

- [Desktop: every point](../test-results/essay-memory/desktop-all-six-points.png)
- [Desktop: AI feedback](../test-results/essay-memory/desktop-feedback.png)
- [Mobile: independent writing](../test-results/essay-memory/android-write.png)
- [Tablet: final essay](../test-results/essay-memory/ipad-portrait-final.png)
- [Source browser results](../test-results/essay-memory/results.json)
- [Production browser results](../test-results/essay-memory-production/results.json)
- [Automated test log](../test-results/memory-unit-tests.log)

Reproduce with `npm run dev`, then in another PowerShell session:

```powershell
$env:BM_TEST_NO_SANDBOX='1'
node tools/verify-memory-browser.mjs
```

For the production build, serve `dist` on another port and pass that local URL
as the first argument. An optional second argument selects the artifact directory.

## Files

Created:

- `activities/essay-memory.js`: activities, complete notes, feedback and final UI.
- `js/essay-memory.js`: source/version identity, validation, hydration and assembly.
- `js/memory-controller.js`: deliberate AI actions, writing, navigation and copying.
- `js/memory-tutor.js`: allowlisted input, schemas and dedicated teaching prompts.
- `tests/essay-memory.test.mjs` and `tests/fixtures/essay-memory.mjs`: focused tests
  and clearly labelled authored fixtures.
- `tools/verify-memory-browser.mjs`: repeatable isolated browser checks/screenshots.
- `audit/INGAT_KARANGAN.md`: this report.

Modified:

- `js/config.js`, `activities/registry.js`, `js/app.js`: adjacent tab and controller
  integration, without creating an unrelated memory draft or editing essay UI.
- `js/storage.js`: defensive additive memory hydration under the existing key.
- `js/tutor-actions.js`, `server/gemini.js`: new allowlisted tasks and schemas on
  the existing Gemini route and model configuration.
- `js/ai-teacher.js`: optional per-request cache invalidation; existing all-cache
  invalidation callers retain their behaviour.
- `styles/app.css`: scoped responsive memory styles using the existing palette.
- `tests/ai.test.mjs`, `tests/gemini-routing.test.mjs`,
  `tests/essay-external-prompts.test.mjs`, `tests/phase2.test.mjs`,
  `tests/speech-render.test.mjs`: extend generic inventories/fixtures to cover
  the new actions and read-only activity; preserve existing assertions.
- `README.md`: feature and report discovery.

## Remaining verification limits

Live Gemini generation and semantic quality, physical iPad/Safari/Android use,
and real OS clipboard permissions were not tested. Authored fixture responses
verify contracts and behaviour, not live factual faithfulness or Malay quality.
These should be sampled before release with the existing server configuration.

All practice is local to this browser/device. Storage denial/full storage uses
the existing visible save warning and retains current-session writing; copying
the final essay remains available. Source histories consume localStorage space
and are not silently pruned. Existing 16,000-character source, 32 KB request,
24,000-character AI output and deadline limits still apply: an oversized or
incomplete result fails visibly without truncating notes or losing writing.
