# Customs Case Manager — Port 5176 Prototype

React/TypeScript/Vite single-page app for **CIS 4120** (writer → reviewer → CEO workflow). This repo tracks the **port 5176** build only.

## Stack

- Vite 8, React 19, TypeScript
- PDF rendering via **pdfjs-dist** (writer document preview and matrix inspection)

## Run locally

From the project root:

```bash
npm install
npm run dev
```

Open [http://localhost:5176](http://localhost:5176) (port is fixed via `--strictPort`).

Sample PDFs for demos live in [`sample_pdfs/`](sample_pdfs/).

## App entry

- [`index.html`](index.html) → [`src/main.5176.tsx`](src/main.5176.tsx)
- Main UI: [`src/port5176/Port5176App.tsx`](src/port5176/Port5176App.tsx)
- Styles: [`src/port5176/port5176.css`](src/port5176/port5176.css)
- Seed data: [`src/port5176/seedData.ts`](src/port5176/seedData.ts)

## What the app includes

1. **Auth** — Login / signup; roles: writer, lead reviewer, CEO.
2. **Writer dashboard** — Kanban by case status; create cases; notifications bell with flyout (clear all, close control).
3. **Case editor** — Declarant fields, multi-file upload, tabbed documents, PDF/image preview, drag-to-link evidence, comments, save draft / submit.
4. **Draft & navigation** — Unsaved-change prompt on leave; baseline-based dirty detection; discarding a pristine new case removes it; submit validation (see below).
5. **Send / submit validation** — “Send files” modal blocks empty cases (no files and no data) and cases with no uploads. With files: lists **yellow** (value present, not linked) and **red** (field empty) issues; **Send** requires an **explanation** when issues exist; explanation is stored as a case comment, then the case moves to review.
6. **Review matrix** — Field × document grid for reviewers; inspection modal with evidence preview; CEO path to customs completion where applicable.
7. **Persistence** — Case and session state stored in **localStorage**; a sync channel can reflect updates across tabs in the same browser.

## UI & accessibility

- **Theme** — Neutral surfaces with a blue primary accent; tokens live in [`src/port5176/port5176.css`](src/port5176/port5176.css) (`:root` CSS variables).
- **Primary actions** — Strong, high-contrast styling for important buttons (e.g. **Submit case**, **Save draft** in the **Unsaved work** dialog for both writer and matrix, matrix **Submit to CEO** / destructive actions, **Return** in the return-files modal) so the default action reads clearly.
- **Secondary actions** — Cancel / **Don’t save** in the unsaved-work flow use an outlined secondary style so they are visibly less prominent than **Save draft**.
- **Modals & copy** — Return-files warning uses a filled warning icon; textarea placeholders and body text in key dialogs use darker grays for readability on white.
- **Read-only modes** — Writers and lead reviewers see locked controls when case status (or role) does not allow edits (e.g. post-submit / CEO review / completed), with matching disabled styling in the editor and matrix.
- **Dashboard polish** — Writer status chips and **Recent activity** ordering reflect meaningful states and latest touchpoints (case activity plus notifications).

## Build & preview

```bash
npm run build
npm run preview
```

Other scripts: `npm run lint`, `npm run generate-sample-pdfs` (optional PDF tooling).

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

## AI usage attribution

- Portions of this repository were developed with AI coding assistance (including code generation, refactoring suggestions, bug-fix drafts, and documentation edits).
- Team members reviewed, tested, and adjusted AI-assisted output before accepting changes.
- Final responsibility for implementation decisions, correctness, and submission content remains with the team.
