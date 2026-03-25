# HW5 — Implementation Prototypes (CIS 4120)

**Repository:** [github.com/CanDuru4/CIS4120-HW5](https://github.com/CanDuru4/CIS4120-HW5)

Single React app (Vite + React + TypeScript + React Router). **Port 5173** exposes one route per requirement (`/req/1` … `/req/11`). **Port 5174** runs the same shared `localStorage` case model in one linear **case-flow** stepper (upload covers Req 3–4 together; parse through workflow mirrors Req 5–10; embedded role dashboard for Req 11). **Port 5175** is a **full-width modern** skin: role picker, **role-split hub** (analyst grid vs lead/CEO Kanban with a shared review pipeline), **`/caseflow`** as a **single-page customs workspace** (declaration + upload or **PDF preview** with an upload toggle, parse/extract, editable declaration fields with evidence, **Send Files**, and **Validation status** with a **collapsible Requirement 7** block showing per-field declaration vs supporting values and match scores). **Main product path:** `/` → `/hub` → **Create case** → `/caseflow`. **`/req/1`–`/req/11`** are **Lab / grading only** (collapsible strip on the hub, bookmarkable **`/lab`**, product-style shell titles + “Lab prototype” banner). **Same stores and validation rules** as 5173/5174 where steps overlap.

## Prerequisites

- Node.js ≥ 20 (tested with Node 22.x)

## Install & run

```bash
npm install
```

**Requirement pages (default dev server):**

```bash
npm run dev
```

Open `http://localhost:5173/` (root redirects to `/req/1`).

**Integrated case flow (alternate entry — same repo, different port):**

```bash
npm run dev:5174
```

Open `http://localhost:5174/`. Vite picks `src/main.caseflow.tsx` when the port is `5174` (see `index.html`).

**Modern UI shell — full router + case flow (port 5175):**

```bash
npm run dev:5175
```

Open `http://localhost:5175/`. Entry: `src/main.neo.tsx`. Routes:

| Path | Purpose |
|------|---------|
| `/` | Select role (Case Analyst / Lead / CEO); stored in `sessionStorage` (`hw5_neo_role_v1`) |
| `/hub` | **Case Analyst:** upper dashboard grid (open cases, activity, upload teaser, Create case). **Lead / CEO:** workflow Kanban only. Footer **Lab** (collapsed by default): numbered links to `/req/1`–`/req/11`; link to **Open full lab page**. |
| `/lab` | Full **grading lab** page with the same 1–11 links (bookmarkable). Not part of the main customs workflow. |
| `/caseflow` | **5175:** Single-page customs workspace (see intro). **5174:** Linear case-flow stepper (upload through validation; shared `localStorage` case model). |
| `/req/1` … `/req/11` | Same pages as 5173; **5175** wraps them with **Lab prototype** banner and product titles from [`neoLabReqMeta.ts`](src/neo/neoLabReqMeta.ts). Reach only via **Lab** or **`/lab`**. |

**Sample PDFs** (optional, for local demos):

```bash
npm run generate-sample-pdfs
```

## Routes (one prototype per requirement)

| Req | Route    | Summary |
|-----|----------|---------|
| 1   | `/req/1` | Hello World |
| 2   | `/req/2` | Theme / styles |
| 3   | `/req/3` | Separate PDF upload + store + extract/parse |
| 4   | `/req/4` | Combined PDF → separate + parse |
| 5   | `/req/5` | Field parsing demo |
| 6   | `/req/6` | Discrepancies |
| 7   | `/req/7` | Tolerant matching |
| 8   | `/req/8` | Evidence-linked review |
| 9   | `/req/9` | Send Files validation |
| 10  | `/req/10`| Workflow + comments |
| 11  | `/req/11`| Role-based dashboard (Analyst / Lead / CEO) |

### Requirement 1: Hello world

- **Route:** `/req/1`
- **Expected:** One screen showing “Hello World”.

### Requirement 2: Hello styles

- **Route:** `/req/2`
- **Expected:** Theme colors, typography, icons/badges, warning styles.

### Requirement 3: Separate-document upload

- **Route:** `/req/3`
- **Workflow:**
  1. Pick one declaration PDF and at least three supporting PDFs.
  2. **Store files in case** — updates the shared case (file names, MIME types, roles) in `localStorage`.
  3. Confirm the case contents table matches what you uploaded.
  4. **Extract + parse fields** — runs PDF text extraction (sample PDFs use deterministic text; other PDFs depend on the browser/PDF.js path).
- **Quick demo:** **Load demo case** (no uploads).
- **Dashboard (Req 11):** A **Draft** queue row is created after **successful extract + parse** (or the Req 3 demo load), not when files are only stored.

### Requirement 4: Combined-PDF intake + separation

- **Route:** `/req/4`
- **Workflow:** Upload a combined PDF → **Extract + separate** → review split sections and parsed fields.
- **Quick demo:** **Load demo combined**.

### Requirement 5: PDF text extraction + field parsing

- **Route:** `/req/5`
- **Expected:** **Load demo case** shows structured fields (company name, gross weight, invoice #, item description, quantity) with evidence snippets.

### Requirement 6: Cross-document discrepancy detection

- **Route:** `/req/6`
- **Expected:** **Load demo case** → fields classified as Match / Mismatch / Not Found.

### Requirement 7: Tolerant textual matching

- **Route:** `/req/7`
- **Expected:** Near-matches vs a clear Mismatch example.

### Requirement 8: Evidence-linked review

- **Route:** `/req/8`
- **Expected:** Pick a field → supporting doc label, value, and evidence snippet.

### Requirement 9: Submission warning + error prevention

- **Route:** `/req/9`
- **Workflow:** **Load incomplete demo** → **Send Files** blocked with listed issues → **Load complete demo** → **Send Files** succeeds and moves the case to **Ready for Review** on the dashboard queue.

### Requirement 10: Workflow + review comments

- **Route:** `/req/10`
- **Expected:** Draft / Returned / Ready for Review / Ready to Submit transitions, persisted comments, queue status kept in sync with Req 11 where applicable.

### Requirement 11: Role-based dashboard

- **Route:** `/req/11`
- **Expected:** Role switcher (Case Analyst, Lead Reviewer, CEO); each role sees filtered queue rows; fixed **Demo** rows illustrate every status; **Open case** is disabled in the prototype. Live queue rows align with parse → Draft, Send Files → Ready for Review, Lead actions → CEO queue.

## Shared state (`localStorage`)

| Key | Purpose |
|-----|---------|
| `hw5_prototype_case_store_v1` | Active case: files, parsed fields, discrepancies, workflow, submission, comments |
| `hw5_dashboard_queue_v1` | Dashboard queue rows (status per case) |
| `hw5_neo_role_v1` | (Port 5175 only) Selected dashboard role in `sessionStorage` |

## Build

```bash
npm run build
npm run preview   # optional production preview
```

---

## AI-generated code — attribution

**What was AI-assisted:** Large parts of this codebase were **written, refactored, or debugged with AI coding assistants** (e.g. **Cursor** with integrated LLMs, and similar tools). That includes UI flows, state wiring (`caseStore`, dashboard queue), the port-**5174** case-flow shell and step components, the port-**5175** modern layout (`src/neo/*`, shared `useCaseFlowController`), PDF/sample-data utilities, and README maintenance. The team **reviews, runs, and tests** the app locally for accuracy and requirements.