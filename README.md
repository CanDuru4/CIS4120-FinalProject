# Customs Case Manager

[![React 19](https://img.shields.io/badge/React-19-149eca?style=flat&logo=react&logoColor=white)](https://react.dev)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178c6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite 8](https://img.shields.io/badge/Vite-8-646cff?style=flat&logo=vite&logoColor=white)](https://vite.dev)
[![pdf.js 6.x](https://img.shields.io/badge/pdf.js-6.x-ff6f00?style=flat&logo=mozilla&logoColor=white)](https://mozilla.github.io/pdf.js/)

Customs Case Manager is a browser-only React/TypeScript prototype of the paperwork loop a customs declarant firm runs for every export case: a writer assembles a declaration and its supporting documents, a lead reviewer checks each declared field against the uploaded evidence in a field × document matrix, and a CEO signs off before the case is submitted to customs. It is built for course review by instructors, teammates and usability testers, not for production customs filing. There is no backend: every case, user and uploaded file lives in the browser's `localStorage`, so a demo runs entirely offline and resets when site data is cleared.

> **Context:** CIS 4120 (Human-Computer Interaction) final project, University of Pennsylvania, Spring 2026

<img src="logo.png" alt="Customs Case Manager logo" width="420" />

## Features

1. **Auth**: login and signup with three roles (writer, lead reviewer, CEO).
2. **Writer dashboard**: Kanban by case status; create cases; notifications bell with flyout (clear all, close control).
3. **Case editor**: declarant fields, multi-file upload, tabbed documents, PDF/image preview, drag-to-link evidence, comments, save draft and submit.
4. **Draft and navigation**: unsaved-change prompt on leave; baseline-based dirty detection; discarding a pristine new case removes it.
5. **Send and submit validation**: the "Send files" modal blocks empty cases (no files and no data) and cases with no uploads. With files, it lists yellow issues (value present, not linked) and red issues (field empty); sending requires an explanation when issues exist, which is stored as a case comment before the case moves to review.
6. **Review matrix**: field × document grid for reviewers; inspection modal with evidence preview; CEO path to customs completion where applicable.
7. **Persistence**: case and session state stored in `localStorage`; a `BroadcastChannel` sync reflects updates across tabs in the same browser.

### Interface and accessibility

- **Theme**: neutral surfaces with a blue primary accent; tokens live in [`src/port5176/port5176.css`](src/port5176/port5176.css) (`:root` CSS variables).
- **Primary actions**: strong, high-contrast styling for important buttons (for example **Submit case**, **Save draft** in the unsaved-work dialog for both writer and matrix, matrix **Submit to CEO** and destructive actions, **Return** in the return-files modal) so the default action reads clearly.
- **Secondary actions**: Cancel and **Don't save** in the unsaved-work flow use an outlined secondary style so they are visibly less prominent than **Save draft**.
- **Modals and copy**: the return-files warning uses a filled warning icon; textarea placeholders and body text in key dialogs use darker grays for readability on white.
- **Read-only modes**: writers and lead reviewers see locked controls when case status or role does not allow edits (post-submit, CEO review, completed), with matching disabled styling in the editor and matrix.
- **Dashboard polish**: writer status chips and recent-activity ordering reflect meaningful states and latest touchpoints (case activity plus notifications).

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, React Router 7 (`BrowserRouter`) |
| Language | TypeScript 6 (`strict`) |
| Build and dev server | Vite 8 (`@vitejs/plugin-react`) |
| Document rendering | `pdfjs-dist` 6.x (writer preview, matrix inspection) |
| Styling | Hand-written CSS with `:root` design tokens |
| Linting | ESLint 10 (flat config) + `typescript-eslint` + `eslint-plugin-react-hooks` |
| Storage | Browser `localStorage` + `BroadcastChannel` (no backend) |

Dependency maintenance, the security pass and held-back majors are documented in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md).

## Getting started

### Prerequisites

- Node.js `^20.19.0 || >=22.12.0` (required by Vite 8) and npm 10+
- A modern Chromium, Firefox or Safari build; the app uses `localStorage` and `BroadcastChannel`

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:5176](http://localhost:5176). The dev server port is fixed via `--strictPort`.

### Configuration

No environment variables. The app reads no `import.meta.env` values and needs no `.env` file; everything it stores is client-side.

Seed data in [`src/port5176/seedData.ts`](src/port5176/seedData.ts) registers three fictional accounts on first load: `test1@test.com` (writer), `test2@test.com` (lead reviewer) and `test3@test.com` (CEO), all with the password `Test`. They are demo fixtures for grading, not real credentials, and they only ever exist in the visitor's own browser.

## Usage

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5176 (`dev:5176` is an alias) |
| `npm run build` | `tsc -b` type-check, then `vite build` into `dist/` |
| `npm run preview` | Serve the contents of `dist/` |
| `npm run lint` | ESLint over the repository |

## Project structure

```
.
├── index.html                     # Vite entry; loads src/main.5176.tsx
├── logo.png                       # Project logo
├── vite.config.ts                 # React plugin, fixed port 5176
├── eslint.config.js               # ESLint flat config
├── docs/DEPENDENCIES.md           # Dependency maintenance notes
├── public/favicon/                # Favicons and web manifest
└── src/
    ├── main.5176.tsx              # ReactDOM root + BrowserRouter
    ├── styles/global.css          # Base resets
    └── port5176/
        ├── Port5176App.tsx        # Whole app: auth, dashboard, editor, matrix
        ├── PdfJsPreview.tsx       # pdf.js canvas preview component
        ├── port5176.css           # Design tokens and component styles
        └── seedData.ts            # Seed users, cases and inline demo PDFs
```

## Acknowledgments

- Built with the CIS 4120 project team; the git history includes commits from Dominic Chang.
- Portions of this repository were developed with AI coding assistance (including code generation, refactoring suggestions, bug-fix drafts, and documentation edits). Team members reviewed, tested, and adjusted AI-assisted output before accepting changes. Final responsibility for implementation decisions, correctness, and submission content remains with the team.

## License

Coursework. No `LICENSE` file is distributed with this repository; `package.json` declares `ISC`.

## Author

Can Duru — [canduru.net](https://canduru.net)
