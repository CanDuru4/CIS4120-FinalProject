# Dependencies and maintenance

Moved out of the README. Covers the 2026-09-06 security pass, Dependabot automation and held-back majors.

## Security pass

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

Transitive packages are pinned with npm [`overrides`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#overrides) in `package.json`. At the time of the pass, `npm audit` reported 0 vulnerabilities and `npm run build` and `npm run lint` passed.

## Automation

[`.github/dependabot.yml`](../.github/dependabot.yml) runs a weekly npm check and groups production, development and major updates so the repo receives a handful of pull requests instead of one per transitive bump. There are no GitHub Actions workflows and no deployment target; the app is served from `npm run dev` or from the static `dist/` output of `npm run build`.

## Held-back majors

| Package | Pinned at | Why |
| --- | --- | --- |
| `typescript` | `^6.0.2` | `typescript-eslint` 8.69.0 declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"` and throws `typescript-eslint does not support TS 7.0.` at import time, so `npm run lint` hard-fails on TypeScript 7 (`tsc -b` and `vite build` themselves pass). Tracked upstream at [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940). |

The TypeScript major is suppressed with an `ignore` entry in `.github/dependabot.yml`; remove it once typescript-eslint ships TS 7 support.
