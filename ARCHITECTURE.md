# Current essay integration — 28 September 2026

The current importer entry point is `tools/prepare-data.mjs`: it runs the existing
ejaan/imlak import and `tools/import-essays.mjs`. The shared OOXML reader accepts
the actual worksheet name; `data/adapters/essays.js` maps MASTER_KARANGAN's 13
columns to stable-ID writing records. Source status and exact model text remain
unchanged. Incomplete records are reported and excluded; invalid identities or
word counts fail import. Only generated data reaches the browser.

`js/essay-service.js` loads and validates the optional essay module with a caught
error boundary. Curriculum packs expose master essay/paragraph topics and only
narrative topics for stories. Legacy demo records remain available by their IDs.
`components/essay-catalog.js` renders separate category/type/search filters and
closed reference disclosures. `activities/master-writing.js` adds year/genre
guidance through `js/writing-guidance.js`, using existing editors and controls.

The existing v1 storage key is unchanged. `writingFilters` are scoped by year and
activity. Optional `revisions` preserve snapshots separately from current text;
legacy drafts hydrate without losing IDs, plans, originals or progress. Source
essays never enter draft creation or update functions. Essay-stage revision also
captures the current text before editing. Exports include saved versions.

See [the essay integration report](audit/KARANGAN_INTEGRATION.md). The earlier
sections below describe the previous integrations; the two demo essay titles
are now compatibility content rather than the default writing catalog.

---

# Previous master integration — 28 September 2026

This section supersedes the historical Phase 3 description below where content
sources, the upper-year vocabulary bank and disclosure behaviour differ.

- `tools/read-workbook.py` reads MASTER_CONTENT, ENRICHMENT and VOCAB_FOCUS
  offline. `tools/validate-master.mjs` matches all records and relevant fields
  against the final app-ready JSON by ID, before any generated output is written.
- `tools/import-workbook.mjs` retains the existing adapter and generates a single
  runtime master from JSON, including `status_semakan` and an ID-indexed enrichment
  map. Excel provenance and comparison results stay in `audit/workbook.json`.
- `js/enrichment-service.js` attaches approved master support; independent
  teacher publication rules remain separate. Six obsolete demo enrichments no
  longer override final master records. Writing demos retain their stable IDs.
- `js/curriculum-service.js` exposes ejaan vocabulary for Years 1?3 and supplied
  VOCAB_FOCUS vocabulary for Years 4?6, with original year/unit/theme metadata.
  `pack.items` remains the exact verified practice text; focus words never replace it.
- `components/enrichment.js` labels AI origin and bulk user approval explicitly.
  Bank cards show meanings/categories/examples. Creative activities show hints
  and place examples in closed native disclosures, opened only on pupil request.
- `components/content.js` uses focus words as creative prompts while keeping
  practice selectors answer-free. `activities/practice.js` exposes spelling help
  optionally and imlak vocabulary only after a nonempty checked attempt. Editing
  or resetting the attempt removes that support again.
- `components/vocabulary-support.js` supplies bounded, year/unit/theme-filtered
  suggestions to paragraph, essay and story views without writing to drafts.
- The storage schema/key, autosave, original/revision separation and content-ID
  migration are unchanged. No new AI route or request is involved.
- The production build contains the generated runtime module; raw Excel, audit,
  and duplicate raw JSON source are excluded.

See [the integration report](audit/MASTER_INTEGRATION.md) for data verification,
test coverage and remaining browser limitations.

---

# Historical Phase 3 architecture (before master enrichment integration)

# Bahasa Melayu Mastery - Phase 3

## Architecture

The Phase 1 plain HTML/CSS/JavaScript ES-module architecture remains in place.
`js/app.js` coordinates navigation and events; `activities/` renders activities;
`components/` supplies shared controls; `js/state.js` and `js/storage.js` own
persistent drafts. The existing Node test runner, static build, deployment
watcher, same-origin AI endpoint and server-only Gemini SDK remain in use.

## Read-only workbook preparation

