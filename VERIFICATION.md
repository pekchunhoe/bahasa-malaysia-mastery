# Current master integration verification ? 28 September 2026

**Implementation and automated checks pass; visual browser acceptance is pending.**

- Excel/JSON: 1,080 unique IDs, 720 ejaan, 360 imlak, 720 enrichment,
  360 vocabulary focus, 81 multiword ejaan, zero missing matches/discrepancies.
- `npm test`: 81 passing, zero failures, including full data comparison,
  malformed-input rejection, all year/unit/theme filters, example disclosure,
  local practice, immutable originals and restored drafts/controllers.
- `npm run check` and `npm run build`: pass.
- Browser discovery returned no available browser. Phone/desktop visual QA,
  native disclosure interaction, real browser reload and actual speech remain
  unverified; controller/storage tests do not substitute for these checks.
- No live AI call, commit, push or deployment. No Git metadata in this workspace.

The full current results and changed-file list are in
[MASTER_INTEGRATION.md](audit/MASTER_INTEGRATION.md). The historical record below
is retained for context; its empty upper-year bank and six demo enrichments have
been replaced by the final master integration.

---

﻿# Phase 3 continuation verification — 28 September 2026

**PHASE 3 STATUS: PARTIAL.** Implementation and automated verification pass.
Browser/mobile and real speech validation remain pending, and Git verification
is unavailable because this folder has no Git repository metadata. No overall
Phase 3 completion or visual/audio acceptance is claimed.

## Starting tree and continuation scope

The interrupted implementation was retained and inspected before edits. It already
contained a supplementary schema, six ID-linked DEMO vocabulary enrichments,
independent essay/story records, disclosures, limited local checks, content-ID
state/storage/AI changes, styles and 12 Phase 3 tests. The actual starting suite
passed **62 tests**, not just the previously reported 50. README, ARCHITECTURE
and this verification document still described Phase 2.

This continuation fixed:

- Legacy story preparation assigning the first current starter to an unmatched
  old title; it now preserves the old draft without attaching unrelated content.
- Ambiguous title migration/rendering: adoption requires a unique current title
  match. Existing content IDs and all saved drafts remain separate.
- Future teacher vocabulary being hidden by workbook unit filters and labelled
  as master content; independent entries now remain visible with teacher provenance.
- AI result provenance: API results/cache copies explicitly carry ai_generated,
  and the UI labels all generated feedback as not teacher reviewed.
- Provenance labels treating unknown/draft content as reviewed; all five source
  types now have appropriate labels, with an honest unknown fallback.
- Calendar validation accepting impossible review dates and unnecessarily
  requiring optional guided-writing prompt/type fields.

Added five focused tests to the existing Phase 3 test file, plus three app
controller tests (one has two year subtests). Existing implementation was not
restarted. No source workbook/import redesign, dependency installation, new
Python packages, commit or push occurred.

## Measured final results

| Check | Actual result |
| --- | --- |
| Full `npm test` | PASS: 72 tests; 72 pass, 0 fail, 0 skipped, 0 cancelled |
| Phase 3 coverage | PASS: 22 runner-counted tests/subtests; original 50 regressions remain passing |
| `npm run build` | PASS: 34 static assets; version bmMastery-09c1139ad933 |
| `npm run data:prepare` | PASS: 1,080 reviewed items, zero excluded |
| `npm run check` | PASS: 47 JavaScript modules; syntax, whitespace/conflict and browser secret/SDK isolation checks |
| Production HTTP | PASS: all 34 built assets plus `/` return 200; bodies match disk; JS MIME types checked |
| Private production routes | PASS: seven routes return 403 (listed below) |
| Version headers | PASS: /version.json is no-store |
| Production module graph | PASS: 66 relative static import edges resolve across 30 JavaScript modules |
| Private build exclusions | PASS: no workbook, audit, adapters or server directory in dist |
| Workbook/import integrity | PASS: workbook, reader, importer, adapter, generated master and private audit match start-of-continuation hashes |
| `git diff --check` | UNAVAILABLE: attempted; Git reports “Not a git repository” |
| `git status --short`, `git diff`, `git rev-parse` | UNAVAILABLE: attempted; no Git metadata |
| Browser/mobile visual validation | PENDING — browser unavailable |
| Real speech/audio validation | PENDING — browser/audio environment unavailable |
| Live Gemini exercised | NO |
| Commit / push | Neither performed |

The full suite ran before the production build, followed by source/data checks
and production HTTP/module validation. Static checks were repeated after the
final documentation edits. No ESLint/TypeScript configuration or separate lint
or typecheck script exists; the existing check command is the static validator.
Environment: Windows, Node 24.18.0; npm/Python use the existing installed tools.

The read-only importer was invoked by existing pretest/build hooks and explicitly
for validation. Its generated files remained byte-identical to the starting tree.
Workbook SHA-256 before and after:
`6e650cb0c55710af5f25d3766f972164fb79963b11676d8c4aae691a30abdb2e`.

