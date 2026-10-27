# BAHASA MALAYSIA — KEMBANGKAN AYAT DETAIL-AWARE AI ENHANCEMENT STATUS

Completed and validated locally on 27 October 2026. No commit, push or deployment. No live Gemini calls were made.

PASS below describes implementation, deterministic checks, mocked response handling and the reviewed fixtures. It does not establish the linguistic quality of future live Gemini responses.

| # | Requested check | Status | Evidence |
| --- | --- | --- | --- |
| 1 | All eight details supported | PASS | One canonical detail catalogue now supplies both existing pupil guidance and meaningful AI generation goals. |
| 2 | Selected details passed to all six AI actions | PASS | Selected IDs plus eight explicit true/false states; all 256 combinations tested. |
| 3 | Selected details influence AI examples | PASS | Shared instructions actively target relevant selections and semantically review coverage; representative fixtures exercised. Live-model influence remains unverified. |
| 4 | Contextually inappropriate details handled naturally | PASS | Justified omissions permitted; reviewed washing-hands fixture omits an unnecessary emotion with a clear explanation. |
| 5 | More meaningful sentence expansion | PASS | Short-example instruction replaced; richer fixtures retain actions, meaning, keyword and situation. |
| 6 | Tahun 1–6 age adaptation | PASS | Six sentence-specific styles and soft ranges; no hard word-count rejection. |
| 7 | Natural Malaysian Bahasa Melayu | PASS | Prompt requirements and manual fixture review cover grammar, vocabulary, coherence and repetition. Future live output not verified. |
| 8 | Target keyword preserved | PASS | Existing Unicode-aware exact word/phrase validation retained, including multiword/substrings tests. |
| 9 | Active situation preserved | PASS | Existing situation routing, canonical IDs, custom mode and response relevance checks retained. |
| 10 | Selected details considered in AI feedback | PASS | Feedback instructions inspect actual original/current writing, distinguish successful details from opportunities, and give context-specific suggestions. |
| 11 | Trilingual keyword meaning preserved | PASS | Definitions, language validation, schema and shared service remain unchanged. |
| 12 | Word-meaning example incorporates appropriate details | PASS | Single example considers year/situation/selections; natural subsets allowed, definitions explicitly excluded from expansion requirements. |
| 13 | Individual Salin buttons preserved | PASS | Existing copy cards unchanged; richer sentence copying, keyboard activation and feedback checked. |
| 14 | Non-AI Semak Asas Tulisan removed | PASS | Button, explanatory block and result panel omitted in expansion; obsolete expansion handler path disabled. |
| 15 | Essential input validation preserved | PASS | Empty input, keyword/phrase checks, situation validation, request validation and live keyword feedback retained. |
| 16 | Existing writing and autosave protected | PASS | Context changes cancel/clear AI results without changing pupil writing; no new persistence architecture. |
| 17 | Legacy drafts preserved | PASS | Existing plan/keyword/situation hydration unchanged; full detail states derived from the saved plan. |
| 18 | TTS preserved | PASS | Existing speech suite plus browser reading/pause/resume/stop/speed checks passed. |
| 19 | Existing AI routing preserved | PASS | Same Gemini endpoint, configured model, SDK, response schemas and output budgets. No server routing changes. |
| 20 | Security and rate limits preserved | PASS | Existing validation, limits, cancellation and error suites passed; contradictory detail maps rejected. |
| 21 | iPad and mobile layouts | PASS | 27 responsive checks on source and production preview, including rich examples in portrait/landscape. |
| 22 | Accessibility | PASS | Native detail controls/focus preserved; copy controls keyboard-accessible, visible after scrolling and at least 44px high. |
| 23 | Focused tests | PASS | 27 new tests: 23 detail/fixture tests and four real-controller tests. |
| 24 | Full regression suite | PASS | 249 tests passed; all 222 baseline tests retained, none deleted. |
| 25 | Production build | PASS | 52 assets built; production browser verification and source/security checks passed. |

## Root cause

The previous implementation already transmitted selected detail IDs to all six actions. The problem was not absent keyword/situation context or competing prompt builders.

