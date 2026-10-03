# Natural Dengar tulisan: implementation and verification

3 October 2026. No commit, push, deployment or external TTS provider added.

## Audit before changes

`js/speech-service.js` was already the single Web Speech API owner, using `SpeechSynthesisUtterance` and sequential onend callbacks. It did not read every essay as one utterance. `js/app.js` routed all speech through `read()` and maintained a current-sentence status, with stop handling for activity/year/title/item changes, pagehide and the explicit hide-example button.

| Source/control | Existing path, retained |
| --- | --- |
| Pupil Dengar tulisan | `components/writing.js` → `data-read-writing` → `draftText(draft)`. For essays this is the saved combined pupil paragraphs; input events save synchronously. Stories include preceding pupil lines and the current continuation. |
| Contoh Karangan Dengar tulisan | `components/essay-catalog.js` → `data-read-example` → active content-ID check → `topic.model_text` only. Heading, title, year, category, metadata and button labels are excluded. |
| Words, phrases and short examples | `activities/vocabulary.js`, `activities/sentence.js`, `components/content.js`, `components/enrichment.js` → `data-speak` → the same shared service. |
| Practice Dengar / ulang | `activities/practice.js` → selected source item's text → the same shared service. Replay restarts from the beginning. |
| Speed | `components/writing.js` supplies 0.75/1/1.25 as Perlahan/Biasa/Laju. `bmMastery:speechRate` stores the chosen multiplier. Changes apply to the next utterance, without restarting the current one. |
| Pause/resume/stop | `data-speech` calls the shared service; app status callbacks enable the controls. Cancellation invalidates old callbacks. |
| Status | `read()` displays `Sedang dibaca:` and current text; completion/error/navigation clears it. There is no word-level highlighting to preserve. |

Code-level contributors to mechanical phrasing:

- Voice selection took the first exact Malay voice in browser enumeration order, without quality hints or deterministic tie-breaking. It queried again for each sentence, so late loading could change the voice midway through a passage.
- There was no voiceschanged listener. Empty initial enumeration could fall back to the browser's language choice without subsequently discovering a better voice until another sentence was queued.
- Speech reused the writing-count regex in `learning-service.js`. It discarded paragraph structure, split titles such as `Dr.`, separated closing quotation marks from their sentence, and could skip an unpunctuated line before a newline. Commas, questions and exclamations were not universally stripped; punctuation handling was incomplete rather than absent.
- Every sentence had the same transition behaviour, including paragraph boundaries. Rate defaulted to 1; pitch and volume were implicit defaults. Pitch alone is not the cause of flat speech: much of prosody is supplied by the installed voice.
- The explicit hide-example button stopped reading, but native disclosure collapse did not. A full render could also detach a reading status while speech continued.

These are findings from code, not an acoustic diagnosis of the user's device. No original or updated voice could be listened to in this session.

## Shared pipeline improvements

Voice ranking is deterministic: exact `ms-MY`, then other `ms` locales, then clearly Malay-labelled voices only when language metadata is absent/undetermined. Explicit unrelated languages, including Malayalam, are not selected as Malay. Within a locale tier, Natural/Neural name hints rank above Enhanced/Premium hints; local service and browser default are tie-breakers, followed by stable language/name/URI ordering. There is no Windows-only voice name dependency. Quality words are heuristics, not proof of a particular synthesis engine.

One voiceschanged listener is attached for the service lifetime, with a legacy property fallback and a disposal method that removes/restores it. Voices are refreshed when discovery changes and before playback. Each passage snapshots its chosen voice. If enumeration is initially empty, playback starts in the user's gesture with `lang: ms-MY` and no forced English voice; later discovery improves the next playback, without restarting or switching the active passage. This avoids depending on deferred speech initiation being allowed on mobile browsers.

The new speech-only `speechUnits()` helper preserves punctuation, quotations, apostrophes, hyphens, capitalization and Unicode. It normalizes whitespace only in the speech copy, keeps decimal numbers/common abbreviations/initials together, retains quoted dialogue with a lowercase attribution, and records blank-line paragraph boundaries. Commas, semicolons and colons remain within their sentence for the engine to phrase naturally. Single line wraps become spaces. The original text and writing-count helper are unchanged.

Configuration:

| Control | Stored multiplier | Actual utterance rate |
| --- | --- | --- |
| Perlahan | 0.75 | 0.7125 |
| Biasa | 1 | 0.95 |
| Laju | 1.25 | 1.1875 |

