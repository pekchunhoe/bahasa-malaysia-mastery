# Gemini integration verification - 29 September 2026

## Audit and routing

Eight direct actions share one frontend request implementation and one server
SDK call. Before this change the endpoint was `/api/ai/tutor`; `/api/gemini`
did not exist. `server/gemini.js` used the installed `@google/genai` SDK's
`GoogleGenAI.interactions.create`. Its model selector used hard-coded defaults
and a separate advanced-model environment setting. No retry-based model
switching, duplicate SDK implementation or browser-to-Google request was found.

| Direct action | Existing activities |
| --- | --- |
| `sentence_hint` | Sentence, expansion, paragraph, guided essay, story |
| `sentence_check` | Sentence, expansion, story |
| `sentence_expand` | Sentence, expansion |
| `sentence_vivid` | Sentence, expansion, story |
| `vocabulary_help` | Sentence, expansion, paragraph, guided essay |
| `word_explanation` | Vocabulary bank and vocabulary support |
| `example_sentence` | Vocabulary bank and vocabulary support |
| `essay_next_step` | Guided essay |

All eight now use `js/ai-teacher.js` -> `/api/gemini` ->
`server/ai-handler.js` -> `server/gemini.js`. The old endpoint re-exports the
same handler for previously loaded clients. It has no separate model selection.
`paragraph_review`, `essay_review` and the manual Jana prompt / Salin prompt
buttons remain local prompt features. Practice spelling/dictation checks remain
local. No teaching prompt, UI label, activity, draft/storage implementation or
educational data was edited.

The server uses only `GEMINI_FAST_MODEL`, from `process.env` in production.
The production value supplied by the user is `gemini-3.5-flash-lite`; Vercel
environment values were not read or changed in this session. There is no
hard-coded production default, advanced model route or fallback list.
Missing/blank key or model returns HTTP 500 with a specific configuration
diagnostic plus a general Malay UI message. SDK retries remain disabled.
Authentication, quota, model/request rejection, network, timeout and malformed
feedback errors are controlled. Logs contain only controlled categories and
statuses, never raw SDK messages, headers, keys or student text. Upstream
400/404 errors are grouped as model/request errors; they do not prove that a
model identifier alone was the cause.

The existing SDK, response schema, output limits and Vercel deployment style
are preserved. The new route has the same 40-second function duration as the
legacy alias. Official references checked:
[Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js) and
[Gemini Interactions](https://ai.google.dev/api/interactions-api).

## Verification

| Check | Result |
| --- | --- |
| Direct paths found / migrated or verified | 8 / 8 (one SDK call site) |
| Frontend direct-to-Google paths remaining | 0 |
| Key and model configuration read only on server | PASS |
| All direct calls use the configured model | PASS |
| No fallback or hard-coded production model IDs | PASS |
| Browser source and built assets exclude credentials and SDK | PASS |
| Direct AI actions, response rendering and buttons | PASS with mocked upstream and DOM boundary |
| External prompt generation and clipboard behavior | PASS |
| Draft/autosave, writing activities and data loading | PASS, existing regression suite |
| Unicode, quotes/newlines, blank hints, empty checks, long text | PASS |
| Errors preserve writing and re-enable buttons | PASS |
| `npm test` | PASS: 119 tests, zero failures |
| `npm run build` | PASS: 40 static assets |
| `npm run check` | PASS: 97 source/built JavaScript modules plus asset isolation |
| `git diff --check` | PASS |

The routing tests exercise the real installed SDK with intercepted HTTP, not
just a mocked model selector. They assert the outbound model, unchanged full
prompt, authentication header, absence of the key from URLs/client requests,
JSON format, single attempt on failure, and redaction in responses/logs.
The deployment test checks both URLs through the actual local HTTP server.
The production build revalidated all 1,080 practice items and 1,000 essays.
The isolation checker now also scans `index.html` and actual `dist` assets.

The final repository search covered model IDs, both Gemini environment
variables, old model settings, Google endpoint strings, SDK classes,
`generateContent` and both endpoint URLs. Remaining model-ID literals occur
only in configuration examples/documentation. Obsolete model setting names
occur only in a negative test fixture proving they are ignored. Credential
references outside server modules are test fixtures, documentation, the empty
environment example, and security-check patterns. No secret values were added.

## Limits

No live Gemini request or Vercel deployment was performed. Account access to
the configured model remains unverified. Browser setup reported no available
browser, so visual interaction checks remain unverified; controller tests are
not presented as browser tests. No commit or push was made.
