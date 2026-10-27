# BAHASA MALAYSIA — KEMBANGKAN AYAT GENERAL AI & DETAIL-SPECIFIC AI SEPARATION STATUS

Implemented and validated locally on 27 October 2026. No commit, push or deployment. No live Gemini requests were made.

All 28 checks below PASS for implementation and local verification. Prompt assertions, authored linguistic fixtures and mocked AI responses do not prove the quality of future live Gemini output. This report supersedes the behavior described in the historical detail-aware enhancement report; that earlier report is retained as audit history.

| # | Requested check | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Six existing AI actions identified | PASS | The six action IDs and their unchanged labels/purposes are listed below. |
| 2 | All six independent of selected details | PASS | Frontend omits selections; shared client/server allowlist strips accidental detail fields; general prompt helper cannot use them. |
| 3 | All six remain situation-aware | PASS | Canonical built-in/custom situation resolution, context instructions and relevance assessment retained. |
| 4 | Exact keyword enforcement preserved | PASS | Existing Unicode-aware whole-word/phrase matching validates each example; synonym/substrings rejected. |
| 5 | Year-level adaptation preserved | PASS | Six distinct sentence styles; representative Tahun 1, 3, 4 and 6 scenarios tested in both modes. |
| 6 | Richer creative guidance implemented | PASS | Meaningful elaboration, varied openings/clause order, relevant sensory/emotional descriptions and action/consequence encouraged. |
| 7 | General examples no longer restricted by selections | PASS | All-selected and unselected general prompts are identical; no coverage instructions or selection states remain. Any natural descriptive technique is permitted. |
| 8 | General response invalidation corrected | PASS | All six in-flight and completed responses survive checkbox edits; writing/context edits still clear stale results. |
| 9 | New dedicated detail-AI button added | PASS | `sentence_expand_details`, visible label “Cikgu AI · Kembangkan Ikut Butiran”. |
| 10 | Button inside Tambah Butiran yang Bermakna | PASS | Named section contains all eight chips followed by the button, status feedback and inline result panel. |
| 11 | New button uses selected details | PASS | Sends selected IDs and eight canonical boolean states; all 256 states checked, including rejection of the empty state. |
| 12 | New button follows situation | PASS | Same canonical situation context, prompt constraints and per-example relevance validation. |
| 13 | New button preserves target keyword | PASS | Every example passes the existing exact keyword/phrase validator on client and server. |
| 14 | Three example sentences supported | PASS | Dedicated schema requires exactly three entries; validation rejects missing/extra entries and duplicate sentences. |
| 15 | Selected details incorporated appropriately | PASS | Dedicated instructions target every appropriate selection in each example; all-eight authored examples reviewed below. Semantic coverage is not mechanically certified. |
| 16 | Inappropriate details handled naturally | PASS | Dedicated prompt allows justified omissions, overlapping categories and simple subsets for young pupils; three-example washing-hands omission fixture tested. |
| 17 | New AI response invalidation correct | PASS | Separate detail identity adds checkbox states; cancellation/late-response suppression verified for checkbox, situation and writing edits; keyword/year changes clear activity results. |
| 18 | Individual Salin buttons preserved | PASS | Existing example cards and clipboard handlers reused; three independent copies, keyboard activation, Disalin feedback and no writing replacement checked. |
| 19 | Trilingual keyword meaning preserved | PASS | Existing BM/English/Mandarin definitions, same-meaning validation, one example and copy control retained. Dictionary examples remain concise. |
| 20 | Student drafts and autosave protected | PASS | Existing storage model/keys and draft hydration unchanged; controller and browser checks preserve original/expanded writing, selections and restored drafts. |
| 21 | TTS and navigation preserved | PASS | Complete speech/navigation regression suite plus browser TTS controls, draft reload and navigation checks. |
| 22 | External AI prompts consistent | PASS | Expansion-only copy prompts share pedagogical guidance, use human-readable context/output, strip selections for general actions and include them for the dedicated action. |
| 23 | Existing Gemini security preserved | PASS | Same endpoint, configured model, server-only SDK/credentials, origin/body/input/output limits, timeouts, rate limiter and error handling. Dedicated action tested through the real SDK with mocked upstream transport. |
| 24 | Responsive layouts | PASS | 32 source and 32 production-preview checks on desktop, iPad portrait/landscape and Android portrait/landscape; final production screenshots visually inspected. |
| 25 | Accessibility | PASS | Native keyboard controls, named detail section, associated live status, keyboard Salin activation, unique dedicated prompt IDs and visible 44px+ copy buttons checked. |
| 26 | Focused tests | PASS | 16 new tests: 11 dedicated separation tests and five real-controller tests, plus adapted existing regression coverage. |
| 27 | Full regression suite | PASS | 265 passed; 0 failed, skipped or cancelled. All 249 prior tests retained/adapted to the new requirements. |
| 28 | Production build | PASS | 52 static assets built; 136 JavaScript modules checked; `git diff --check` passed. |