Production checks used a temporary preview server on 127.0.0.1:4188, then stopped
that server. Blocked routes: /data/BM_MASTER_EJAAN_IMLAK_2026.xlsx,
/audit/workbook.json, /data/adapters/excel.js, /server/gemini.js, /.env,
/package.json, /node_modules/@google/genai/package.json. No API request was made
by this production smoke check. The existing development HTTP regression tests
exercise only missing-key API behavior; AI success tests use mocks.

## Source, schemas and demonstration records

The source bank remains 240 ejaan records per year in Tahun 1–3 and 120 imlak
records per year in Tahun 4–6: 1,080 stable unique IDs, 81 intact multiword ejaan
entries, 90 repeated-text occurrences beyond first occurrences, and 24 units per
year. All actual workbook rows satisfy the existing approved/active/text filter.
No official lower-year theme/unit titles were invented.

Phase 3 adds `data/schema/enrichment.js` and `data/teacher/content.js` (already
present at continuation start). Four separate validated collections are supported:
enrichment by source_item_id; vocabularyBank by id/year/word; guidedWriting by
id/year/title; storyStarters by id/year/title/starter_text. Optional vocabulary,
writing/model and story metadata are documented in ARCHITECTURE.md. Blank
optional fields remain absent; unknown fields and source-overriding fields fail.

| DEMO source item ID | Source text | Demonstration purpose |
| --- | --- | --- |
| Y1-E-U01-I01 | ayam | Simple definition, noun category, example and related words |
| Y1-E-U10-I09 | bermain | Meaning, verb category and example |
| Y1-E-U06-I09 | bersih | Definition, adjective category, example and opposite |
| Y1-E-U12-I09 | jalan raya | Younger-year compound entry with simple definition/example |
| Y3-E-U09-I02 | jalan raya | Different example for the other source ID; uncertain category omitted |
| Y2-E-U03-I07 | ringan tulang | Intact phrase, meaning and example |

All **six** use source_type=demo/status=demo. They demonstrate the architecture
and UI; they have no teacher review claim and are not promoted to reviewed
material. No further demo vocabulary was added in this continuation. The two
existing guided titles remain “Petang Bersama Rakan” (demo-petang) and “Taman yang
Bersih” (demo-taman); the independent story remains “Sebuah buku misteri” (demo-buku).
All three are still DEMO, separate from the workbook.

`js/enrichment-service.js` joins by stable source_item_id only and nests the
supplement under enrichment. It never spreads demo fields over source text.
Distinct IDs with equal text can have different enrichment. Missing enrichment
returns null/empty lookup and renders no invented values. Optional support uses
closed native details/summary disclosures; hints never populate pupil answers.

Provenance distinguishes reviewed_source (workbook boundary/source cards),
teacher_authored (draft/reviewed with author/reviewer/date requirements), demo,
pupil (drafts) and ai_generated (AI results/cache). Reviewed source items retain
their original generated schema. AI output cannot claim reviewed provenance or
enter the authored schema. Unknown/draft provenance is not labelled reviewed.

Tahun 4–6 vocabularyBank remains empty in production. Tests inject a separate
normalized reviewed teacher fixture into the curriculum composition path and
verify its cards/provenance without changing imlak. Imlak is never tokenized into
permanent vocabulary or concatenated into essays, paragraphs or story starters.

## Draft compatibility and focused coverage

The same bmMastery:state:v1 key is used; missing contentId/selectedEssayContent
fields default safely. Source item IDs still key practice/progress. Essays and
stories have separate stable content IDs, including same-title content. Legacy
title matching is only a compatibility fallback: an exact, unique current title
can adopt an ID without replacing the saved draft. Ambiguous/missing titles and
removed IDs stay accessible from Draf Saya. Original/revised expansion text,
plans, stages, continuations, progress and unrelated storage keys are preserved.
Failed saves preserve in-memory writing and the existing stored record.

Coverage in tests/phase3.test.mjs and tests/phase3-controller.test.mjs verifies:

1. 1,080 source IDs, 81 intact phrases, duplicate text and no master mutation.
2. Stable-ID lookup, distinct jalan raya enrichments, absent enrichment rendering,
   source-override rejection, cloning and demo/reviewed provenance separation.
3. Teacher review publication gates, impossible dates, all optional writing
   metadata behavior, retained legitimate titles and future bank integration.
4. Disclosure/escaping, no teacher notes in pupil markup, no hints/examples
   becoming Bina Ayat answers and no imlak assembly into pupil writing.
5. Essay/story same-title identity, reload/year/unit/resume, additive migration,
   ambiguous/removed content, save failure and separate expansion originals/revisions.
6. Surface-only capitalization/final punctuation/spacing checks, quoted endings,
   empty input and explicit grammar/meaning limitations, including a grammatically
   wrong sentence that surface checks deliberately cannot judge.
