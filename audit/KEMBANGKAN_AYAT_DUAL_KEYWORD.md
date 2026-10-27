# BAHASA MALAYSIA — KEMBANGKAN AYAT DUAL KEYWORD MODE STATUS

Validated locally on 27 October 2026. No commit, push or deployment was performed.

| Requested check | Status | Evidence |
| --- | --- | --- |
| Kata keterangan replaced by kata hubung | PASS | Eight canonical choices; source prompt list updated. |
| Kata hubung underlying logic corrected | PASS | `kata_hubung` identifier, distinct clause/idea guidance, eight suitable conjunctions, selected guidance sent to AI. |
| Built-in keyword mode | PASS | Searchable year-specific vocabulary dropdown, unit filter, stable source IDs. |
| Custom keyword mode | PASS | Explicit activation, trimming, Unicode letters, spaces, hyphens, apostrophes and commas; 80-character/8-word limit. |
| Mode switching | PASS | Native exclusive radios; conditional inputs; both mode values retained in each draft; hidden mode never supplies the target. |
| Keyword highlighted | PASS | Focus word/phrase displayed prominently and allowed to wrap. |
| Keyword enforced in sentence examples | PASS | Original start requires the whole keyword; expanded writing has live feedback; source and AI examples validated. |
| Existing expansion functionality | PASS | One original-to-expanded workflow, original baseline, details, local writing check, editor and teacher actions retained. |
| AI Teacher keyword awareness | PASS | All five existing actions receive mode, exact keyword, year, original, current writing, selected details and existing context. |
| AI suggestions validated | PASS | Examples missing the keyword are rejected on server and client; no automatic retry; existing retry/prompt controls remain. |
| Draft persistence | PASS | Existing `bmMastery:state:v1`, draft `fields`, item IDs and active draft keys reused. |
| Legacy draft compatibility | PASS | Old plans migrate safely; legacy original, expanded writing, fields and revisions retained. |
| Autosave protection | PASS | Inputs save immediately; invalid/missing keywords never discard writing; keyword/mode changes never write replacement sentences. |
| TTS preserved | PASS | Existing speech regression suite and browser checks for read/pause/resume/stop/speed; browser speech output mocked. |
| iPad portrait layout | PASS | Headless Edge viewports 768×1024 and 820×1180, both modes; no horizontal page overflow or clipped controls. |
| Mobile responsive layout | PASS | 360×800 and 412×915; stacked controls, 48px detail chips, long keyword wrap; navigation preserved. |
| Accessibility | PASS | Labels, native radio arrow keys, Tab navigation, Enter activation, visible focus, live feedback and checkbox descriptions tested. |
| Focused tests | PASS | 11 new automated tests plus browser workflow/security/keyboard/persistence checks. |
| Full regression suite | PASS | 193 tests passed; 0 failed, skipped or cancelled. |
| Production build | PASS | 46 assets; production preview also passed the browser checks. |

## Architecture findings

The application is a vanilla JavaScript module application. Kembangkan Ayat shares the sentence activity module and the existing editor/teacher components. Built-in workbook prompts already have stable item IDs, and drafts are isolated by year/activity/item. Original sentences become immutable baselines; expanded text remains editable and autosaves through the existing store.

Previously, expansion detail selections were labels saved in `draft.plan`, with no distinct local explanations and no propagation into the tutor request allowlist. The activity also displayed general year-profile questions that could concern essay conclusions. The change supplies activity-specific detail guidance and routes only validated expansion context through the existing shared tutor contract. Other activities keep their existing rendering and response formats.

The existing Gemini server handler already normalizes responses using the shared tutor module. Adding keyword validation there protects both server responses and frontend display without modifying credentials, routing, SDK configuration or response schemas. Invalid examples use the established error/retry/prompt flow; no automatic retry or additional AI action was added.

## Vocabulary source

The selector reuses `getCurriculumPack(year).vocabulary` from `js/curriculum-service.js`. Tahun 1–3 use reviewed workbook ejaan words; Tahun 4–6 use the approved focus words/short phrases attached to imlak items by the existing enrichment layer. This ultimately comes from `data/generated/master.js` and the existing workbook enrichment resources, not a new word list. Suitable short phrases are selected by the common keyword validation rule. No vocabulary records or unrelated activities were altered.

Selecting a built-in item follows the existing per-item draft behavior: its saved draft opens, and the previous draft remains accessible through Draf Saya. The interface states this beside the selector. Switching between built-in and custom mode within a draft preserves its writing and each mode's saved value. An edited custom input takes effect only after activation, so incomplete typing never silently changes the active target.

## Legacy handling and matching

Storage version and key remain unchanged. On hydration of expansion drafts only, `plan.kata_keterangan = "yes"` becomes `plan.kata_hubung = "yes"` unless an explicit new conjunction selection/deselection already exists. The old key is removed; all other plan choices and pupil writing remain. Drafts predating the selector default to built-in mode and resolve their original item ID to its existing vocabulary entry. An unavailable source ID is not guessed; writing remains intact and the interface asks for a keyword.