## Actual six existing actions

| ID | Existing label | Responsibility retained |
| --- | --- | --- |
| `keyword_meaning` | Cikgu AI · Maksud Kata Kunci | Accurate BM, English and Mandarin meanings plus one situational Malay example. |
| `sentence_hint` | Beri saya petunjuk | One or two questions helping the pupil begin independently. |
| `sentence_check` | Semak ayat saya | Evaluate actual writing and distinguish errors from optional improvements. |
| `sentence_expand` | Bantu saya kembangkan ayat | Suggest useful elaboration and optional examples. |
| `sentence_vivid` | Jadikan ayat lebih menarik | Explain choices that make writing more interesting while retaining the pupil's ideas. |
| `vocabulary_help` | Cadangkan kata atau frasa | Suggest up to three suitable words/phrases, retaining the existing AI provenance guidance. |

The five general writing buttons remain in their existing group. The sixth remains beside the keyword. The seventh is excluded from that general group and appears only in the detail section.

## Root cause and separation

Before this change, `js/app.js` attached `expansionOptions` and `detailSelections` to every expansion action. `tutorRequest` validated and retained both fields for all six actions. `buildExpansionTutorPrompt` unconditionally called `expansionDetailInstructions`, whose instructions targeted selected categories, reviewed their semantic coverage, and compared pupil writing against those goals. Even keyword-meaning examples used a subset of selected goals. Server generation and external copied prompts used that same path. Soft word-count ranges further encouraged a common expansion pattern.

The previous stale-response identity also contained all eight states for every action. Consequently, any checkbox change cancelled requests and cleared general responses, including keyword meanings.

The correction is at those sources:

1. The frontend builds common keyword/situation/year/writing context for all actions and adds selection fields only for `sentence_expand_details`.
2. The shared `tutorRequest` boundary ignores accidental or legacy selection fields for general actions. They cannot reach Gemini, copied prompts or cache keys. The dedicated action validates its IDs/map and requires at least one selection.
3. `buildExpansionTutorPrompt` strips selection fields again for general callers. Its guarded detail helper returns no instructions unless the action is the dedicated action. Common creative/age guidance has no word-count ranges or fixed sentence-expansion formula.
4. General feedback evaluates actual grammar, clarity, relevance, quality and age suitability. It does not assess checkbox coverage. Definitions keep their original purpose and remain accurate and concise.
5. Two response lifecycles, `general` and `detail`, use separate identities and cleanup functions. Both include keyword, situation, year and relevant writing; only `detail` includes selection states. Both can coexist. A checkbox edit clears/cancels only detail-specific output, while relevant writing/context edits clear both. Existing abort/isCurrent guards suppress late responses.
6. The existing response schema/card/copy path is reused, with a dedicated schema requiring exactly three examples. Validation additionally rejects duplicates and checks every sentence's keyword, complete-sentence structure, plain text and relevance assessment. No speculative regex claims to establish semantic detail coverage.

No storage migration, new provider, endpoint, runtime dependency or credential exposure was introduced. The removed non-AI writing-check button remains absent from this activity. Other activities retain their existing checker and prompt behavior.

## Actual generated prompt evidence

[Full actual prompt-builder output](KEMBANGKAN_AYAT_AI_SEPARATION_PROMPTS.txt) contains all six general server prompts, the dedicated server prompt and both representative external copy prompts. They were generated using the real builders with **all eight selections active**, Tahun 4, keyword **membantu**, situation **Membantu ibu menyediakan sarapan.**, original **Saya membantu ibu.**, and current writing **Saya membantu ibu menyediakan sarapan.**

For each general action, both server and external prompts were asserted byte-for-byte equal to those generated with **no selections**. General requests have neither `expansionOptions` nor `detailSelections` after normalization. Accidental malformed detail fields are also stripped rather than influencing general guidance.

Actual general `sentence_expand` prompt excerpts:

> PANDUAN CONTOH TAHUN 4: Kembangkan penerangan dengan kosa kata deskriptif yang mudah difahami serta hubungan idea yang lebih pelbagai. Kesesuaian umur lebih penting daripada panjang ayat. Tiada bilangan perkataan minimum, maksimum atau julat sasaran.

