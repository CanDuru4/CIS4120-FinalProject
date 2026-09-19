# Customs Case Manager (CIS 4120 final project)

A browser-only prototype of the export-declaration review loop at a customs firm. A writer builds a case and uploads documents, a lead reviewer checks it in a field × document matrix, and a CEO signs off. This is the CIS 4120 (HCI) final project from Penn, Spring 2026. The coursework is finished, so the repo now only gets dependency and docs maintenance. There is no backend: all state lives in the browser.

Stack: React 19, React Router 7, TypeScript 6 (`strict`), Vite 8, `pdfjs-dist` 6, hand-written CSS, ESLint 10 flat config with `typescript-eslint`.

## Repo map

- `index.html`: the Vite entry. It loads `src/main.5176.tsx`.
- `src/main.5176.tsx`: the React root with `BrowserRouter` and the global CSS imports.
- `src/port5176/Port5176App.tsx`: the whole app in one ~6.5k-line file. It holds the types (`Role`, `CaseStatus`, `Case`, `EvidenceLink`, ...), auth, dashboard, case editor, review matrix, modals and persistence.
- `src/port5176/PdfJsPreview.tsx`: the pdf.js canvas preview. It sets `GlobalWorkerOptions.workerSrc` and exports `PdfPageLayoutInfo`.
- `src/port5176/port5176.css`: the design tokens (`:root` variables) and all component styles.
- `src/port5176/seedData.ts`: the demo users and cases, with the demo PDFs inlined as base64 `data:` URLs.
- `src/styles/global.css`: base resets.
- `public/favicon/`: favicons and the web manifest.
- `docs/DEPENDENCIES.md`: the security pass, Dependabot setup and held-back majors.
- `.github/dependabot.yml`: weekly grouped npm updates. There are no Actions workflows.

## Commands

`node_modules/` is not checked in, so run `npm install` first. Node `^20.19.0 || >=22.12.0` is required by Vite 8.

- `npm run dev`: dev server on http://localhost:5176. It uses `--strictPort`, so it fails instead of picking another port. `npm run dev:5176` is an alias.
- `npm run build`: runs `tsc -b`, then `vite build` into `dist/`. This is the only typecheck.
- `npm run lint`: `eslint .`
- `npm run preview`: serves `dist/`.

There is no test suite and no deploy target. The app is served from `npm run dev` or as the static `dist/` output.

## Data and state

- All persistence is in `localStorage`:
  - `customsCaseManager`: the app bundle (user, cases, notifications, view, selected case).
  - `registeredUsers`: signup accounts.
  - `seedApplied_v1`: seeding flag.
  - `port5176_*`: UI preference flags.
- Cross-tab sync goes through the `BroadcastChannel` `customsCaseManager-5176-sync` plus `storage` events.
- The first load merges `SEED_USERS` into `registeredUsers` and loads `SEED_CASES`. An empty or unparseable saved bundle also falls back to the seed cases.
- The demo logins are `test1@test.com` (writer), `test2@test.com` (lead reviewer) and `test3@test.com` (CEO), all with password `Test`. They are fictional fixtures documented in the README, not secrets.
- If you change the shape of `Case` or the persisted bundle, extend `normalizeCase` / `hydrateCasesAndNotifications` so old browser state still loads. Existing demo browsers keep their old data.
- There are no env vars and no `import.meta.env` reads.

## Gotchas

- `seedData.ts` says "auto-generated", but its generators (`scripts/generate_seed.py`, `scripts/generateSamplePdfs.js`) and `sample_pdfs/` were deleted in commit `af74a07`. Edit `seedData.ts` by hand. The leftover `scripts/**` ignore in `eslint.config.js` and the Python entries in `.gitignore` refer to those removed files.
- `pdf-lib` is listed in `dependencies`, but nothing in `src/` imports it.
- The `package.json` `name` is still `hw5`, and the license there is `ISC`. There is no `LICENSE` file.
- TypeScript is held at 6.x on purpose: `typescript-eslint` 8.x rejects TS 7 and `npm run lint` fails. `dependabot.yml` ignores the TS major. See `docs/DEPENDENCIES.md` before bumping it.
- `eslint.config.js` deliberately turns off `react-hooks/refs` and `react-hooks/set-state-in-effect`, because the app relies on ref baselines and layout-effect hydration. Keep them off.
- Transitive security pins live in `package.json` `overrides`. Keep them when you bump dependencies.
- Read-only UI state depends on role and status: `caseIsReadOnlyForWriterStatus` and `caseIsReadOnlyForMatrixUser`. Check both when you add editable controls.

## Conventions

- Code lives in the single `Port5176App.tsx`, organized as pure helpers and types at the top and components below. Unless a refactor is requested, make targeted edits instead of splitting the file.
- Design tokens are the `:root` CSS variables in `port5176.css`. Prefer them for new styles, but the file already has many literal hex/rgba colors, so don't treat those as bugs to sweep.
- The README records AI-assisted development. The team is credited in the README's Acknowledgments section.
