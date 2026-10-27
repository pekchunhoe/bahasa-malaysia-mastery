# BAHASA MALAYSIA — KEMBANGKAN AYAT SITUATION & AI ENHANCEMENT STATUS

Completed locally on 27 October 2026. No commit, push or deployment. No live Gemini calls were made.

PASS below means implementation and local automated verification passed. AI generation, contextual assessments and translations were exercised with explicit mock fixtures; this is not a certification of live model linguistic accuracy or physical-device behavior.

| # | Requested check | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 100 situations completed | PASS | Exactly S001–S100, unique IDs and text, supplied wording retained. |
| 2 | 10 categories completed | PASS | Exactly 10 categories, each containing 10 situations. |
| 3 | Situation category filtering | PASS | Semua Kategori and category-specific dropdown filtering. Active context stays explicit when filtered out. |
| 4 | Situation search | PASS | Case/diacritic/whitespace-tolerant local search; multiple search terms supported. |
| 5 | Custom situation mode | PASS | Natural text and punctuation, explicit activation, whitespace rejection, 300-character bound. |
| 6 | Situation switching | PASS | Exclusive native radios; both values retained; hidden modes excluded from requests. |
| 7 | Built-in keyword integration | PASS | Existing year-specific vocabulary and item identities preserved. |
| 8 | Custom keyword integration | PASS | Existing validation, activation, phrase matching and saved values preserved. |
| 9 | All AI actions situation-aware | PASS | All six expansion actions share one validated context builder and request contract. |
| 10 | All AI examples contain active keyword | PASS | Server and client independently validate every example using Unicode-aware whole-word/phrase matching. |
| 11 | Contextually appropriate examples | PASS | Situation-primary instructions and same-generation contextual assessment; negative/missing assessments rejected. No literal-overlap scoring or extra Gemini calls. |
| 12 | Individual Salin buttons | PASS | Each structured sentence gets its own existing example card and copy control; legacy singleton sentences separated safely. |
| 13 | Copy feedback and accessibility | PASS | Only sentence text copied; Disalin ✓, keyboard activation, duplicate protection and clipboard-failure feedback tested. |
| 14 | New Cikgu AI keyword-meaning button | PASS | One trigger beside the active keyword; both keyword modes; shared service and collapsible inline result. |
| 15 | Malay meaning | PASS | Required, validated `maksud_bm`, displayed as plain text. |
| 16 | English meaning | PASS | Required, validated `meaning_en`, displayed with `lang="en"`. |
| 17 | Mandarin meaning | PASS | Required `meaning_zh` with Chinese characters; `lang="zh-Hans"`, CJK font fallbacks and responsive card. |
| 18 | One keyword-based example sentence | PASS | Meaning schema and validator require exactly one complete Malay sentence containing the target. |
| 19 | Correct handling of ambiguous meanings | PASS | Contextual sense selection, whole-phrase/idiom instructions, general-sense fallback and same-meaning assessment; mocked idiom fixture tested. |
| 20 | Safe Gemini integration | PASS | Existing `/api/gemini`, server model selection, SDK, body limits, quotas, timeouts, cancellation and no-store response path reused. |
| 21 | Autosave | PASS | Existing draft fields and immediate store writes; all keyword/situation changes preserve writing. |
| 22 | Legacy draft compatibility | PASS | Missing situation fields remain unset; no arbitrary situation assigned; writing and keyword IDs preserved. |
| 23 | TTS preserved | PASS | Baseline speech regression suite and browser read/pause/resume/stop/speed checks passed. Browser speech mocked. |
| 24 | iPad portrait layout | PASS | Headless Edge 768×1024 and 820×1180 coverage; no activity overflow/clipping. |
| 25 | Android mobile layout | PASS | Portrait 360×800/412×915 and landscape 800×360; situation selectors, Chinese text and copy controls checked. |
| 26 | All focused tests | PASS | 29 new focused tests; previous 11 keyword tests retained. |
| 27 | Full regression tests | PASS | 222 total passed, including the full 193-test baseline; 0 failures or skipped tests. |
| 28 | Production build | PASS | 52 static assets; production preview passed the same extended browser checks. |
| 29 | Source and security checks | PASS | 132 JavaScript modules checked, whitespace/conflict checks passed, credentials/SDK imports remain excluded from browser assets. |

## Situation data and persistence

The static catalogue is [data/situations.js](../data/situations.js). It was transcribed from the supplied list, preserving the exact S001–S100 situation wording and category membership. Records and category arrays are frozen. No runtime generation, downloads, database or dictionary service was added. The full selector works offline once the application's modules have loaded.