Pitch stays at 1 and volume at 1 for all utterances, including questions and exclamations. The 0.95 base rate is a conservative comprehension-oriented adjustment, not a measured optimum for every platform voice. There is no random pitch modulation, SSML or new audio backend.

Ordinary sentences continue directly through onend. A paragraph boundary adds only 180 ms after the engine finishes, with no trailing delay at the passage end. The single pending gap timer belongs to the active session: pause freezes its remaining duration, resume continues it, and stop/replay/error/dispose clears it. Pausing as an end event arrives never launches the next sentence until resume. Starting a new reading resumes a synthesis engine left paused by cancellation. Stale end/error callbacks cannot affect newer utterances.

App integration retains current-sentence status and now labels paused reading `Dijeda:`. Native example collapse and any full app render stop reading before its UI is detached. Existing year/title/navigation/pagehide cleanup and text-source checks remain in place. Speech makes no editor assignments, input events or draft writes; only the existing speed-preference key is persisted.

## Compatibility basis and limits

The [Web Speech specification](https://webaudio.github.io/web-speech-api/) defines voice availability as browser-dependent, rates relative to the selected voice, and cancellation as leaving the global paused state unchanged. Those behaviours inform discovery, conservative rates and replay handling. [Voice localService metadata](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService) identifies local versus remote service, not objective voice quality.

The implementation uses the existing browser API on Windows Chrome/Edge, macOS Chrome/Safari and Android Chrome rather than a platform-specific engine. Automated fixtures exercise missing voices, empty/late enumeration, legacy event handling, failures, pause/resume and sequencing. Actual browser/OS compatibility and perceived naturalness still require device checks. Unsupported/missing-voice failures clear playback state and retain existing UI fallback messaging.

Browser TTS cannot add neural or emotional prosody to a voice that does not provide it. Preserving `?`, `!`, commas and coherent sentences lets a capable voice apply its native phrasing; it does not guarantee a particular question contour or expressive delivery.

## Tests and build

- Focused command: `node --test tests/speech-natural.test.mjs tests/speech-render.test.mjs tests/phase3-controller.test.mjs` — 46 passed.
- `npm test` — 182 passed, 0 failed.
- `npm run build` — 44 static assets, `bmMastery-519140c0aba9`.
- `npm run check` and `git diff --check` — passed.
- No dedicated browser/TTS test runner exists in this BM repository. Browser runtime selection returned “No browser is available”; documented discovery returned an empty list.

Coverage added: locale/quality ranking and stable ties; async discovery and one listener; voice snapshotting; punctuation/Unicode/abbreviation and paragraph integrity; conservative rate with unchanged stored controls; pause/resume inside a paragraph gap and at utterance boundaries; replay while paused; stale callbacks and exceptions; native collapse and detached-view cleanup; correct model content; pupil draft, autosave, essay identity/filter protection.

Files changed: `js/speech-service.js`, new `js/speech-text.js`, `js/app.js`, new `tests/speech-natural.test.mjs`, `tests/speech-render.test.mjs`, `tests/phase3-controller.test.mjs`, and this report.

## Manual listening check — pending, not performed

No audible quality result is claimed. Run the following checks in the production preview on Windows Chrome/Edge, macOS Safari/Chrome and Android Chrome. Record OS/browser version, chosen voice name/language, whether it is local, and the selected speed. Start at Biasa; compare Perlahan and Laju without expecting pitch to change.

| Passage | Listen for | Result |
| --- | --- | --- |
| Pada hari Ahad yang lalu, saya dan keluarga pergi berkelah di tepi pantai. | Calm statement, comfortable rate and Malay pronunciation | NOT LISTENED |
| Selepas tiba di sana, kami mengeluarkan makanan, minuman dan tikar dari kereta. | Natural comma phrasing without separate choppy utterances | NOT LISTENED |
| Adakah kamu mahu bermain bola bersama-sama? | Native question intonation; hyphenated word intact | NOT LISTENED |
| Wah, cantiknya pemandangan di sini! | Appropriate native exclamation, no artificial pitch jump | NOT LISTENED |
| Pada waktu petang, kami bermain bola di tepi pantai. Adik membina istana pasir manakala ibu menyediakan makanan. Selepas itu, kami duduk bersama-sama sambil menikmati pemandangan matahari terbenam. | Smooth sentence transitions, non-monotone phrasing where supported | NOT LISTENED |

Also combine those passages with blank lines, pause during a paragraph transition, resume, stop, replay, change essay, collapse the model example and navigate away. Check that the pause is modest, no ghost speech remains, current text is accurate, and draft content is unchanged. Auditory results, real keyboard/platform controls and responsive device use remain unverified until a browser/listening environment is available.