7. Real app event handlers for ejaan and imlak checking, progress by item_id,
   speech replay/error fallback, deliberate reveal/reset and preservation of old
   attempts, with a fetch guard proving no network requests.
8. Real app event handlers for unavailable legacy-story resume and local surface
   feedback, using a DOM boundary double rather than a real browser.
9. Pupil provenance through hydration, teacher metadata through publication,
   ai_generated provenance through mocked success/cache, and essay AI context
   isolation from plans, models, hints and source references.

The original tests additionally cover all AI routes/server validation, isolated
local prompt generation, cache cancellation/expiry, deployment, speech voice
selection and queueing, escaping, and all six-year activity renderers. The final
72 count includes two nested year subtests and their parent test (70 top-level
tests); Phase 3 contributes 20 top-level tests plus those two subtests.

## Manual validation and limitations

The browser skill was read and its runtime initialized. Browser selection
returned “No browser is available”; documented discovery returned []. No browser
screenshots, mobile viewport checks, actual focus/navigation/reload checks or
real speech playback were performed. DOM doubles, render tests and speech mocks
do not constitute visual/browser/audio acceptance.

Browser/mobile visual validation: PENDING — browser unavailable.
Real speech/audio validation: PENDING — browser/audio environment unavailable.
Live Gemini exercised: NO. No live request is needed for this phase's local checks.

When a browser is available, inspect desktop and 390/320 px layouts, keyboard
access to disclosures/selectors, all activities, legacy/current draft reload,
original/revision separation, practice reveal/replay/fallback and actual ms-MY
voice behavior. Check optional hints do not change pupil writing and essay AI
prompt generation contains only the allowed context; do not require live Gemini.

Local checks only examine the initial letter, final punctuation and spacing;
they do not assess full grammar, meaning or every sentence. Progress is local
learning state, not secure exam scoring. Workbook data are public browser assets.
Teacher notes/draft content in the authoring module are not confidential storage,
even when omitted from pupil views. Legacy titles that become ambiguous cannot
be assigned a historical content ID automatically; their writing stays saved.
Git history and the original pre-interruption diff cannot be reconstructed from
this folder. The inventory below distinguishes observed inherited work from
exact continuation changes rather than claiming an unavailable Git comparison.

Teachers still need to supply/review vocabulary meanings/examples/categories,
independent Tahun 4–6 vocabulary, further guided topics/prompts/planning aids/model
content, story starters and optional metadata, richer paragraph rubrics and any
official curriculum mapping. The six demo enrichments and three writing samples
remain demonstration material until genuinely authored/reviewed through the
separate process; this continuation does not certify them as teacher content.

## Exact final file inventory and its baseline

No Git-based whole-Phase-3 inventory can be certified. The following inherited
Phase 3 public changes were directly observed by comparing the starting source
files with the pre-existing Phase 2 dist copies; the inherited test file was
inspected separately. This evidence does not substitute for Git history:

- activities/vocabulary.js
- activities/writing.js
- components/content.js
- components/enrichment.js (absent from the old build)
- components/writing.js
- data/schema/enrichment.js (absent from the old build)
- data/teacher/content.js (absent from the old build)
- js/app.js
- js/curriculum-service.js
- js/enrichment-service.js (absent from the old build)
- js/local-writing-check.js (absent from the old build)
- js/state.js
- js/storage.js
- js/tutor-actions.js
- styles/app.css
- tests/phase3.test.mjs

The exact content-hash inventory **relative to this continuation's starting
snapshot** follows. Rebuilt files with identical bytes are not listed as changed.
No files were deleted.

Modified source/test/documentation files:

- activities/vocabulary.js
- activities/writing.js
- ARCHITECTURE.md
- components/ai-teacher.js
- components/enrichment.js
- data/schema/enrichment.js
- js/ai-teacher.js
- js/app.js
- js/curriculum-service.js
- js/state.js
- README.md
- tests/phase3.test.mjs
- VERIFICATION.md

Added source/test files:

- tests/phase3-controller.test.mjs

Modified build files:

- dist/activities/vocabulary.js
- dist/activities/writing.js
- dist/components/ai-teacher.js
- dist/components/content.js
- dist/components/writing.js
- dist/js/ai-teacher.js
- dist/js/app.js
- dist/js/curriculum-service.js
- dist/js/deployment-version.js
- dist/js/state.js
- dist/js/storage.js
- dist/js/tutor-actions.js
- dist/styles/app.css
- dist/version.json

Added build files:

- dist/components/enrichment.js
- dist/data/schema/enrichment.js
- dist/data/teacher/content.js
- dist/js/enrichment-service.js
- dist/js/local-writing-check.js

Unchanged by this continuation: master workbook, generated master, audit, importer,
reader, adapter, package.json/package-lock.json, source practice/transcription and
speech modules, original five regression test files, and unrelated projects.
All builds and preparation used existing commands. Nothing was committed or pushed.