`npm run data:prepare` invokes `tools/import-workbook.mjs`. It runs automatically
before `npm run dev` and `npm test`, and inside `npm run build` before the
curriculum module is loaded. Build/development hosts need Node and Python 3
(`python`, or the executable named by `PYTHON`). No additional npm or Python
packages were installed.

1. `tools/read-workbook.py` uses Python standard-library ZIP/XML readers to read
   OOXML cell values, workbook relationships, shared/inline strings and booleans.
   It reports the sheets and headers and reads only `MASTER_CONTENT` as learning
   records. Formula cells in that table and duplicate headers fail preparation;
   formulas are never evaluated or trusted via stale cached values.
2. `data/adapters/excel.js` maps the real column names. Export eligibility requires
   `status_semakan = Disahkan`, a true `aktif` value (boolean true, 1 or TRUE),
   and nonempty `teks_app`. Invalid eligible IDs/year/type/metadata and duplicate
   IDs fail the import. Duplicate text is retained under each distinct ID.
3. `data/generated/master.js` contains the reviewed public learning data and a
   content version derived from the workbook SHA-256. It is reproducible and
   regenerated, never hand edited.
4. `audit/workbook.json`, outside the public asset tree, contains the workbook
   hash, sheet/header inventory, source/export/exclusion counts and per-ID
   `teks_sumber`, `fail_sumber`, `lokasi_sumber`, `isu_semakan` provenance.
5. The build excludes `.xlsx` and adapter files, and never copies `audit/`.
   The development/preview server explicitly denies the workbook, adapter and
   audit URLs. Pupils receive reviewed text only, not source corrections.

The workbook is never modified. Current SHA-256:
`6e650cb0c55710af5f25d3766f972164fb79963b11676d8c4aae691a30abdb2e`.

### Verified source inventory

| Sheet | Populated XML rows, including headings |
| --- | ---: |
| RINGKASAN | 36 |
| MASTER_CONTENT | 1,081 |
| SEMAKAN_AWAL | 22 |
| SUMBER | 11 |

The actual master columns are `item_id`, `tahun`, `jenis`, `tema_no`, `tema`,
`unit_no`, `unit`, `item_no`, `teks_sumber`, `teks_app`, `status_semakan`, `aktif`,
`isu_semakan`, `fail_sumber`, `lokasi_sumber`, `edisi`.

| Year | Content | Items | Units | Items per unit |
| --- | --- | ---: | ---: | ---: |
| 1 | ejaan | 240 | 24 | 10 |
| 2 | ejaan | 240 | 24 | 10 |
| 3 | ejaan | 240 | 24 | 10 |
| 4 | imlak | 120 | 24 | 5 |
| 5 | imlak | 120 | 24 | 5 |
| 6 | imlak | 120 | 24 | 5 |

All 1,080 current records pass the review/active/text filter. There are 81
multiword ejaan entries and 90 repeated-text occurrences beyond the first
occurrence; none are deduplicated. Years 1-3 have no supplied theme or unit
names. Corrections such as `berpengalaman`, `pemeliharaan` and `integriti` come
from `teks_app`; their original misspellings remain only in the private audit.

## Normalized curriculum boundary

`LearningItem` in `data/schema/models.js` documents stable `id`, `year`, `type`,
reviewed `text`, `form`, `themeNo`, `theme`, `unitNo`, `unit`, `itemNo`, `edition`.
`form` distinguishes an ejaan word from a multiword entry for display only.
Whitespace detection does not split the entry or classify its grammar/idiom
meaning. Every imlak item is explicitly a sentence.

`js/curriculum-service.js` selects `master-2026` by default. `filterItems`
filters year, unit and type; packs expose reviewed items, unit metadata and
ejaan items as source vocabulary plus any separately reviewed teacher vocabulary.
Source meanings, examples and grammatical categories remain empty; optional
enrichment is nested separately and never spread into source fields. Missing theme/unit titles stay empty. UI modules do not parse
spreadsheet headers. The old generic vocabulary adapter and explicitly selected
`demo` pack remain available for regression coverage and future content packs.
The production vocabulary source contains no Phase 1 demo vocabulary. Six explicitly
labelled Phase 3 DEMO supplements are optional additions to source cards.