Situations use the existing `bmMastery:state:v1` draft fields: `situationMode`, `situationId`, `customSituation`, `customSituationDraft`, `situationCategory`, and `situationQuery`. The active value is resolved by mode. Category/search filters do not silently change it. The active selection remains available in an explicitly labelled group if it is outside the filter.

Legacy drafts retain their missing situation fields and resolve to no selected situation. Invalid or removed IDs are not guessed. Built-in IDs resolve to canonical text on the server; forged IDs, mismatched text and hidden-mode values are rejected. Original and expanded writing, revisions, item mapping, existing keyword fields and all eight detail choices retain their existing storage architecture. A custom input becomes active only after submission, while incomplete edits continue to autosave separately.

## How context reaches every AI action

The existing `aiRequest` controller gathers the active keyword mode/word, active situation mode/ID/text, year, original sentence, live expanded sentence, selected expansion options, title, item ID and existing reference context. It calls the same `createAIService`, which posts to the existing `/api/gemini` endpoint. `tutorRequest` validates and allowlists the new fields on both client and server. The server resolves built-in situation text from the static catalogue.

| Actual action ID | Existing/new UI | Response |
| --- | --- | --- |
| `sentence_hint` | Beri saya petunjuk | Expansion feedback with separate examples |
| `sentence_check` | Semak ayat saya | Expansion feedback with separate examples |
| `sentence_expand` | Bantu saya kembangkan ayat | Expansion feedback with separate examples |
| `sentence_vivid` | Jadikan ayat lebih menarik | Expansion feedback with separate examples |
| `vocabulary_help` | Cadangkan kata atau frasa | Expansion feedback with separate examples |
| `keyword_meaning` | Cikgu AI · Maksud Kata Kunci | Three explanations and exactly one Malay example |

All six use `buildExpansionTutorPrompt`. The active situation and keyword take priority over the old workbook stimulus; no unrelated event may be copied from that reference. Prompts require natural Malaysian Bahasa Melayu, exact phrase preservation, age-appropriate guidance, correct kata hubung use, and respect for the pupil's original ideas. Pupil content is serialized as JSON data with explicit instruction boundaries. External copy-prompts use the same constraints locally.

Expansion feedback now identifies each example separately, with a contextual relevance assessment from the same generation. Deterministic checks reject missing keywords, malformed fields, empty sentences, multiple sentences in one structured example, markup and negative/missing active-situation assessments. Zero examples are permitted when a natural sentence cannot be constructed; the AI is instructed to explain possible pupil adjustments gently. Meaning responses additionally require all three explanations, Chinese characters, a matching keyword, one example and an affirmative same-sense assessment. Invalid output uses existing safe error/retry/prompt controls; there is no automatic retry loop.

Shared example-card and clipboard functions were extracted without changing the behavior of other activities. Explanatory prose has no copy controls. Meaning results use the same teacher execution/service path in a collapsible card, not a second AI implementation. Keyword/situation changes cancel and clear the associated result; an identity guard also suppresses late results. A cancelled old response cannot reset or close a newer request. Cache identity includes the validated situation context.

## Representative full prompts and meaning output

[Full expansion and keyword-meaning prompts](KEMBANGKAN_AYAT_PROMPT_EXAMPLES.txt) were generated directly by the real prompt builder using Tahun 2, keyword `membantu`, situation `S001`, the pupil's original/expanded sentences and selected tempat/masa/kata hubung. They are complete prompt text, not abbreviated examples.

The following is a **mock fixture used for local validation**, not a live Gemini result. Production definitions are generated by Gemini; these strings are not hardcoded as application answers.

**Maksud Kata Kunci: membantu**

**Bahasa Melayu:** Memberikan pertolongan kepada seseorang untuk melakukan sesuatu.

**English:** To help someone do something.

**中文（华文）:** 帮助别人做某件事情。

**Contoh ayat:** Saya membantu ibu menyediakan sarapan di dapur.

The example has its own Salin button. [Structured fixture with provenance](KEMBANGKAN_AYAT_MEANING_FIXTURE.json).

## Verification and screenshots

- `npm test`: **222 passed**, **29 new tests**, all **193 baseline tests retained**.
- `node --test tests/expansion-situations.test.mjs`: **29 passed**.
- `npm run build`: **52 assets**, passed.
- `npm run check`: **132 JavaScript modules**, passed.
- `git diff --check`: passed.
- Extended headless Edge runner: **22 responsive mode/viewport checks**, source and production preview passed. Includes original keyword coverage, situation catalogue/filter/search/custom validation, offline selection, all six actions, copy isolation, clipboard failure, reload, stale requests, malformed responses, rate limits, TTS controls and navigation.

