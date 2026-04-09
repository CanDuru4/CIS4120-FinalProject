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

## Build & preview

```bash
npm run build
npm run preview
```

Other scripts: `npm run lint`, `npm run generate-sample-pdfs` (optional PDF tooling).

## AI usage attribution

- Portions of this repository were developed with AI coding assistance (including code generation, refactoring suggestions, bug-fix drafts, and documentation edits).
- Team members reviewed, tested, and adjusted AI-assisted output before accepting changes.
- Final responsibility for implementation decisions, correctness, and submission content remains with the team.