`data/demo/content.js` retains the separate two essay topics and one story
starter. Their views explicitly say DEMO; they are not workbook-derived.
`data/difficulty.js` remains an application teaching profile, not an official
assessment rubric or invented curriculum mapping.

## Activity behavior

| Activity | Tahun 1-3: ejaan | Tahun 4-6: imlak |
| --- | --- | --- |
| Bank Kata & Frasa | Year/unit/search filtering; intact entries; no invented definitions/examples/categories; generated AI explanations on request | Honest empty state and link to imlak; earlier-year review requires deliberately selecting that year |
| Bina Ayat | Selected word/phrase prompts an original pupil sentence | A selected sentence is a visible reference; pupil writes a new sentence by changing actor/place/purpose, not a required transcription |
| Kembangkan Ayat | Pupil writes and locks an original using the selected entry, chooses optional details, edits a separate revision | Pupil writes an initial version inspired by the visible reference and enriches/alters it; original and revision remain separate |
| Bina Perenggan | Pupil chooses an idea, optionally plans and writes independently | Same engine, explicitly requires pupil-created links; never joins workbook sentences |
| Karangan Berpandu | Separate labelled demo titles, eight stages, content-ID-specific plans and drafts | Same independent content set; workbook themes do not become reviewed essay titles/points/model essays |
| Rantai Cerita | Separate labelled demo opening and pupil continuations | Same opening; no imlak-to-story assembly |
| Latihan Ejaan & Imlak | Hear or deliberately reveal/view the entire word/phrase, type, check locally | Listen to an individual sentence, transcribe, check spelling/case/punctuation locally |
| Draf Saya | Saved text, original, revision, planning, title and item identity | Same all-year resume/export/delete behavior, including practice attempts |

Siapa/Apa, Buat Apa, Di Mana, Bila, Bagaimana and Mengapa remain optional.
The sentence preview combines the pupil's own scaffold fields; replacing
existing writing still requires explicit confirmation. Expansion details use
persisted optional checkboxes. Locking an original can initialize an empty
revision from the pupil's own text; AI/examples never overwrite either editor.

`components/content.js` renders shared unit/item selectors. A unit change filters
browsing without changing the active unfinished draft. Its current item remains
visible even outside that filter. Selecting another item opens/resumes that
item's draft and retains the old draft. Returning to an item chooses its most
recently updated draft. Changing year switches the persisted per-year workspace
with the existing confirmation. Old Phase 1 drafts remain resumable and labelled.

## Deterministic transcription and speech

`js/transcription.js` compares reviewed text and attempts locally. It normalizes
Unicode NFC and repeated whitespace; spelling/order, case, punctuation position
and spacing discrepancies receive separate guidance. Suggestions are empty:
this check assesses transcription, not creative quality or grammar. The
feedback is advisory rather than an edit-distance grade or a teacher rubric.
Creative-writing controllers never invoke this comparator.

Practice selectors use unit/item numbers without answer text. Initial hints
contain no complete answer, including speech callbacks and button attributes.
Replay speaks the reference without printing the currently spoken sentence.
A deliberate reveal enables visual practice and labels it assisted. Attempt
counts, latest correctness, reveal state and success without the answer displayed
are saved by `item_id`, not row number. This is local learning progress, not a
secure assessment: content is necessarily available in the browser data module.
A fresh practice attempt preserves the prior attempt as a draft.

`js/speech-service.js` retains ms-MY preference, another Malay voice or a browser
fallback, sequential playback, cancellation, speed and existing editor controls.
Practice announces missing synthesis or ms-MY voice and offers deliberate visual
reveal / teacher assistance. Speech errors leave the input editable. Real voice
availability/pronunciation depends on browser/OS and remains unverified here.

## AI contract and isolation

The existing API versus Generate Prompt routes are preserved. Sentence hints,
checks, expansion, vividness, vocabulary help/explanations/examples and essay
next-step guidance default to API. Paragraph/essay reviews default to local
Generate Prompt; the server independently rejects API calls to those actions.
Any action can deliberately use local prompt generation. Practice exposes no
Gemini action and is rejected as an AI activity.