Run `npm run dev`, then `npm run test:expansion:browser`. For production, build and start the existing preview server, then pass its origin: `npm run test:expansion:browser -- http://localhost:4175`. The runner uses a temporary isolated Edge profile. `BM_TEST_BROWSER` can select a compatible Chromium executable. This environment required the headless renderer to run outside the restricted sandbox.

- [Before: previous iPad activity](../test-results/situations/before-ipad.png)
- [After: desktop with situation and meaning](../test-results/expansion/situation-desktop-builtin.png)
- [After: iPad portrait](../test-results/expansion/situation-ipad-portrait-builtin.png)
- [After: iPad landscape](../test-results/expansion/situation-ipad-landscape-custom.png)
- [After: Android portrait, custom situation](../test-results/expansion/situation-android-portrait-custom.png)
- [After: readable phone meaning card](../test-results/expansion/situation-phone-meaning-visible.png)
- [After: Android landscape viewport](../test-results/expansion/situation-android-landscape-builtin.png)
- [Browser results](../test-results/expansion/browser-results.json)
- [Regression log](../test-results/situation-regression.log)

Screenshots and logs are local, ignored artifacts under `test-results/`. Short landscape screenshots show the actual viewport because this Edge version repeated compositor tiles in full-page captures at very short viewport heights; page-wide DOM bounds were also checked.

## Exact modified or added files

1. `activities/sentence.js` — inserts the situation section between keyword and original sentence.
2. `components/ai-teacher.js` — shared inline/modal execution, expansion rendering and cancellation guards.
3. `components/ai-examples.js` — extracted existing example-card and copy-handler functions.
4. `components/expansion-ai.js` — expansion feedback and trilingual meaning rendering.
5. `components/expansion-keyword.js` — meaning trigger and inline result mount.
6. `components/expansion-situation.js` — compact situation modes, filters, selectors and preview.
7. `components/writing.js` — keeps meaning beside the keyword without duplicating it among the five existing actions.
8. `data/situations.js` — 100 stable situations in 10 categories.
9. `js/app.js` — situation interaction/autosave, complete AI context and result invalidation.
10. `js/expansion-situations.js` — catalogue filtering, custom validation, mode resolution, request and hydration boundaries.
11. `js/expansion-tutor.js` — schemas, shared prompts and response validation.
12. `js/storage.js` — expansion-only situation field hydration.
13. `js/tutor-actions.js` — new allowlisted action and validated situation context.
14. `server/gemini.js` — existing endpoint selects the appropriate schema; meaning action has a bounded 1,400-token output allowance.
15. `styles/app.css` — scoped situation controls, compact example cards and CJK meaning layout.
16. `tests/ai.test.mjs` — action-matrix count updated from 13 to 14; existing coverage retained.
17. `tests/gemini-routing.test.mjs` — new action traverses the mocked SDK with the correct schema and server model.
18. `tests/expansion-situations.test.mjs` — 29 focused tests.
19. `tests/fixtures/expansion-ai.mjs` — explicit mocked response/request fixtures.
20. `tools/check.mjs` — retains credential/SDK checks; permits intentional Chinese UI only in the new meaning renderer.
21. `tools/verify-expansion-browser.mjs` — extends existing browser checks and screenshots without dropping keyword coverage.
22. `audit/KEMBANGKAN_AYAT_SITUATION_AI.md` — this report.
23. `audit/KEMBANGKAN_AYAT_PROMPT_EXAMPLES.txt` — complete real-builder prompt samples.
24. `audit/KEMBANGKAN_AYAT_MEANING_FIXTURE.json` — representative meaning output with explicit mocked provenance.

No new dependency, public API endpoint, database schema or external dictionary service was introduced. Existing deployment-update notification tests passed unchanged.

## Known limitations

- No live Gemini calls were authorized or made. Translation quality, subtle word senses, grammatical naturalness and semantic relevance of future model outputs still require real-model evaluation. Relevance and same-sense checks are model self-assessments in the same response; they cannot mathematically guarantee meaning. Keyword inclusion and response structure are deterministic checks.
- Browser checks emulate viewport dimensions in desktop Edge; physical iPad/Android devices and Safari were not tested. Speech output and clipboard access were mocked, so audible playback and real device clipboard permissions were not exercised.
- External AI responses generated after copying a prompt cannot be validated inside this application.
- Existing original sentences remain protected immutable baselines. Changing context preserves and flags the original rather than rewriting it; use Draf baharu for a different original sentence.
- Offline situation selection works after modules load; this change does not introduce a new offline service worker or enable a first visit without connectivity.
