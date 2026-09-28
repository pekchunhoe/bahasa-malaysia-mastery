# Bahasa Melayu Mastery

**Daripada Perkataan kepada Karangan** — a Bahasa Melayu learning application for Tahun 1–6, integrated with the final 2026 master and approved vocabulary export.

Plain JavaScript modules, responsive CSS, local drafts, browser speech, one Cikgu AI dialog and an optional server-side Gemini endpoint. Ejaan and imlak retain 1,080 verified source items. All 720 ejaan enrichments and 360 imlak vocabulary focuses are AI-generated material approved in bulk by the user. Two essay prompts and one independent story starter remain explicitly labelled **DEMO**.

## Run locally

Use Node 22.16+ (validated on Node 24) and Python 3 for read-only workbook extraction. No Python packages are needed. Set `PYTHON` to the Python executable if it is not available as `python`.

```sh
npm install
npm run dev
```

Open **http://localhost:4174**. Writing, transcription checks, local autosave and Generate Prompt work without an API key.

To enable live AI, copy `.env.example` to `.env.local`, set `GEMINI_API_KEY` and verify the model IDs enabled for your account. Restart the server after configuration changes. Never put credentials in browser files. Paragraph and essay reviews default to local prompt generation and cannot invoke a paid route from the pupil interface.

## Check and build

```sh
npm test
npm run check
npm run build
npm run preview
```

`preview` serves the production build on port 4174; stop the development server first or set another `PORT`. `check` performs syntax and browser-asset isolation checks; no ESLint configuration is present. Tests use Node's built-in runner.

`npm run data:prepare` compares `data/BM_MASTER_EJAAN_IMLAK_2026_MUKTAMAD.xlsx` against `data/bm_content_2026_app_ready.json` without modifying either. Any mismatch stops publication. Preparation also runs before development, tests and the production build. It emits one runtime module, `data/generated/master.js`, from the validated JSON, plus the private `audit/workbook.json`. The browser does not parse Excel. The workbook and audit are not published in `dist` or served by the local server. Build hosts must provide Python 3 as well as Node.

`vercel.json` configures the static output and `/api/ai/tutor` function using the source application's deployment pattern. Static hosting alone supports the writing activities and prompt mode; API mode requires the Node function.

## Master content and drafts

Bank Kata & Frasa covers all six years, filtered by year/unit and available
source themes. Enrichment joins `source_item_id` to `item_id`, preserving all
81 multiword entries and distinct IDs for repeated text. The source status
`Disahkan` and enrichment provenance `ai_generated` / `diluluskan` / bulk user
approval remain distinct. No individual teacher review is claimed.

Sentence and expansion activities use vocabulary prompts and relevant hints.
Examples stay in closed disclosures until requested and never populate pupil
writing. Expansion originals and revisions remain separate. Spelling offers
optional spelling focus; dictation focus appears only after a submitted attempt.
Paragraphs, guided essays and stories offer filtered vocabulary suggestions;
they do not assemble dictation sentences or replace pupil text. Blank enriched
sentence/common-error fields are not invented or displayed.

The existing `bmMastery:state:v1` key, draft IDs, autosave and navigation remain.
Independent teacher content still uses `data/schema/enrichment.js`; demo
vocabulary supplements were removed from production in favour of the master.
Existing demo writing titles and story starters retain their IDs and drafts.

Validation: **81 tests pass**, syntax/isolation checks and production build pass.
Data counts, every year/unit filter, disclosure markup, transcription and draft
restoration are covered. Browser visual/mobile and actual reload/speech checks
remain pending: no browser is available in this session. No live AI request,
commit, push or deployment was made. This folder has no Git metadata.
See [the integration report](audit/MASTER_INTEGRATION.md) for exact results,
limitations and the full changed-file inventory.

## Main files

- `js/config.js`, `js/app.js`: identity, navigation and application shell.
- `activities/`, `components/`: activity engines and shared UI.
- `data/difficulty.js`, `data/demo/content.js`: year profiles and minimal demonstration content.
- `data/schema/models.js`, `data/adapters/excel.js`: normalized learning items and actual master column mapping.
- `tools/read-workbook.py`, `tools/import-workbook.mjs`: read-only extraction, Excel/JSON validation, public data and private audit generation.
- `data/schema/enrichment.js`, `data/teacher/content.js`, `js/enrichment-service.js`: independent writing schemas and stable-ID master enrichment lookup.
- `components/enrichment.js`, `js/local-writing-check.js`: optional authored support and limited local surface checks.
- `activities/practice.js`, `js/transcription.js`: deterministic ejaan/imlak exercises and feedback.
- `js/state.js`, `js/storage.js`: BM-specific draft persistence and transient request state.
- `js/tutor-actions.js`, `js/ai-teacher.js`, `server/`, `api/ai/tutor.js`: tutor modes, contracts and server-only Gemini integration.
- `js/speech-service.js`, `js/deployment-version.js`: read-aloud and safe update handling.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the import flow, activity behavior and AI isolation. [VERIFICATION.md](VERIFICATION.md) records checks and remaining manual validation.

Both source files remain unchanged. Missing unit titles and independent essay content are not invented. No commit or push was made.