The shared expansion prompt explicitly requested up to three **short** examples (`contoh ayat ringkas`). It also inserted broad writing-profile expectations, which could describe paragraphs or essays for older pupils. The selected details contributed brief guidance, but there was no strong common instruction to use them as expansion goals, review their semantic coverage, explain reasonable omissions or adapt single-sentence richness by year. Thus a basic example containing only the keyword and one location could satisfy the existing structural validation despite missing useful expansion goals.

A separate issue affected stale output: the context identity covered keyword, situation, year and draft identity, but not detail selections or original/current sentence edits. Detail changes saved the plan without clearing an existing meaning result. The non-AI writing check appeared because the shared editor rendered it unconditionally for expansion as well as other activities.

## Shared detail-aware logic

`expansionDetails` remains the sole list of eight supported options. Each entry now includes a generation goal alongside its existing visible guidance. `detailSelectionStates` derives a complete boolean map from selected IDs. This map is sent by the actual controller and validated by `tutorRequest` on client and server. Unknown, missing, nonboolean or contradictory explicit maps are rejected. Older callers providing only selected IDs are supported by deriving the full map; no draft migration is required.

The existing `buildExpansionTutorPrompt` now calls one shared `expansionDetailInstructions` helper for **all six actions**:

- `sentence_hint`
- `sentence_check`
- `sentence_expand`
- `sentence_vivid`
- `vocabulary_help`
- `keyword_meaning`

The helper requests meaningful location, time, method, reason, emotion, explanation, qualities and clause connections when selected and appropriate. It aims to demonstrate all relevant choices, allows justified omissions, permits one construction such as `kerana` to satisfy both reason and conjunction, and requests semantic self-review in the same response. No regex or word search claims to detect emotional, descriptive or causal meaning.

With no selections, all eight states are false; guidance remains useful and optional suggestions do not become hidden requirements. Feedback actions compare the pupil's real writing against selected goals. Missing selected information is treated as a possible improvement rather than automatically as a grammatical error.

Meaning definitions retain their dictionary purpose. Only the one Malay example considers expansion goals; when many details are selected, a natural subset is allowed. English/Mandarin definitions are not stretched to contain sentence details. External copy-prompts use the same shared builder and pedagogical requirements.

| Year | Soft example range | Sentence emphasis |
| --- | --- | --- |
| Tahun 1 | 8–15 words | Familiar vocabulary, simple structure |
| Tahun 2 | 10–20 words | Useful details in a clear sentence |
| Tahun 3 | 15–25 words | Description and clear idea connections |
| Tahun 4 | 20–35 words | Rich information with connected ideas |
| Tahun 5 | 25–40 words | Meaningful elaboration and varied structure |
| Tahun 6 | 25–45 words | Rich, varied, coherent development |

These ranges guide generation; they do not reject otherwise valid responses or establish linguistic quality. Grammar, situation, exact keyword, natural meaning and useful details take priority over decorative length. Existing one-sentence, keyword, structure, markup and relevance validation remains intact.

Response schemas were deliberately preserved. The model is asked to review detail coverage semantically before returning the same structured response. Brief explanations of omitted details may appear in existing feedback prose; meaning examples can explain their choices in the existing internal `reason`. No extra Gemini checking call, structured coverage model, word-count gate or unverified “Butiran digunakan” badge was added. The manually recorded evidence in test fixtures is for local review, not a production classifier or copied pupil content.

## Stale responses and removal of the redundant check

AI context identity now includes the eight detail states, original sentence and expanded text as well as keyword, situation, year and draft. The existing `write` path compares context before and after autosave. A relevant edit immediately cancels the old request and clears its result without rerendering the activity or replacing pupil writing. The existing response identity guard and cache identity provide additional protection. A live original editor is synchronized before a new request is built.

The shared editor omits the entire non-AI check block only when `draft.activity === 'expansion'`. Its button, explanatory paragraph and dedicated result panel are absent. The controller no longer executes that check in expansion, including an obsolete synthetic button event. Other tabs keep the shared check, its imports and styles because they still use it. Essential keyword/situation validation and Cikgu AI evaluation remain available.

