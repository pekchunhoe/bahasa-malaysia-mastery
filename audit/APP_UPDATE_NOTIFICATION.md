# Bahasa Malaysia app update notification

Verified on 3 October 2026. No commit, push or deployment performed.

## Mandarin reference audited before implementation

Reference project: `D:/Primary school simulation/mandarine-mastery` (the active project, not its sibling copy).

| Reference file | Mechanism |
| --- | --- |
| `js/deployment-version.js` | A build-injected identifier is compared with `version.json` fetched with `cache: no-store`. Checks run at startup, every five minutes, on focus/online, on visible pageshow/visibilitychange, and on service-worker controllerchange. A closure flag prevents ordinary repeat announcements; stop removes listeners and the interval. Source development is inactive because its build placeholder is unchanged. |
| `tools/build.mjs` | Hashes shipped content with SHA-256, uses a 12-character content hash in the release/cache ID, injects it into the watcher, writes `version.json`, and generates the service-worker asset list and cache name. No release timestamp is needed. |
| `js/app.js` | `showDeploymentUpdate` creates one persistent section outside the activity root, with an alert and native reload button. A second flag prevents duplicate notices. Only the button invokes `window.location.reload()`. No dismissal or automatic reload. Startup registers the service worker and calls registration.update(). |
| `styles/components.css` | Fixed notice near the bottom, safe-area offsets, 620px maximum width, rounded border, flex layout and shadow. |
| `sw.js` | Install precaches assets then calls skipWaiting; activate deletes older application caches and calls clients.claim. GET requests use network first, cached fallback on failure. API, cross-origin and no-store requests bypass this handler. Worker activation can cause controllerchange, which checks metadata rather than reloading. There is no waiting-worker message handshake or updatefound listener to port. |
| `vercel.json` | Version metadata is no-store. HTML/modules/styles/data revalidate. The worker script also has no-store. |
| `tests/essay-production-browser.mjs` | Production browser coverage verifies worker caches, offline draft restoration and a simulated changed version response. The update scenario blocks service workers for reliable interception, focuses the tab, checks the notice and draft, and clicks reload. This test simulates a release; it does not deploy one. |

## BM implementation and deliberate differences

BM already had the same content-hash build system and nearly identical watcher. This change retains that single mechanism and five-minute/event timing. BM has no service worker or PWA cache; the unused controllerchange listener was removed, and no worker or second version system was added. Existing Vercel/build configuration is unchanged.

The old BM banner was inside the rerendered page and could scroll offscreen. The notice now follows Mandarin's independent, persistent fixed section, using BM's soft-red tokens and the requested Malay wording:

> Versi baharu tersedia
>
> Aplikasi telah dikemas kini. Muat semula untuk menggunakan versi terkini.
>
> Muat semula

The native button has a descriptive accessible label, uses existing visible focus styles, and is at least 44px tall. A polite atomic status region replaces Mandarin's assertive alert to avoid interrupting pupil typing. No focus is moved. Wrapping, safe-area spacing and additional page-bottom space keep the final controls scrollable above the notice. There is no dismissal timer or dismiss button.

Watcher safeguards added to satisfy the requested duplicate/failure guarantees:

- Simultaneous focus, visibility and polling events share one pending request.
- After asynchronous parsing, stopped/announced/aborted state is checked again.
- Only the existing BM build format `bmMastery-<12 lowercase hexadecimal characters>` can announce an update; bad JSON, wrong-app identifiers and failed responses are ignored.
- Checks have a 15-second abort timeout; stop also aborts pending work. Failures remain quiet and later events can retry.

Like Mandarin, content hashes are compared for inequality, not ordered as timestamps. A deployment or rollback with different content is a changed active release; identical source rebuilds keep the same ID and do not announce an update.

## Exact notification and reload flow

1. App initialization installs one watcher and one notice callback, outside render/navigation.
2. A successful check confirms a different valid deployment hash. The watcher announces once. The UI callback independently guards against duplicate insertion.
3. The notice is appended to body. No app rerender, editor assignment, storage write, selection/year/title change, speech call or AI mutation occurs.
4. Normal pupil input and synchronous autosave continue. The notice survives route changes because it is outside `#app`.
5. Only the native button click attempts BM's existing `store.persist()` operation. A failure shows the existing temporary-storage warning, keeps the button retryable and prevents reload.
6. On successful save, a guard is set, the button is disabled and `window.location.reload()` is called once. Repeated activation cannot trigger another reload.
7. Existing no-cache/must-revalidate headers revalidate HTML and modules; version metadata remains no-store. The newly loaded build's matching hash produces no further notice. No cache clearing, query-string cache busting, worker activation or automatic retry/reload loop is involved.

## Files changed

- `js/deployment-version.js`: retain the reference detector, add concurrent-request/response guards, timeout, format validation and safe cancellation; omit unused service-worker listener.
- `components/deployment-update.js`: reusable persistent notice and guarded voluntary reload.
- `js/app.js`: initialize that notice once; remove the old render-time banner, delegated reload handler and old banner-button status hook.
- `styles/app.css`: adapt Mandarin's fixed notice to BM tokens, wrapping, touch targets and content clearance.
- `tests/deployment.test.mjs`: extend focused detection, lifecycle, UI, reload and saved-state regressions.
- `tests/deployment-production.mjs`: explicit post-build content-hash and actual HTTP asset/cache verification.
- This audit report.

The save guard still prevents losing unsaved work. Unlike the old disabled banner button, the new button can retry a failed persistence attempt after storage becomes available; it never reloads while saving still fails.

## Verification results

| Command/check | Result |
| --- | --- |
| `node --test tests/deployment.test.mjs tests/phase3-controller.test.mjs` | PASS: 39 tests, 0 failures |
| `npm test` | PASS: 173 tests, 0 failures |
| `npm run build` | PASS: 43 static assets, `bmMastery-6eaffeeb90fe` |
| A second production build with identical sources | PASS: same identifier |
| `node --test tests/deployment-production.mjs` | PASS: 2 tests, 0 failures |
| `npm run check` | PASS |
| `git diff --check` | PASS |

Focused tests cover current/new versions, concurrent events, repeated checks, invalid/offline/failed requests, timeout recovery, periodic and visibility/focus checks, stop/cancellation, development inactivity, no automatic reload, one deliberate reload, failed-save recovery, notice semantics, unchanged pupil state/caret/AI, continued autosave and restored year/title/paragraphs. Full regressions cover navigation, catalog filtering and IDs, examples, other writing activities, AI actions and speech controllers.

The production checks recompute the shipped content hash (reversing only the injected placeholder), validate metadata/module consistency and Vercel headers, and serve/read the actual production HTML, modules, stylesheet and version endpoint. No timestamps or localhost-only detection condition were added.

## Browser-only verification outstanding

The browser runtime initialized, but URL selection returned “No browser is available”; documented discovery returned an empty list. Phone portrait/landscape, tablet and desktop visual checks, real keyboard/screen-reader behaviour, and an actual old-tab-to-new-deployment browser reload remain unverified. CSS/markup, mocked reload/state tests and local production HTTP checks passed; they do not substitute for those browser checks. Mandarin's service-worker/offline tests were inspected, not run or ported, because BM does not have that architecture.