Mode, custom active keyword, pending custom input and explicit built-in selection use existing string-valued draft fields. Built-in keywords resolve from stable source IDs. The store also verifies year/activity before reusing an active draft. No database schema or second persistence mechanism was introduced.

Keyword checks are case-insensitive, normalize Unicode and whitespace, retain hyphenated spelling, normalize apostrophe glyphs, and require whole-word boundaries. Full phrases can tolerate intervening whitespace, commas and quotation marks; they cannot be satisfied by unrelated substrings, inserted words, reversed words or separate sentences. Text is never silently inflected, replaced or rewritten. Expanded writing continues to autosave even when the keyword is missing, with gentle feedback so the pupil can revise it.

## Verification and screenshots

- `npm test`: **193 passed**, including **11 new focused tests**.
- `npm run build`: **PASS**, 46 assets.
- `npm run check`: **PASS**, 118 JavaScript modules plus whitespace, conflict-marker and browser-asset credential checks.
- `git diff --check`: **PASS**.
- `npm run test:expansion:browser`: source application **PASS**.
- `npm run test:expansion:browser -- http://localhost:4175`: production preview **PASS**.
- Headless Edge 156: **12 mode/viewport combinations** across six viewport sizes, including iPad landscape 1024×768 and desktop 1440×900. No page overflow, clipped activity controls or runtime exceptions. Also checked long keywords, failed activation, malicious input, original validation, expanded feedback, both mode values, reload, all five teacher actions, external prompts, navigation and speech controls.

Run a local dev server with `npm run dev` before the browser command. For production preview, build first, run `node tools/serve.mjs --dist` on the chosen local port, and pass that origin. The browser runner uses an isolated temporary Edge profile and mock AI/speech responses. `BM_TEST_BROWSER` can select another compatible Chromium executable. On this machine, Edge renderers required execution outside the restricted sandbox.

Before: the screenshot supplied with the request. After:

- [Desktop, built-in mode](../test-results/expansion/desktop-builtin.png)
- [Desktop, custom mode](../test-results/expansion/desktop-custom.png)
- [iPad portrait](../test-results/expansion/ipad-portrait-builtin.png)
- [iPad landscape](../test-results/expansion/ipad-landscape-custom.png)
- [Phone, custom mode](../test-results/expansion/android-phone-custom.png)
- [Phone, long keyword](../test-results/expansion/phone-long-keyword.png)
- [Machine-readable browser results](../test-results/expansion/browser-results.json)
- [Full regression output](../test-results/regression.log)

Screenshots and logs are local verification artifacts under the existing ignored `test-results/` directory.

## Exact files changed

1. `activities/sentence.js` — expansion layout, keyword card, detail guidance and keyword feedback.
2. `components/expansion-keyword.js` — new conditional mode/keyword controls and checked source examples.
3. `data/demo/content.js` — final expansion option changed to kata hubung.
4. `js/app.js` — keyword input/activation, switching, original validation, live feedback and AI context.
5. `js/expansion.js` — shared keyword rules, vocabulary selection, detail definitions and legacy-plan migration.
6. `js/state.js` — verify active draft year/activity before reuse.
7. `js/storage.js` — expansion-only hydration/defaults and safe legacy selection migration.
8. `js/tutor-actions.js` — allowlisted expansion context, AI instructions and example validation.
9. `package.json` — local browser verification command; no new dependency.
10. `styles/app.css` — scoped responsive expansion controls, touch targets and focus styles.
11. `tests/ai.test.mjs` — existing action matrix fixture supplies expansion keyword context.
12. `tests/essay-external-prompts.test.mjs` — existing non-essay matrix fixture supplies expansion keyword context.
13. `tests/expansion.test.mjs` — 11 focused tests.
14. `tests/phase3-controller.test.mjs` — existing original-sentence fixture uses its actual focus keyword.
15. `tools/verify-expansion-browser.mjs` — isolated headless Edge workflow, keyboard, layout checks and screenshots.
16. `audit/KEMBANGKAN_AYAT_DUAL_KEYWORD.md` — this report.

## Remaining limitations

- Responsive checks emulate viewport sizes in desktop Edge. Physical iPad/Android devices and Safari were not tested.
- Browser AI responses and speech output were mocked; live Gemini generation and audible device playback were not exercised. Existing server/SDK/error-handling and speech regression tests passed.
- Deterministic keyword inclusion establishes spelling and phrase presence, not linguistic meaning. The interface asks pupils to check meaning; the AI prompt requires natural, age-appropriate use and preservation of the pupil's meaning.
- Existing locked original sentences remain immutable to protect the baseline. If a new keyword needs a different original sentence, start Draf baharu; the earlier draft remains in Draf Saya. Existing original sentences missing a newly chosen target are retained and flagged rather than rewritten.
- External AI copy-prompts carry the same keyword instructions, but responses generated outside the application cannot be programmatically validated here.