`tutorRequest` builds an allowlisted object. Non-essay vocabulary/sentence requests
include a stable item ID; sentence/expansion requests can include their reviewed
reference. Cache identity includes year/activity/action/item/content ID/pupil text and any
reference. Prompts explicitly distinguish original writing from transcription:
a sentence is not wrong merely because it differs from the reference.
Generated explanations/examples are described as generated help.

Every essay request continues to include selected year, selected title and current
pupil writing, excluding item references, hidden plans/scaffolds/model text.
Changing title or stable content ID changes cache identity; selecting an essay
or story clears the session cache. Feedback remains
separate in the existing dialog, with no automatic writing mutation path.

The sole endpoint remains `POST /api/ai/tutor`. POST/JSON/origin checks, streamed
32 KiB body limit, server validation, rate/concurrency protection, cancellation,
deadlines, secret-safe errors and no-store responses remain unchanged. Credentials
and `@google/genai` remain server-only. The response cache retains its five-minute
TTL/40-entry cap and caches successful normalized responses only.

## State, build and updates

`bmMastery:state:v1` remains the persistence key; hydration adds optional unit,
item ID and progress fields while preserving old drafts. `bmMastery:speechRate`
is unchanged. Drafts retain curriculum/version provenance, per-year active
pointers, immutable expansion originals, essay stages and story continuations.
Storage failure continues in memory with an explicit save warning and export.
There is no account, cloud sync, analytics or service worker.

The build validates six production packs, copies only public assets and emits a
content-derived `version.json`. The existing deployment watcher announces updates
without rerendering/reloading the editor. Reload remains deliberate and requires
a successful draft save. New workbook IDs do not repurpose an older ID's score.
Removed IDs remain in local drafts/progress. Legacy title migration is additive
and conservative as described below; no saved writing is silently deleted.

## Remaining authored content and validation

Teacher-authored vocabulary meanings/examples/categories, additional story
starters, essay titles/points/model compositions, richer paragraph prompts and
formal curriculum/rubric mapping are not supplied by this workbook. Years 1-3
unit/theme titles must remain absent unless separately authored and reviewed.

See `VERIFICATION.md` for test/build results and the pending browser and actual
speech checks. Live Gemini was deliberately not exercised for Phase 3. No workbook modification, commit or push occurred.

## Phase 3 supplementary schemas and publication

`data/schema/enrichment.js` validates the separate `data/teacher/content.js` module;
`js/enrichment-service.js` loads it once and returns cloned published content.
The read-only workbook reader, adapter and generated master remain unchanged.
No meanings/examples are bulk generated or inferred by the importer.

| Collection | Required identity/content | Optional fields |
| --- | --- | --- |
| enrichment | source_item_id referencing a current Tahun 1?3 ejaan ID | meaning, simple_definition, grammatical_category, example_sentence, example_sentence_simple, opposite_word, related_words, notes_for_teacher |
| vocabularyBank | id, year, word | same vocabulary fields |
| guidedWriting | id, year, title | theme, unit, writing_type, prompt, planning_questions, vocabulary_help, sentence_starters, paragraph_guidance, checklist, sample_outline, model_text, notes_for_teacher |
| storyStarters | id, year, title, starter_text | setting, characters, challenge, vocabulary_hints, continuation_prompts, notes_for_teacher |

Each record also requires `source_type` and `status`; author, reviewed_by and
reviewed_at are provenance metadata. Independent IDs are globally unique across
supplementary collections and cannot collide with master IDs. Year is 1?6 or an
explicit nonempty array of unique years. Unknown fields, orphan source IDs,
invalid types and duplicate identities fail validation during module loading and
build. Blank optional text is omitted. Missing official theme/unit titles stay
absent. `writing_type` and `prompt` are optional; minimal title records render.