## Representative prompts

[Complete prompt-builder output for seven scenarios](KEMBANGKAN_AYAT_DETAIL_PROMPTS.txt) includes:

1. Tahun 1: tempat + masa.
2. Tahun 3: cara + sebab + perasaan + kata hubung.
3. Tahun 4: six selected details.
4. Tahun 6: seven selected details.
5. A custom washing-hands situation with a justifiable emotion omission.
6. No details selected.
7. Trilingual keyword meaning with six selected details.

Each sample is the complete output of the real shared builder, including action instructions, exact keyword/situation, year, original/current sentences and all eight boolean states. These are prompts, not claims of live Gemini output.

## Before/after fixtures and linguistic review

The following are manually reviewed teaching fixtures in [tests/fixtures/expansion-details.mjs](../tests/fixtures/expansion-details.mjs). “Before” illustrates the previous overly basic pattern; “after” is a proposed local fixture, not a captured live-model response. Word counts are descriptive review aids only.

### Tahun 1 — tempat and masa

Keyword: **membantu**. Situation: **Membantu ibu menyediakan sarapan.**

Before: Saya membantu ibu di dapur.

After: **Pada waktu pagi, saya membantu ibu menyediakan sarapan di dapur.**

Review: 10 words; familiar vocabulary, one main action, natural breakfast time and location. The original meaning is preserved.

### Tahun 3 — cara, sebab, perasaan and kata hubung

Same keyword and situation.

Before: Saya membantu ibu menyediakan sarapan.

After: **Saya berasa gembira kerana dapat membantu ibu menyediakan sarapan dengan teliti supaya kami dapat makan bersama-sama.**

Review: 16 words; emotion relates to helping, method supports the action, and purpose gives a useful reason. The clause links are meaningful rather than an arbitrary list of conjunctions.

### Tahun 6 — seven selected details

Selected: tempat, masa, cara, sebab, penerangan, kata adjektif, kata hubung.

Before: Saya membantu ibu di dapur.

After: **Pada awal pagi, saya membantu ibu menyediakan sarapan yang berkhasiat untuk seisi keluarga di dapur dengan teliti supaya semua hidangan dapat disiapkan sebelum kami memulakan aktiviti harian.**

Review: 27 words; more mature elaboration identifies recipients and purpose while retaining one central action. Adjective and clause choices support the situation without an unrelated storyline or repetitive decoration.

### Tahun 4 — six selected details, overlapping reason/conjunction

Selected: tempat, masa, cara, sebab, kata adjektif, kata hubung.

After: **Pada waktu pagi, saya membantu ibu menyediakan sarapan yang berkhasiat di dapur dengan teliti kerana kami ingin menikmati hidangan bersama-sama.**

| Detail | Fixture evidence |
| --- | --- |
| masa | Pada waktu pagi |
| tempat | di dapur |
| cara | dengan teliti |
| sebab | kerana kami ingin menikmati hidangan bersama-sama |
| kata adjektif | berkhasiat |
| kata hubung | kerana linking the action and reason |

Review: 20 words; one `kerana` clause satisfies two selections, avoiding a duplicated causal phrase. These are human-reviewed fixture annotations, not automatically inferred semantic proof.

### Reasonable omission

Tahun 1, keyword **mencuci**, custom situation **Saya menerangkan langkah mencuci tangan sebelum makan.**

Selected: tempat, masa, cara, perasaan, kata hubung.

Example: **Sebelum makan, saya mencuci tangan di sinki dengan sabun supaya bersih.**

Explanation: **Perasaan tidak ditambah supaya contoh kekal sebagai penerangan langkah yang jelas, tanpa mereka emosi yang tidak dinyatakan.**

Review: 11 words; location, time, method and conjunction explain a useful hygiene step. An invented emotion is unnecessary for this instructional context. Omitting that selection is explained, not silently treated as full coverage.

Additional reviewed fixtures cover adjective/explanation distinctions, the complete idiom `ringan tulang`, and an unselected-details scenario. All examples retain the target phrase, maintain one sentence, and preserve individual copy controls.

