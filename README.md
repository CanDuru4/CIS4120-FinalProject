# Customs Case Manager — Port 5176 Prototype

<img src="logo.png" alt="Customs Declarant AI Discrepancy" width="420" />

[![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite 8](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![pdf.js 5.x](https://img.shields.io/badge/pdf.js-5.x-ff6f00?logo=mozilla&logoColor=white)](https://mozilla.github.io/pdf.js/)

React/TypeScript/Vite single-page app for **CIS 4120** (writer → reviewer → CEO workflow). This repo tracks the **port 5176** build only.

## What this is

Customs Case Manager is a browser-only prototype of the paperwork loop a customs declarant firm runs for every export case: a **writer** assembles a declaration and its supporting documents, a **lead reviewer** checks each declared field against the uploaded evidence in a field × document matrix, and a **CEO** signs off before the case is submitted to customs. It is built for the CIS 4120 course review — instructors, teammates and usability testers — not for production customs filing. There is no backend: every case, user and uploaded file lives in the browser's `localStorage`, so a demo runs entirely offline and resets when site data is cleared.

## Key features

1. **Auth** — Login / signup; roles: writer, lead reviewer, CEO.
2. **Writer dashboard** — Kanban by case status; create cases; notifications bell with flyout (clear all, close control).
3. **Case editor** — Declarant fields, multi-file upload, tabbed documents, PDF/image preview, drag-to-link evidence, comments, save draft / submit.
4. **Draft & navigation** — Unsaved-change prompt on leave; baseline-based dirty detection; discarding a pristine new case removes it; submit validation (see below).
5. **Send / submit validation** — “Send files” modal blocks empty cases (no files and no data) and cases with no uploads. With files: lists **yellow** (value present, not linked) and **red** (field empty) issues; **Send** requires an **explanation** when issues exist; explanation is stored as a case comment, then the case moves to review.
6. **Review matrix** — Field × document grid for reviewers; inspection modal with evidence preview; CEO path to customs completion where applicable.
7. **Persistence** — Case and session state stored in **localStorage**; a `BroadcastChannel` sync reflects updates across tabs in the same browser.

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, React Router 7 (`BrowserRouter`) |
| Language | TypeScript 6 (`strict`) |
| Build / dev server | Vite 8 (`@vitejs/plugin-react`) |
| Document rendering | `pdfjs-dist` 5.x (writer preview, matrix inspection) |
| Document generation | `pdf-lib` (sample PDF script) |
| Styling | Hand-written CSS with `:root` design tokens |
| Linting | ESLint 9 (flat config) + `typescript-eslint` + `eslint-plugin-react-hooks` |
| Storage | Browser `localStorage` + `BroadcastChannel` (no backend) |

## Getting started

### Prerequisites

- Node.js `^20.19.0 || >=22.12.0` (required by Vite 8) and npm 10+
- A modern Chromium/Firefox/Safari build — the app uses `localStorage` and `BroadcastChannel`
- Python 3.10+ only if you want to regenerate seed data with `scripts/generate_seed.py`

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5176](http://localhost:5176) (port is fixed via `--strictPort`).

### Environment variables

None. The app reads no `import.meta.env` values and needs no `.env` file; everything it stores is client-side.

### Demo logins

Seed data in [`src/port5176/seedData.ts`](src/port5176/seedData.ts) registers three fictional accounts on first load — `test1@test.com` (writer), `test2@test.com` (lead reviewer), `test3@test.com` (CEO), all with the password `Test`. They are demo fixtures for grading, not real credentials, and they only ever exist in the visitor's own browser.

### Build & preview

```bash
npm run build     # tsc -b && vite build
npm run preview
```

Other scripts: `npm run lint`, `npm run generate-sample-pdfs` (optional PDF tooling; writes into `sample_pdfs/`).

## Project structure

```
.
├── index.html                     # Vite entry; loads src/main.5176.tsx
├── logo.png                       # Project logo
├── vite.config.ts                 # React plugin, fixed port 5176
├── eslint.config.js               # ESLint flat config
├── public/favicon/                # Favicons and web manifest
├── sample_pdfs/                   # Demo declarations and supporting docs
├── scripts/
│   ├── generateSamplePdfs.js      # pdf-lib generator for sample_pdfs/
│   └── generate_seed.py           # Regenerates seedData.ts fixtures
└── src/
    ├── main.5176.tsx              # ReactDOM root + BrowserRouter
    ├── styles/global.css          # Base resets
    └── port5176/
        ├── Port5176App.tsx        # Whole app: auth, dashboard, editor, matrix
        ├── PdfJsPreview.tsx       # pdf.js canvas preview component
        ├── port5176.css           # Design tokens and component styles
        └── seedData.ts            # Seed users, cases and inline demo PDFs
```

## UI & accessibility

- **Theme** — Neutral surfaces with a blue primary accent; tokens live in [`src/port5176/port5176.css`](src/port5176/port5176.css) (`:root` CSS variables).
- **Primary actions** — Strong, high-contrast styling for important buttons (e.g. **Submit case**, **Save draft** in the **Unsaved work** dialog for both writer and matrix, matrix **Submit to CEO** / destructive actions, **Return** in the return-files modal) so the default action reads clearly.
- **Secondary actions** — Cancel / **Don’t save** in the unsaved-work flow use an outlined secondary style so they are visibly less prominent than **Save draft**.
- **Modals & copy** — Return-files warning uses a filled warning icon; textarea placeholders and body text in key dialogs use darker grays for readability on white.
- **Read-only modes** — Writers and lead reviewers see locked controls when case status (or role) does not allow edits (e.g. post-submit / CEO review / completed), with matching disabled styling in the editor and matrix.
- **Dashboard polish** — Writer status chips and **Recent activity** ordering reflect meaningful states and latest touchpoints (case activity plus notifications).

## Security & dependencies

All 22 open Dependabot alerts were patched directly on `main` (the Dependabot PR was not merged):

| Package | Was | Now | Reason |
| --- | --- | --- | --- |
| `react-router` / `react-router-dom` | 7.13.2 | 7.18.3 | direct bump of `react-router-dom` to `^7.18.2` |
| `vite` | 8.0.8 | 8.2.2 | direct bump to `^8.0.16` |
| `postcss` | 8.5.8 | 8.5.28 | `overrides` |
| `nanoid` | 3.3.11 | 3.3.18 | `overrides` |
| `js-yaml` | 4.1.1 | 4.3.2 | `overrides` |
| `brace-expansion` | 5.0.5 / 1.1.13 | 5.0.9 / 1.1.18 | `overrides` (v1 line pinned under `minimatch@^3`) |
| `@babel/core` | 7.29.0 | 7.29.7 | `overrides` |
| `@humanfs/node` | 0.16.7 | 0.16.8 | `overrides` |

Transitive packages are pinned with npm [`overrides`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#overrides) in `package.json`. `npm audit` reports **0 vulnerabilities**; `npm run build` and `npm run lint` pass.

## Automation

[`.github/dependabot.yml`](.github/dependabot.yml) runs a weekly npm check and groups production, development and major updates so the repo receives a handful of pull requests instead of one per transitive bump. There are no GitHub Actions workflows and no deployment target — the app is served from `npm run dev` or from the static `dist/` output of `npm run build`.

## AI usage attribution

- Portions of this repository were developed with AI coding assistance (including code generation, refactoring suggestions, bug-fix drafts, and documentation edits).
- Team members reviewed, tested, and adjusted AI-assisted output before accepting changes.
- Final responsibility for implementation decisions, correctness, and submission content remains with the team.

## License

Coursework project. `package.json` declares **ISC**; no separate `LICENSE` file is distributed with this repository.

## Author

Maintained by **Can Duru** — [canduru.net](https://canduru.net) — with the CIS 4120 project team.