Enrichment lookup uses `source_item_id` only, never matching text. Source fields
such as `text`, `teks_app` and `word` are rejected in enrichment records.
`attachEnrichment` attaches a nested record; cloning isolates consumer changes
from the generated master and the authored collection. Items without hints remain
usable without fabricated values or empty labels. Six sample enrichments cover
ayam, bermain, bersih, ringan tulang, and two separate jalan raya IDs:
`Y1-E-U12-I09` and `Y3-E-U09-I02`. Their examples differ by ID. All six are
`demo/demo`, with no teacher-review claim. The two existing essay titles and the
single story opening retain their original IDs and text; their support is DEMO.

## Lightweight provenance convention

| source_type | Where it applies | Status/handling |
| --- | --- | --- |
| reviewed_source | Read-only reviewed workbook dataset; source vocabulary cards | Original workbook review/active filter; no source object mutation |
| teacher_authored | Independent supplementary records | draft or reviewed; reviewed requires nonempty author/reviewed_by and a valid calendar date reviewed_at |
| demo | Six sample enrichments, two guided essays, one story starter | demo only; always visibly labelled as not teacher reviewed |
| pupil | New and hydrated local drafts | Text, originals, plans and continuation lines remain pupil work |
| ai_generated | Successful AI service results, including cached results | Explicit generated-help label; never promoted into authored/reviewed data |

Workbook items retain their existing source schema; reviewed provenance follows
from the master dataset/import boundary, while vocabulary view models carry the
explicit `reviewed_source` field. No extra review metadata is invented. AI
response provenance is assigned locally, not trusted from model output. Prompt
mode is locally generated instructions, not a reviewed content record.
`provenanceLabel` distinguishes all five types and does not label unknown/draft
content reviewed. Teacher drafts are filtered from activities; DEMO vocabulary
cannot enter the future independent bank. `notes_for_teacher` is omitted from
pupil rendering and AI requests. It is not confidential storage: authored files
are public static assets, so private notes must not be placed there.

## Draft compatibility and content identity

Storage remains `bmMastery:state:v1`; hydration defaults missing `contentId` and
`selectedEssayContent` fields without replacing existing drafts. Essay/story
workspaces use stable authored IDs, distinct from source item IDs. Equal titles
can have independent content IDs and independent drafts. Item practice/progress
continues to use source `item_id`.

When a legacy draft has no content ID, its exact title may adopt an ID only when
it uniquely identifies one current record of that activity. This preserves its
draft ID, text, original, revision, plans, stage, lines and timestamps; migration
is persisted to the same storage key. It never merges or deletes drafts. An
existing stable ID is retained through renames or content removal. Ambiguous or
unavailable legacy content stays accessible through Draf Saya without guessing a
starter. Missing story openings display an honest unavailable message; pupil
continuations remain editable. Storage failures leave writing usable in memory
and show the existing save warning; the previous stored draft remains intact.
Title matching is exclusively a legacy compatibility fallback, not enrichment
identity. Generic Phase 1 title-based regression fixtures remain supported.

## Future vocabulary and local support

The independent vocabularyBank is currently empty. Only separately reviewed
teacher-authored entries become bank cards; they do not modify imlak items,
practice references or workbook unit metadata. Unitless teacher entries stay
visible when browsing a workbook unit, and their cards/summary identify the
teacher source. The optional third getCurriculumPack argument accepts a normalized
supplementary collection for integration tests/future datasets; production uses
the validated authoring module. Imlak is never tokenized into permanent vocabulary
or concatenated into essays, paragraphs or story openings.

Optional hints/examples, guided outlines and model text use native disclosure
controls. Examples do not become editor values. The editor's local surface check
examines the first letter, final punctuation (including closing quotes/brackets),
repeated spaces/tabs and leading/trailing whitespace. It reports `surface_only`;
it does not assess every sentence, grammar, meaning, spelling, coherence or give
a grade. Even zero detected issues explicitly says grammar/meaning were not
assessed. Practice uses its separate deterministic transcription comparator and
has no enrichment disclosure or AI action. Essay AI keeps year, title, current
writing and optional content ID, excluding plans, hints, models and source text.