> Pilih teknik penulisan secara bebas mengikut situasi: latar, masa, cara, sebab, perasaan, penerangan, kata adjektif atau kata hubung boleh digunakan apabila semula jadi. Tiada senarai kategori wajib atau templat pengembangan. Nilai tatabahasa, kejelasan, kaitan situasi, mutu ayat dan kesesuaian umur berdasarkan tulisan sebenar; jangan menegur ketiadaan kategori huraian tertentu.

Actual dedicated prompt excerpt using the **same selections and context**:

> MATLAMAT BUTIRAN DIPILIH (8): tempat · masa · cara · sebab · perasaan · penerangan · kata adjektif · kata hubung. Ini niat pengembangan murid, bukan formula wajib. Dalam setiap contoh, usahakan semua butiran yang relevan selagi ayat jelas dan semula jadi. Jangan abaikan butiran relevan semata-mata kerana ayat pendek lebih mudah dijana.

> Beri tepat TIGA contoh ayat yang dikembangkan. Ketiga-tiganya mesti berbeza secara bermakna dari segi pembukaan, susunan idea atau gambaran; bukan menukar satu perkataan sahaja.

The full dedicated prompt includes each selected category's guidance, semantic review, overlap/omission guidance and all eight boolean states. **General prompts are not constrained by checkboxes; the dedicated prompt is explicitly guided by them.** These are generated prompts, not live model responses.

## Before/after teaching fixtures

The following are authored, locally reviewed fixtures in [expansion-separation.mjs](../tests/fixtures/expansion-separation.mjs). “Before” represents the overly basic pattern; “after” demonstrates intended writing quality. None is represented as captured Gemini output or hardcoded into runtime generation.

All use keyword **membantu** and situation **Membantu ibu menyediakan sarapan.**

| Year | Before | After |
| --- | --- | --- |
| Tahun 1 | Saya membantu ibu di dapur. | Saya membantu ibu menyediakan roti yang sedap untuk sarapan keluarga. |
| Tahun 4 | Saya membantu ibu di dapur. | Harum roti bakar memenuhi dapur ketika saya membantu ibu menyediakan sarapan yang menyelerakan untuk keluarga. |
| Tahun 6 | Saya membantu ibu di dapur. | Walaupun masih mengantuk, saya tetap membantu ibu menyediakan sarapan yang berkhasiat kerana kerja bersama itu meringankan tugasnya dan memberi kami peluang berbual sebelum memulakan kegiatan harian. |

The younger example uses familiar words and a clear central action. The middle example demonstrates a relevant sensory opening. The older example uses a circumstance, motivation and consequence in an accessible clause sequence. These demonstrate variety without a required detail list or fixed length.

## Three representative dedicated examples

The same keyword/situation, Tahun 4 and all eight selections are used in the dedicated response fixture:

1. Pada pagi Ahad, saya berasa gembira dapat membantu ibu menyediakan sarapan yang berkhasiat untuk keluarga di dapur dengan teliti kerana saya ingin meringankan tugasnya.
2. Dengan berhati-hati, saya membantu ibu menyediakan sarapan yang lazat untuk keluarga di dapur pada pagi Ahad kerana tugas bersama itu membuat saya berasa bangga.
3. Saya berasa bangga apabila membantu ibu menyediakan sarapan yang menyelerakan untuk keluarga di dapur pada pagi Ahad dengan cermat kerana saya dapat meringankan tugasnya.

Each contains the exact keyword, breakfast context, morning time, kitchen location, a manner of working, a reason, an appropriate feeling, a food quality, explanatory family context and a grammatical conjunction. The openings differ: setting, manner and emotion. A single `kerana` connection can satisfy reason and conjunction without duplicate clauses. The browser copies each exact sentence independently without inserting it into the pupil's draft.

For an inappropriate emotion in a Tahun 1 custom hand-washing situation, the dedicated fixture instead gives three clear hygiene examples, including **Sebelum makan, saya mencuci tangan di sinki dengan sabun supaya bersih.** It explains: **Perasaan tidak ditambah supaya langkah kekal jelas tanpa mereka emosi.** No unverified coverage badge is displayed.

## Validation and artifacts

- `npm test`: **265/265 passed**. The prior 249 tests remain; obsolete expectations that all general actions receive selections were updated to verify the requested separation. Eleven new dedicated tests and five new real-controller tests were added.
- Focused coverage includes all 256 selection states, all six general actions across all six years, built-in/custom context modes, malformed/contradictory detail input, empty selection without a request, three validated examples, exact multiword keywords, copied prompt formatting, API errors, cache identity, stale responses and concurrent independent panels.
- The real SDK routing test exercises **13 direct actions** against mocked transport, including the new dedicated response schema and unchanged configured-model/output-budget routing.
- Browser source run: **32 responsive checks passed**. Final production preview: **32 responsive checks passed**, including all prior 27 checks and five new dedicated-panel viewport checks. The final phone layout puts the copy button below the sentence to keep text readable.
- `npm run build`: **52 assets**, build **bmMastery-5946653cb463**.
- `npm run check`: **136 JavaScript modules** passed syntax, source, browser-secret/SDK separation and language checks.
- `git diff --check`: passed.

