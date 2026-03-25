# HW5 — Implementation Prototypes (CIS 4120)

**Repository:** [github.com/CanDuru4/CIS4120-HW5](https://github.com/CanDuru4/CIS4120-HW5)

This is one **Vite + React + TypeScript + React Router** codebase with **three ways to run it** (three ports). All builds share the same **case model** and **dashboard queue** in `localStorage` where those features exist, so work done in one server is visible in the others after a refresh.

## Three dev servers: 5173, 5174, and 5175

| Port | Command | Entry | Open |
|------|---------|-------|------|
| **5173** | `npm run dev` | [`src/main.tsx`](src/main.tsx) → [`App.tsx`](src/App.tsx) | [http://localhost:5173](http://localhost:5173) (redirects to `/req/1`) |
| **5174** | `npm run dev:5174` | [`src/main.caseflow.tsx`](src/main.caseflow.tsx) → [`CaseFlowApp.tsx`](src/CaseFlowApp.tsx) | [http://localhost:5174](http://localhost:5174) |
| **5175** | `npm run dev:5175` | [`src/main.neo.tsx`](src/main.neo.tsx) → [`NeoApp.tsx`](src/neo/NeoApp.tsx) | [http://localhost:5175](http://localhost:5175) |

The browser entry script is chosen in [`index.html`](index.html) from `window.location.port`: **`5174`** → case-flow, **`5175`** → neo, **anything else** (including default **5173**) → requirement lab.

### Port 5173 — requirement lab (default)

- **Purpose:** One bookmarkable URL per homework requirement: **`/req/1`** through **`/req/11`**.
- **UI:** Single-page list of requirement links at the app root, then each `/req/*` page in isolation (classic “grading” layout).
- **Best for:** Checking off Req 1–11 individually, screenshots, and matching the write-up to a specific route.

### Port 5174 — integrated case-flow stepper

- **Purpose:** One **linear stepper** that walks through the same prototype flow in order (e.g. hello → styles → **upload** (Reqs 3–4 combined) → **parse** → compare → tolerant match → evidence → validation → workflow → **embedded role dashboard** for Req 11).
- **UI:** [`CaseFlowPage.tsx`](src/caseflow/CaseFlowPage.tsx) and shared step components under [`src/caseflow/`](src/caseflow/); navigation is step-by-step, not the neo hub.
- **State:** Reads/writes **`hw5_prototype_case_store_v1`** and **`hw5_dashboard_queue_v1`** like the lab pages.
- **Best for:** Demonstrating the **end-to-end case** in homework order without the 5175 product chrome.

### Port 5175 — modern “product” shell (neo)

- **Purpose:** A **full-width** UI closer to a shipping app: role selection, hub, and Kanban, with the **customs journey** on **`/caseflow`** as a **single-page workspace** (not the 5174 sidebar stepper).
- **Main path:** **`/`** (role: Case Analyst / Lead Reviewer / CEO) → **`/hub`** → **Create case** → **`/caseflow`**.
- **Hub:** Case Analyst sees a **dashboard-style grid**; Lead Reviewer and CEO see the **workflow Kanban** (shared pipeline for review vs executive queue). **View as** role switcher stays in sync with queue filters.
- **`/caseflow`:** Declaration panel, **upload** or **PDF preview** (toggle back to upload), case file strip, **extract & parse**, editable declaration fields + evidence, **Send Files**, **Validation status**, and a **collapsible Requirement 7** section (per-field declaration vs supporting values and **match scores**).
- **Lab routes:** **`/req/1`–`/req/11`** still exist but are framed as **Lab / grading** (banner + titles from [`neoLabReqMeta.ts`](src/neo/neoLabReqMeta.ts)); reach them from the hub footer or **`/lab`**.
- **Extra state:** Selected hub role is stored in **`sessionStorage`** (`hw5_neo_role_v1`).
- **Best for:** Course demo, UI critique, and showing how the same logic as 5173/5174 looks in a cohesive product layout.

## Prerequisites

- Node.js ≥ 20 (tested with Node 22.x)

## Install & run

```bash
npm install
```

Then start **one** of the servers from [Three dev servers](#three-dev-servers-5173-5174-and-5175) above (`npm run dev`, `npm run dev:5174`, or `npm run dev:5175`).

### 5175-only routes (quick reference)

These exist on **`http://localhost:5175`** ([`NeoApp.tsx`](src/neo/NeoApp.tsx)):

| Path | Purpose |
|------|---------|
| `/` | Select role (Case Analyst / Lead / CEO); stored in `sessionStorage` (`hw5_neo_role_v1`) |
| `/hub` | **Case Analyst:** dashboard grid + **Create case**. **Lead / CEO:** Kanban. Footer **Lab** (collapsed): links to `/req/1`–`/req/11` and **`/lab`**. |
| `/lab` | Full lab index (bookmarkable); same requirement links as the hub footer. |
| `/caseflow` | Single-page customs workspace (neo). |
| `/req/1` … `/req/11` | Same underlying pages as 5173, wrapped with **Lab prototype** chrome on 5175 only. |

On **5174**, **`/caseflow`** is not used the same way: the integrated flow is the **stepper** at `/` inside `CaseFlowApp`. On **5173**, use **`/req/*`** only (no hub or neo `/caseflow`).

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

**What was AI-assisted:** Large parts of this codebase were **written, refactored, or debugged with AI coding assistants** (e.g. **Cursor** with integrated LLMs, and similar tools). That includes UI flows, state wiring (`caseStore`, dashboard queue), the **5173** requirement pages and router, the **5174** case-flow shell and step components, the **5175** neo layout (`src/neo/*`, shared `useCaseFlowController`), PDF/sample-data utilities, and README maintenance. The team **reviews, runs, and tests** the app locally for accuracy and requirements.