## Tests and browser validation

- **249 tests passed**, 0 failed/skipped/cancelled; all **222 baseline tests retained**.
- **27 new tests**: 23 in `expansion-details.test.mjs`, four real-controller tests.
- All **256** selection combinations checked for complete true/false propagation.
- All **six actions × six years** checked for complete prompt context.
- Existing structured-output formats, malformed output, keyword/phrase matching, situation assessment, trilingual definitions, errors, rate limits, storage, update notifications and TTS suites passed.
- Source application: **27 responsive browser checks passed**.
- Production preview: **27 responsive browser checks passed**, including scrolling rich cards into view and verifying visible 44px+ Salin controls on desktop, iPad portrait/landscape and Android portrait/landscape.
- Browser checks additionally covered original/detail edits during pending requests, completed-result invalidation, selected states in actual requests, exact sentence copying, restored writing and removal of the non-AI check while retaining it in Bina Ayat.
- `npm run build`: **52 assets**, passed.
- `npm run check`: **134 JavaScript modules**, passed, including existing credential/SDK separation and source checks.
- `git diff --check`: passed.

All browser AI, clipboard and speech responses were mocked in an isolated headless Edge profile. No real pupil browser profile or live Gemini quota was used.

Artifacts:

- [Before: previous iPad activity](../test-results/details/before-ipad.png)
- [After: expansion UI without the non-AI check](../test-results/expansion/situation-ipad-portrait-builtin.png)
- [Rich example on iPad](../test-results/expansion/detail-rich-ipad-portrait.png)
- [Rich example and Salin on Android portrait](../test-results/expansion/detail-rich-android-portrait.png)
- [Android landscape](../test-results/expansion/detail-rich-android-landscape.png)
- [Browser results](../test-results/expansion/browser-results.json)
- [Full regression log](../test-results/detail-regression.log)

Screenshots and logs remain local ignored artifacts under `test-results/`.

## Exact modified/added files

1. `components/writing.js` — conditionally omits the expansion-only non-AI check block.
2. `js/app.js` — sends all detail states, tracks complete relevant context, clears stale output and guards the removed checker path.
3. `js/expansion.js` — canonical generation goals and full selection-state helper.
4. `js/expansion-tutor.js` — central detail-aware instructions and six soft year-specific sentence styles; response schemas unchanged.
5. `js/tutor-actions.js` — validates all detail states while supporting older selected-ID-only requests.
6. `tests/expansion-details.test.mjs` — 23 focused tests.
7. `tests/fixtures/expansion-details.mjs` — reviewed before/after, coverage and omission fixtures.
8. `tests/phase3-controller.test.mjs` — four added real-controller regression tests; existing tests retained.
9. `tools/verify-expansion-browser.mjs` — additional rich-card, state propagation, removal and stale-result checks; earlier coverage retained.
10. `audit/KEMBANGKAN_AYAT_DETAIL_AI.md` — this report.
11. `audit/KEMBANGKAN_AYAT_DETAIL_PROMPTS.txt` — complete representative shared prompts.

No new dependency, backend endpoint, database schema, storage key, model selection, rate-limit change or runtime component was introduced. Existing shared styles and local-check infrastructure remain for other tabs.

## Remaining limitations

- Live Gemini behavior was not tested. Stronger instructions and reviewed fixtures cannot guarantee that every future response uses every relevant detail or meets the suggested grade-level style. Linguistic quality still requires live-model evaluation and teacher judgment.
- Deterministic validation proves response structure, exact keyword/phrase inclusion and allowed inputs, not semantic richness, emotional appropriateness or grammar. Situation relevance remains the existing same-generation model assessment. The new detail review is semantic prompt guidance, not a second model call or a mechanical quality score.
- Browser checks use desktop Edge viewport emulation. Physical iPad/Android devices, Safari, audible TTS and actual device clipboard permissions were not tested.
- Existing original sentences remain immutable protected baselines. A different original can be started with Draf baharu; the prior draft is preserved.
- External AI output after a copied prompt cannot be validated by this application.