Local ignored evidence:

- [Full regression log](../test-results/separation-regression.log)
- [Source browser log](../test-results/separation-browser-source.log)
- [Production browser log](../test-results/separation-browser-production.log)
- [Final browser results](../test-results/expansion/browser-results.json)
- [Dedicated Android portrait](../test-results/expansion/dedicated-android-portrait.png)
- [Dedicated Android landscape](../test-results/expansion/dedicated-android-landscape.png)
- [Dedicated iPad portrait](../test-results/expansion/dedicated-ipad-portrait.png)
- [Dedicated desktop](../test-results/expansion/dedicated-desktop.png)

The restricted execution environment initially prevented browser renderer startup. Running the isolated local headless Edge checks outside that process sandbox resolved startup. The final runs use a temporary test profile, not a pupil's browser profile. Browser AI, clipboard and speech responses are mocked.

## Exact modified and added files

| File | Change |
| --- | --- |
| `activities/sentence.js` | Named detail section; dedicated button/live feedback/inline result mount after chips. |
| `components/ai-teacher.js` | Reused inline teacher panel for dedicated output, unique prompt control IDs, per-panel duplicate-request guard. |
| `components/expansion-ai.js` | Dedicated result heading; existing example cards reused. |
| `components/writing.js` | Excludes dedicated action from general action group. |
| `js/app.js` | Action-specific request context, empty-selection feedback and independent general/detail request lifecycles. |
| `js/expansion-tutor.js` | Creative/year guidance without word ranges, guarded detail instructions, dedicated schema/validation and human-readable external expansion prompts. |
| `js/tutor-actions.js` | New allowlisted action; server/client selection boundary; external expansion prompt routing. |
| `server/gemini.js` | Dedicated schema selection on the existing Gemini route. |
| `styles/app.css` | Detail-section spacing and wider phone example text with copy buttons below. |
| `tests/ai.test.mjs` | Fifteen-action shared contract regression. |
| `tests/essay-external-prompts.test.mjs` | Retains unrelated prompt contracts; verifies expansion's new human-readable external format. |
| `tests/expansion-details.test.mjs` | Adapts prior detail coverage to dedicated mode and verifies six-action independence. |
| `tests/expansion-situations.test.mjs` | Seven-action situation/copy regressions, preserving legacy catalogs and meaning tests. |
| `tests/expansion.test.mjs` | Correct action-specific detail propagation and keyword regressions. |
| `tests/gemini-routing.test.mjs` | Dedicated action through real SDK with mocked transport and dedicated schema. |
| `tests/phase3-controller.test.mjs` | Updated prior behavior tests plus five new independent-lifecycle/controller/copy checks. |
| `tests/expansion-separation.test.mjs` | Eleven focused dedicated/separation/security/year/omission tests. |
| `tests/fixtures/expansion-separation.mjs` | Authored creative year examples and three dedicated examples. |
| `tools/verify-expansion-browser.mjs` | Preserves prior browser checks, adapts old selection assertions and adds dedicated workflow/viewport checks. |
| `audit/KEMBANGKAN_AYAT_AI_SEPARATION_PROMPTS.txt` | Actual seven server prompts and two external prompts with selection-independence assertions. |
| `audit/KEMBANGKAN_AYAT_AI_SEPARATION.md` | This report. |

## Remaining limitations

Live Gemini creativity, grammar, semantic detail coverage and trilingual translation accuracy were not tested. Local validation proves structure, exact keywords and contextual assessment fields; relevance remains the existing same-generation model assessment. Meaningfully different phrasing and appropriate detail coverage are prompted, with exact duplicate detection as an additional deterministic guard. They are not independently certified by a second model or a linguistic classifier.

The existing security/output budgets remain bounded; no new word-count restrictions, truncation or automatic rewriting was added. A malformed, incomplete or oversized response receives the existing safe retry/prompt fallback.

Responsive checks use Edge viewport emulation. Physical iPads/Android devices, Safari, screen readers, audible speech and device clipboard permissions were not tested. External AI responses after copying prompts cannot be validated by this application. The existing protected original-sentence baseline and draft behavior are retained.
