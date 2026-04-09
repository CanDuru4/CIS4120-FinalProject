import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import './port5176.css';
import { SEED_USERS, SEED_CASES } from './seedData';
import { PdfJsPreview, type PdfPageLayoutInfo } from './PdfJsPreview';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ============== TYPE DEFINITIONS ==============

type Role = 'writer' | 'lead_reviewer' | 'ceo';
type CaseStatus =
  | 'drafting'
  | 'missing_ev'
  | 'ready_review'
  | 'ceo_review'
  | 'returned'
  | 'completed';

type User = {
  email: string;
  role: Role;
  company: string;
  name: string;
};

type Notification = {
  id: string;
  message: string;
  caseId: string;
  timestamp: Date;
  read: boolean;
  /** When set, only users with this role see the notification in the bell */
  audienceRole?: Role;
};

function notificationVisibleToUser(n: Notification, user: User): boolean {
  if (n.audienceRole == null) return true;
  return n.audienceRole === user.role;
}

/** Fixed `top` / `right` (px, viewport) so the panel sits under the bell, right-aligned to it. */
type NotificationFlyoutAnchor = { top: number; right: number };

function computeNotificationFlyoutAnchor(buttonEl: HTMLElement): NotificationFlyoutAnchor {
  const r = buttonEl.getBoundingClientRect();
  const gap = 10;
  const vw = window.innerWidth;
  const panelW = Math.min(360, vw - 16);
  let right = vw - r.right;
  const leftEdge = vw - right - panelW;
  if (leftEdge < 8) {
    right = Math.max(8, vw - panelW - 8);
  }
  return { top: r.bottom + gap, right };
}

interface NotificationFlyoutProps {
  open: boolean;
  anchor: NotificationFlyoutAnchor | null;
  onDismiss: () => void;
  user: User;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
}

function NotificationFlyout({
  open,
  anchor,
  onDismiss,
  user,
  notifications,
  setNotifications,
}: NotificationFlyoutProps) {
  const myNotifications = notifications.filter(n => notificationVisibleToUser(n, user));

  const dismissOne = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllMine = () => {
    setNotifications(prev => prev.filter(n => !notificationVisibleToUser(n, user)));
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const n = e.target;
      if (!(n instanceof Element)) return;
      if (n.closest('.notification-flyout-panel') || n.closest('.notification-bell-trigger')) return;
      onDismiss();
    };
    // Defer so the same user gesture that opened the panel doesn’t hit this listener immediately.
    const t = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, onDismiss]);

  if (!open) return null;

  const pos = anchor ?? { top: 72, right: 24 };

  return (
    <div className="notification-flyout-root" role="dialog" aria-modal="true" aria-labelledby="notification-flyout-title">
      <div
        className="notification-flyout-panel"
        style={{ top: pos.top, right: pos.right, left: 'auto', transform: 'none' }}
      >
        <div className="notification-popup-header notification-popup-header--banner">
          <span className="notification-tag" id="notification-flyout-title">
            Notifications
          </span>
          <div className="notification-popup-header-actions">
            <button
              type="button"
              className="btn btn-outline notification-clear-all-btn"
              onClick={clearAllMine}
              disabled={myNotifications.length === 0}
            >
              Clear all
            </button>
            <button
              type="button"
              className="notification-flyout-close"
              onClick={onDismiss}
              aria-label="Close notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="notification-popup-body">
          {myNotifications.length === 0 ? (
            <p className="notification-empty">No notifications</p>
          ) : (
            myNotifications.map(n => (
              <div key={n.id} className="notification-item">
                <p>{n.message}</p>
                <button
                  type="button"
                  className="notification-dismiss"
                  onClick={() => dismissOne(n.id)}
                  aria-label="Remove notification"
                >
                  &times;
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

type DeclarantField =
  | 'hsCode'
  | 'originCountry'
  | 'destCountry'
  | 'invoiceAmount'
  | 'netWeight'
  | 'grossWeight'
  | 'exitCustoms'
  | 'iban'
  | 'others';

type DocumentType = 'invoice' | 'packageList' | 'atr' | 'insurance';

/** Writer uploads use one internal type (matrix columns); UI shows file names only, not categories. */
const DEFAULT_WRITER_DOC_TYPE: DocumentType = 'invoice';

/** Maximum PDF/image attachments per case (extra files in a batch are skipped). */
const MAX_DOCUMENTS_PER_CASE = 50;

type EvidenceLink = {
  field: DeclarantField;
  docId: string;
  docType: DocumentType;
  region: string;
  value: string;
  status: 'linked' | 'conflict' | 'stale';
};

type UploadedDoc = {
  id: string;
  name: string;
  docType: DocumentType;
  dataUrl: string;
};

/**
 * x,y,widthPct,heightPct = center/size in % of doc preview (images, or cache for PDF).
 * For PDFs, `pageNorm` is authoritative: center/size as fractions of the PDF page (0–1).
 */
type RegionPageNorm = { cx: number; cy: number; w: number; h: number };

type DocumentRegion = {
  id: string;
  docId: string;
  x: number;
  y: number;
  widthPct: number;
  heightPct: number;
  pageNorm?: RegionPageNorm;
};

const DEFAULT_REGION_SIZE_PCT = 7;
const MIN_REGION_SIZE_PCT = 3;
const MAX_REGION_SIZE_PCT = 50;

function clampRegionDimension(n: number): number {
  return Math.max(MIN_REGION_SIZE_PCT, Math.min(MAX_REGION_SIZE_PCT, n));
}

function pageNormToPercents(pn: RegionPageNorm, L: PdfPageLayoutInfo) {
  const u = pn.cx * L.pageW;
  const v = pn.cy * L.pageH;
  const sx = u * L.scale;
  const sy = v * L.scale;
  return {
    x: (sx / L.cw) * 100,
    y: (sy / L.ch) * 100,
    widthPct: ((pn.w * L.pageW * L.scale) / L.cw) * 100,
    heightPct: ((pn.h * L.pageH * L.scale) / L.ch) * 100,
  };
}

function percentsToPageNorm(
  x: number,
  y: number,
  wPct: number,
  hPct: number,
  L: PdfPageLayoutInfo,
): RegionPageNorm {
  const sx = (x / 100) * L.cw;
  const sy = (y / 100) * L.ch;
  const u = sx / L.scale;
  const v = sy / L.scale;
  return {
    cx: u / L.pageW,
    cy: v / L.pageH,
    w: ((wPct / 100) * L.cw) / L.scale / L.pageW,
    h: ((hPct / 100) * L.ch) / L.scale / L.pageH,
  };
}

function defaultPageNormSize(L: PdfPageLayoutInfo): { w: number; h: number } {
  const w = ((DEFAULT_REGION_SIZE_PCT / 100) * L.cw) / L.scale / L.pageW;
  const h = ((DEFAULT_REGION_SIZE_PCT / 100) * L.ch) / L.scale / L.pageH;
  return { w: Math.min(1, w), h: Math.min(1, h) };
}

function minPageWidth(L: PdfPageLayoutInfo): number {
  return (MIN_REGION_SIZE_PCT / 100) * L.cw / L.scale;
}
function minPageHeight(L: PdfPageLayoutInfo): number {
  return (MIN_REGION_SIZE_PCT / 100) * L.ch / L.scale;
}
function maxPageWidth(L: PdfPageLayoutInfo): number {
  return (MAX_REGION_SIZE_PCT / 100) * L.cw / L.scale;
}
function maxPageHeight(L: PdfPageLayoutInfo): number {
  return (MAX_REGION_SIZE_PCT / 100) * L.ch / L.scale;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Pointer position in doc-preview content coordinates (accounts for scroll). */
function viewerContentPoint(
  viewerEl: HTMLDivElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = viewerEl.getBoundingClientRect();
  return {
    x: clientX - rect.left + viewerEl.scrollLeft,
    y: clientY - rect.top + viewerEl.scrollTop,
  };
}

function clientPointInsideRect(cx: number, cy: number, r: DOMRectReadOnly): boolean {
  return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
}

/** Hide link SVG when anchors sit outside their scroll panes (e.g. highlight scrolled off-screen). */
function evidenceLinkAnchorsInView(
  regionEl: HTMLElement | null,
  fieldEl: HTMLElement | null,
  docViewerEl: HTMLDivElement | null,
  declarantScrollEl: HTMLDivElement | null,
): boolean {
  if (!regionEl || !fieldEl || !docViewerEl) return false;

  const rr = regionEl.getBoundingClientRect();
  const rcx = rr.left + rr.width / 2;
  const rcy = rr.top + rr.height / 2;
  if (!clientPointInsideRect(rcx, rcy, docViewerEl.getBoundingClientRect())) return false;

  const fr = fieldEl.getBoundingClientRect();
  const fcx = fr.right;
  const fcy = fr.top + fr.height / 2;
  if (!declarantScrollEl) return true;
  return clientPointInsideRect(fcx, fcy, declarantScrollEl.getBoundingClientRect());
}

function regionDisplayPercents(region: DocumentRegion, L: PdfPageLayoutInfo | null) {
  if (L && region.pageNorm) {
    return pageNormToPercents(region.pageNorm, L);
  }
  return { x: region.x, y: region.y, widthPct: region.widthPct, heightPct: region.heightPct };
}

type RegionResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n';

type Case = {
  id: string;
  title: string;
  createdBy: string;
  createdAt: Date;
  status: CaseStatus;
  fields: Record<DeclarantField, string>;
  docs: UploadedDoc[];
  links: EvidenceLink[];
  regions: DocumentRegion[];
  comments: Array<{ author: string; text: string; timestamp: Date }>;
  /** Review matrix: manually conflict-flagged cells, keys `field:docId` */
  matrixManualConflicts: string[];
  /** Writer kanban lane when the case was sent to lead review (for CEO customs notifications). */
  writerExitLaneAtReviewSubmit?: 'drafting' | 'missing_ev';
  /** Set when lead reviewer submits the case to the CEO queue. */
  passedLeadReviewBeforeCeo?: boolean;
};

const DEFAULT_CASE_FIELDS: Record<DeclarantField, string> = {
  hsCode: '',
  originCountry: '',
  destCountry: '',
  invoiceAmount: '',
  netWeight: '',
  grossWeight: '',
  exitCustoms: '',
  iban: '',
  others: '',
};

/** Legacy matrix keys used `field:invoice`; migrate to `field:docId` when possible. */
function migrateMatrixManualConflictKeys(docs: UploadedDoc[], rawKeys: string[]): string[] {
  const ids = new Set(docs.map(d => d.id));
  const seen = new Set<string>();
  const out: string[] = [];
  const legacyTypes = new Set<DocumentType>(['invoice', 'packageList', 'atr', 'insurance']);
  for (const key of rawKeys) {
    const i = key.indexOf(':');
    if (i < 0) continue;
    const field = key.slice(0, i) as DeclarantField;
    if (!(field in DEFAULT_CASE_FIELDS)) continue;
    const suffix = key.slice(i + 1);
    if (ids.has(suffix)) {
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
      continue;
    }
    if (legacyTypes.has(suffix as DocumentType)) {
      const doc = docs.find(d => d.docType === suffix);
      if (doc) {
        const nk = `${field}:${doc.id}`;
        if (!seen.has(nk)) {
          seen.add(nk);
          out.push(nk);
        }
      }
    }
  }
  return out;
}

type AppState = {
  user: User | null;
  cases: Case[];
  notifications: Notification[];
};

type View = 'login' | 'signup' | 'dashboard' | 'editor' | 'matrix';

/** Full blob written to localStorage (includes screen so refresh restores the same place). */
type PersistedAppBundle = AppState & {
  view?: View;
  selectedCaseId?: string | null;
  matrixCaseId?: string | null;
};

function resolveRestoredNavigation(
  loggedIn: User,
  cases: Case[],
  raw: Pick<PersistedAppBundle, 'view' | 'selectedCaseId' | 'matrixCaseId'>,
): { view: View; selectedCaseId: string | null; matrixCaseId: string | null } {
  const ids = new Set(cases.map(c => c.id));
  switch (raw.view) {
    case 'editor':
      if (loggedIn.role === 'writer' && raw.selectedCaseId && ids.has(raw.selectedCaseId)) {
        return { view: 'editor', selectedCaseId: raw.selectedCaseId, matrixCaseId: null };
      }
      break;
    case 'matrix':
      if (
        (loggedIn.role === 'lead_reviewer' || loggedIn.role === 'ceo') &&
        raw.matrixCaseId &&
        ids.has(raw.matrixCaseId)
      ) {
        return { view: 'matrix', selectedCaseId: null, matrixCaseId: raw.matrixCaseId };
      }
      break;
    case 'dashboard':
      return { view: 'dashboard', selectedCaseId: null, matrixCaseId: null };
    default:
      break;
  }
  return { view: 'dashboard', selectedCaseId: null, matrixCaseId: null };
}

/** Migrate persisted/seed cases: per-file doc ids, regions + links scoped by docId */
function normalizeCase(raw: Case): Case {
  const sourceDocs = (raw.docs ?? []) as Array<Omit<UploadedDoc, 'id'> & { id?: string }>;
  const docs: UploadedDoc[] = sourceDocs.map((d, i) => ({
    id: d.id ?? `doc-${raw.id}-${i}-${Math.random().toString(36).slice(2, 9)}`,
    name: d.name,
    docType: d.docType ?? DEFAULT_WRITER_DOC_TYPE,
    dataUrl: d.dataUrl,
  }));

  const fallbackDocId = docs[0]?.id ?? '';

  const regions: DocumentRegion[] = (raw.regions ?? []).map(r => {
    const legacy = r as {
      id: string;
      x: number;
      y: number;
      docId?: string;
      docType?: DocumentType;
      sizePct?: number;
      widthPct?: number;
      heightPct?: number;
      pageNorm?: RegionPageNorm;
    };
    const base =
      typeof legacy.sizePct === 'number' && legacy.sizePct >= MIN_REGION_SIZE_PCT
        ? Math.min(MAX_REGION_SIZE_PCT, legacy.sizePct)
        : DEFAULT_REGION_SIZE_PCT;
    const w =
      typeof legacy.widthPct === 'number' && legacy.widthPct >= MIN_REGION_SIZE_PCT
        ? Math.min(MAX_REGION_SIZE_PCT, legacy.widthPct)
        : base;
    const h =
      typeof legacy.heightPct === 'number' && legacy.heightPct >= MIN_REGION_SIZE_PCT
        ? Math.min(MAX_REGION_SIZE_PCT, legacy.heightPct)
        : base;
    const baseRegion = {
      id: r.id,
      x: r.x,
      y: r.y,
      widthPct: w,
      heightPct: h,
      ...(legacy.pageNorm ? { pageNorm: legacy.pageNorm } : {}),
    };
    if (legacy.docId && docs.some(d => d.id === legacy.docId)) {
      return { ...baseRegion, docId: legacy.docId };
    }
    const dt = legacy.docType ?? 'invoice';
    const doc = docs.find(d => d.docType === dt) ?? docs[0];
    return { ...baseRegion, docId: doc?.id ?? fallbackDocId };
  });

  const linksMapped: EvidenceLink[] = (raw.links ?? []).map(l => {
    const legacy = l as Omit<EvidenceLink, 'docId'> & { docId?: string };
    if (legacy.docId && docs.some(d => d.id === legacy.docId)) {
      const doc = docs.find(d => d.id === legacy.docId)!;
      return { ...l, docId: legacy.docId, docType: doc.docType };
    }
    const region = regions.find(reg => reg.id === l.region);
    if (region) {
      const doc = docs.find(d => d.id === region.docId);
      return { ...l, docId: region.docId, docType: doc?.docType ?? l.docType };
    }
    const doc = docs.find(d => d.docType === l.docType) ?? docs[0];
    return { ...l, docId: doc?.id ?? fallbackDocId, docType: l.docType };
  });
  /** At most one evidence link per declarant field (across all document tabs). */
  const lastByField = new Map<DeclarantField, EvidenceLink>();
  for (const l of linksMapped) {
    lastByField.set(l.field, l);
  }
  const links = Array.from(lastByField.values());

  const rawManual = Array.isArray((raw as Case).matrixManualConflicts)
    ? [...(raw as Case).matrixManualConflicts!]
    : [];
  const matrixManualConflicts = migrateMatrixManualConflictKeys(docs, rawManual);

  return {
    ...raw,
    fields: { ...DEFAULT_CASE_FIELDS, ...(raw.fields ?? {}) },
    docs,
    regions,
    links,
    matrixManualConflicts,
  };
}

/** Deep clone for editor baseline and discard restore. */
function cloneCaseDeep(c: Case): Case {
  return normalizeCase({
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt as unknown as string),
    fields: { ...c.fields },
    docs: c.docs.map(d => ({ ...d })),
    regions: c.regions.map(r => ({
      ...r,
      pageNorm: r.pageNorm ? { ...r.pageNorm } : undefined,
    })),
    links: c.links.map(l => ({ ...l })),
    comments: c.comments.map(cm => ({
      ...cm,
      timestamp: cm.timestamp instanceof Date ? cm.timestamp : new Date(cm.timestamp as unknown as string),
    })),
    matrixManualConflicts: [...(c.matrixManualConflicts ?? [])],
  });
}

// ============== MATRIX CELL HELPERS (shared: writer stale lane + review matrix) ==============

const MATRIX_FIELDS: DeclarantField[] = [
  'hsCode', 'originCountry', 'destCountry', 'invoiceAmount', 'netWeight',
  'grossWeight', 'exitCustoms', 'iban', 'others'
];

/** Sentinel doc column id when a case has no attachments — matrix cells stay clickable for declarant edits. */
const MATRIX_NO_FILE_COLUMN_ID = '__matrix_no_files__';

type MatrixCellVisual = 'none' | 'na' | 'stale' | 'orange' | 'linked' | 'conflict';

function matrixCellKey(field: DeclarantField, docId: string): string {
  return `${field}:${docId}`;
}

function getMatchingLinksForMatrixCell(c: Case, field: DeclarantField, docId: string): EvidenceLink[] {
  return c.links.filter(l => l.field === field && l.docId === docId);
}

/** Matrix cell color/icon: gray empty, N/A when linked on another doc, orange value+no link anywhere, green linked, stale, red conflict. */
function getMatrixCellVisual(
  c: Case,
  field: DeclarantField,
  docId: string,
  fieldValueOverrides?: Partial<Record<DeclarantField, string>>,
): MatrixCellVisual {
  const key = matrixCellKey(field, docId);
  const manual = (c.matrixManualConflicts ?? []).includes(key);
  const rawVal = fieldValueOverrides?.[field] ?? c.fields[field] ?? '';
  const hasValue = rawVal.trim().length > 0;
  const matching = getMatchingLinksForMatrixCell(c, field, docId);

  if (manual) return 'conflict';
  if (matching.some(l => l.status === 'conflict')) return 'conflict';
  if (matching.length === 0 && c.links.some(l => l.field === field)) return 'na';
  if (hasValue && matching.length === 0) return 'orange';
  if (matching.some(l => l.status === 'stale')) return 'stale';
  if (hasValue && matching.some(l => l.status === 'linked')) return 'linked';
  if (!hasValue && matching.length === 0) return 'none';
  if (!hasValue && matching.length > 0) return 'stale';
  return 'none';
}

function countMatrixCells(
  c: Case,
  visual: MatrixCellVisual,
  fieldValueOverrides?: Partial<Record<DeclarantField, string>>,
  columnDocIds?: string[],
): number {
  const cols = columnDocIds ?? c.docs.map(d => d.id);
  let n = 0;
  for (const field of MATRIX_FIELDS) {
    for (const docId of cols) {
      if (getMatrixCellVisual(c, field, docId, fieldValueOverrides) === visual) n++;
    }
  }
  return n;
}

/** True if the review matrix would flag missing/stale evidence: stale link, or declarant value with no link (orange). */
function caseWriterMatrixShowsMissingEvidence(c: Case): boolean {
  const cols = c.docs.length > 0 ? c.docs.map(d => d.id) : [MATRIX_NO_FILE_COLUMN_ID];
  for (const field of MATRIX_FIELDS) {
    for (const docId of cols) {
      const v = getMatrixCellVisual(c, field, docId);
      if (v === 'stale' || v === 'orange') return true;
    }
  }
  return false;
}

/** While a case is still with the writer (drafting or returned), matrix stale or unlinked-value cells move it to the Missing ev. column. */
function upgradeDraftingToMissingEvIfStale(c: Case): Case {
  if (c.status !== 'drafting' && c.status !== 'returned') return c;
  if (!caseWriterMatrixShowsMissingEvidence(c)) return c;
  return { ...c, status: 'missing_ev' };
}

/** When missing-ev signals are gone, move the case back to drafting (writer kanban). */
function downgradeMissingEvToDraftIfClear(c: Case): Case {
  if (c.status !== 'missing_ev') return c;
  if (caseWriterMatrixShowsMissingEvidence(c)) return c;
  return { ...c, status: 'drafting' };
}

/** Apply drafting / returned ↔ missing_ev from evidence matrix rules (writer-facing lanes). */
function normalizeWriterFacingKanbanStatus(c: Case): Case {
  if (c.status === 'drafting' || c.status === 'returned') {
    return upgradeDraftingToMissingEvIfStale(c);
  }
  if (c.status === 'missing_ev') {
    return downgradeMissingEvToDraftIfClear(c);
  }
  return c;
}

function mergePendingMatrixFields(
  c: Case,
  pending: Partial<Record<DeclarantField, string>>,
): Case {
  const keys = Object.keys(pending) as DeclarantField[];
  if (keys.length === 0) return c;
  return { ...c, fields: { ...c.fields, ...pending } };
}

/**
 * Fingerprint for “unsaved edits” in the case editor: omits `status` so automatic
 * drafting ↔ missing_ev kanban moves (evidence matrix rules) do not flip the Not saved hint.
 */
function caseEditorDraftDirtyFingerprint(c: Case): string {
  return JSON.stringify({
    title: c.title,
    fields: c.fields,
    docs: c.docs.map(d => ({ id: d.id, name: d.name, docType: d.docType, dataUrl: d.dataUrl })),
    links: c.links.map(l => ({
      field: l.field,
      docId: l.docId,
      region: l.region,
      status: l.status,
      value: l.value,
      docType: l.docType,
    })),
    regions: c.regions.map(r => ({
      id: r.id,
      docId: r.docId,
      x: r.x,
      y: r.y,
      widthPct: r.widthPct,
      heightPct: r.heightPct,
      pageNorm: r.pageNorm,
    })),
    comments: c.comments.map(cm => ({
      author: cm.author,
      text: cm.text,
      t: cm.timestamp instanceof Date ? cm.timestamp.getTime() : new Date(cm.timestamp).getTime(),
    })),
    mm: [...(c.matrixManualConflicts ?? [])].slice().sort(),
  });
}

/** Compare case content for “unsaved changes” (excludes id/createdBy/createdAt drift). */
function caseEditorContentFingerprint(c: Case): string {
  return JSON.stringify({
    title: c.title,
    status: c.status,
    fields: c.fields,
    docs: c.docs.map(d => ({ id: d.id, name: d.name, docType: d.docType, dataUrl: d.dataUrl })),
    links: c.links.map(l => ({
      field: l.field,
      docId: l.docId,
      region: l.region,
      status: l.status,
      value: l.value,
      docType: l.docType,
    })),
    regions: c.regions.map(r => ({
      id: r.id,
      docId: r.docId,
      x: r.x,
      y: r.y,
      widthPct: r.widthPct,
      heightPct: r.heightPct,
      pageNorm: r.pageNorm,
    })),
    comments: c.comments.map(cm => ({
      author: cm.author,
      text: cm.text,
      t: cm.timestamp instanceof Date ? cm.timestamp.getTime() : new Date(cm.timestamp).getTime(),
    })),
    mm: [...(c.matrixManualConflicts ?? [])].slice().sort(),
  });
}

/** Draft with no uploads, links, regions, comments, matrix flags, and all declarant fields blank. */
function isWriterPristineDraftCase(c: Case): boolean {
  if (c.status !== 'drafting') return false;
  if (c.docs.length > 0 || c.links.length > 0 || c.regions.length > 0 || c.comments.length > 0) return false;
  if ((c.matrixManualConflicts ?? []).length > 0) return false;
  return Object.values(c.fields).every(v => !v || String(v).trim() === '');
}

const SYNC_CHANNEL = 'customsCaseManager-5176-sync';
const STORAGE_KEY_APP = 'customsCaseManager';
const LS_SKIP_UNSAVED_LEAVE = 'port5176_skipUnsavedLeavePrompt';

function skipUnsavedLeaveStored(): boolean {
  try {
    return localStorage.getItem(LS_SKIP_UNSAVED_LEAVE) === '1';
  } catch {
    return false;
  }
}

function persistSkipUnsavedLeave(): void {
  try {
    localStorage.setItem(LS_SKIP_UNSAVED_LEAVE, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

function hydrateCasesAndNotifications(parsed: AppState): {
  cases: Case[];
  notifications: Notification[];
} {
  const rawCases = Array.isArray(parsed.cases) ? parsed.cases : [];
  const cases: Case[] = [];
  for (const c of rawCases) {
    if (!c || typeof c !== 'object') continue;
    try {
      cases.push(
        normalizeCase({
          ...(c as Case),
          createdAt: new Date((c as Case).createdAt),
          regions: (c as Case).regions || [],
          comments: ((c as Case).comments || []).map(comment => ({
            ...comment,
            timestamp: new Date(comment.timestamp),
          })),
        }),
      );
    } catch {
      /* omit a single corrupt case instead of failing the whole bundle */
    }
  }
  return {
    cases,
    notifications: (parsed.notifications ?? []).map(n => ({
      ...n,
      timestamp: new Date(n.timestamp),
    })),
  };
}

function sampleCasesNormalized(): Case[] {
  return (SEED_CASES as unknown as Case[]).map(normalizeCase);
}

// ============== MAIN APP COMPONENT ==============

export default function Port5176App() {
  const [view, setView] = useState<View>('login');
  const [user, setUser] = useState<User | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [matrixCaseId, setMatrixCaseId] = useState<string | null>(null);
  const [inspectingCell, setInspectingCell] = useState<{ field: DeclarantField; docId: string } | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [notificationFlyoutAnchor, setNotificationFlyoutAnchor] = useState<NotificationFlyoutAnchor | null>(null);
  const notificationsInitializedRef = useRef(false);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  /** True for the next user session init after explicit login/signup (not restore-from-storage). */
  const openNotificationsAfterLoginRef = useRef(false);

  /** Skip next persist when applying remote state (avoids storage/BC echo loops) */
  const skipPersistOnceRef = useRef(false);
  const lastRemotePayloadRef = useRef<string | null>(null);
  const applyRemotePayloadRef = useRef<(json: string) => void>(() => {});
  /**
   * Must be state (not a ref) so the persist effect runs only after the commit that includes
   * rehydrated user/cases. Setting a ref true in useLayoutEffect still lets the first persist
   * effect run with initial user=null / cases=[] and overwrite localStorage before hydration applies.
   */
  const [storageHydrated, setStorageHydrated] = useState(false);

  // Seed + load from localStorage before paint (batched with setStorageHydrated in one commit)
  useLayoutEffect(() => {
    const seeded = localStorage.getItem('seedApplied_v1');
    const savedState = localStorage.getItem(STORAGE_KEY_APP);

    if (!seeded) {
      const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]') as Array<User & { password: string }>;
      const merged = [...existingUsers];
      for (const su of SEED_USERS) {
        const seedNorm = normalizeEmail(su.email);
        if (!merged.some(u => normalizeEmail(u.email) === seedNorm)) {
          merged.push({ ...su, email: seedNorm });
        }
      }
      localStorage.setItem('registeredUsers', JSON.stringify(merged));
      setCases(sampleCasesNormalized());
      localStorage.setItem('seedApplied_v1', '1');
    } else if (!savedState) {
      // seedApplied_v1 set but customsCaseManager was cleared — restore sample cases for demo
      setCases(sampleCasesNormalized());
    }

    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as PersistedAppBundle;
        const hydrated = hydrateCasesAndNotifications(parsed);
        /*
         * - Missing/invalid `cases` → demo seeds
         * - `cases: []` → demo seeds (empty bundle should not leave a blank dashboard)
         * - Non-empty `cases` → hydrated rows; if every row fails migration, fall back to seeds
         */
        let casesToUse = sampleCasesNormalized();
        if (Array.isArray(parsed.cases) && parsed.cases.length > 0) {
          casesToUse = hydrated.cases.length > 0 ? hydrated.cases : sampleCasesNormalized();
        }
        setCases(casesToUse);
        if (Array.isArray(parsed.notifications)) {
          setNotifications(hydrated.notifications);
        }
        if (parsed.user) {
          setUser(parsed.user);
          const nav = resolveRestoredNavigation(parsed.user, casesToUse, parsed);
          setView(nav.view);
          setSelectedCaseId(nav.selectedCaseId);
          setMatrixCaseId(nav.matrixCaseId);
        } else {
          setUser(null);
          setView(parsed.view === 'signup' ? 'signup' : 'login');
          setSelectedCaseId(null);
          setMatrixCaseId(null);
        }
      } catch {
        setCases(sampleCasesNormalized());
      }
    }
    setStorageHydrated(true);
  }, []);

  useLayoutEffect(() => {
    applyRemotePayloadRef.current = (json: string) => {
      if (json === lastRemotePayloadRef.current) return;
      lastRemotePayloadRef.current = json;
      try {
        const parsed = JSON.parse(json) as PersistedAppBundle;
        skipPersistOnceRef.current = true;
        const { cases: hCases, notifications: hNotifs } = hydrateCasesAndNotifications(parsed);
        setCases(hCases);
        setNotifications(hNotifs);
      } catch {
        skipPersistOnceRef.current = false;
      }
    };
  }, []);

  /** Same-origin realtime: other tabs/windows on this machine + BroadcastChannel for instant delivery */
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(SYNC_CHANNEL);
    syncChannelRef.current = bc;
    bc.onmessage = (e: MessageEvent<{ type?: string; payload?: string }>) => {
      if (e.data?.type === 'state' && typeof e.data.payload === 'string') {
        applyRemotePayloadRef.current(e.data.payload);
      }
    };
    return () => {
      bc.close();
      syncChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY_APP || e.newValue == null) return;
      applyRemotePayloadRef.current(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!user) notificationsInitializedRef.current = false;
  }, [user]);

  useEffect(() => {
    if (!storageHydrated || !user) return;
    const mine = notifications.filter(n => notificationVisibleToUser(n, user));
    const ids = new Set(mine.map(n => n.id));
    if (!notificationsInitializedRef.current) {
      notificationsInitializedRef.current = true;
      seenNotificationIdsRef.current = ids;
      const afterLogin = openNotificationsAfterLoginRef.current;
      openNotificationsAfterLoginRef.current = false;
      if (mine.length > 0 && afterLogin) {
        setNotificationFlyoutAnchor(null);
        setNotificationPanelOpen(true);
      }
      return;
    }
    const hasNew = mine.some(n => !seenNotificationIdsRef.current.has(n.id));
    seenNotificationIdsRef.current = ids;
    if (hasNew) {
      setNotificationFlyoutAnchor(null);
      setNotificationPanelOpen(true);
    }
  }, [notifications, user, storageHydrated]);

  // Save state to localStorage (+ broadcast) whenever it changes (never before first rehydrate commit)
  useEffect(() => {
    if (!storageHydrated) return;
    if (skipPersistOnceRef.current) {
      skipPersistOnceRef.current = false;
      return;
    }
    const bundle: PersistedAppBundle = {
      user,
      cases,
      notifications,
      view,
      selectedCaseId,
      matrixCaseId,
    };
    const json = JSON.stringify(bundle);
    localStorage.setItem(STORAGE_KEY_APP, json);
    try {
      syncChannelRef.current?.postMessage({ type: 'state', payload: json });
    } catch {
      // ignore
    }
  }, [storageHydrated, user, cases, notifications, view, selectedCaseId, matrixCaseId]);

  const handleLogin = (loggedInUser: User) => {
    openNotificationsAfterLoginRef.current = true;
    setUser(loggedInUser);
    setView('dashboard');
  };

  const handleSignup = (newUser: User) => {
    openNotificationsAfterLoginRef.current = true;
    setUser(newUser);
    setView('dashboard');
  };

  const handleLogout = () => {
    openNotificationsAfterLoginRef.current = false;
    setNotificationPanelOpen(false);
    setNotificationFlyoutAnchor(null);
    setUser(null);
    setView('login');
    setSelectedCaseId(null);
  };

  const handleOpenCase = (caseId: string) => {
    if (user?.role === 'writer') {
      setSelectedCaseId(caseId);
      setView('editor');
    } else {
      setMatrixCaseId(caseId);
      setView('matrix');
    }
  };

  const handleBackToDashboard = () => {
    setSelectedCaseId(null);
    setMatrixCaseId(null);
    setInspectingCell(null);
    setShowReturnModal(false);
    setView('dashboard');
  };

  const closeNotificationPanel = useCallback(() => {
    setNotificationPanelOpen(false);
    setNotificationFlyoutAnchor(null);
  }, []);

  const handleNotificationBellClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    setNotificationPanelOpen(prev => {
      if (prev) {
        setNotificationFlyoutAnchor(null);
        return false;
      }
      setNotificationFlyoutAnchor(computeNotificationFlyoutAnchor(btn));
      return true;
    });
  }, []);

  const isFullscreen = view === 'dashboard' || view === 'editor' || view === 'matrix';

  return (
    <div className={`app-container${isFullscreen ? ' fullscreen' : ''}`}>
      {user && (view === 'dashboard' || view === 'editor' || view === 'matrix') && (
        <NotificationFlyout
          open={notificationPanelOpen}
          anchor={notificationFlyoutAnchor}
          onDismiss={closeNotificationPanel}
          user={user}
          notifications={notifications}
          setNotifications={setNotifications}
        />
      )}
      {view === 'login' && (
        <LoginPage
          onLogin={handleLogin}
          onSwitchToSignup={() => setView('signup')}
        />
      )}
      {view === 'signup' && (
        <SignupPage
          onSignup={handleSignup}
          onSwitchToLogin={() => setView('login')}
        />
      )}
      {view === 'dashboard' && user && (
        <DashboardPage
          user={user}
          cases={cases}
          notifications={notifications}
          setCases={setCases}
          setNotifications={setNotifications}
          notificationPanelOpen={notificationPanelOpen}
          onNotificationBellClick={handleNotificationBellClick}
          closeNotificationPanel={closeNotificationPanel}
          onLogout={handleLogout}
          onOpenCase={handleOpenCase}
        />
      )}
      {view === 'editor' && user && selectedCaseId && (
        <CaseEditorPage
          user={user}
          caseId={selectedCaseId}
          cases={cases}
          setCases={setCases}
          notifications={notifications}
          setNotifications={setNotifications}
          notificationPanelOpen={notificationPanelOpen}
          onNotificationBellClick={handleNotificationBellClick}
          closeNotificationPanel={closeNotificationPanel}
          onBack={handleBackToDashboard}
          onLogout={handleLogout}
        />
      )}
      {view === 'matrix' && user && matrixCaseId && (
        <ReviewMatrixPage
          key={matrixCaseId}
          user={user}
          caseId={matrixCaseId}
          cases={cases}
          setCases={setCases}
          notifications={notifications}
          setNotifications={setNotifications}
          notificationPanelOpen={notificationPanelOpen}
          onNotificationBellClick={handleNotificationBellClick}
          closeNotificationPanel={closeNotificationPanel}
          inspectingCell={inspectingCell}
          setInspectingCell={setInspectingCell}
          showReturnModal={showReturnModal}
          setShowReturnModal={setShowReturnModal}
          onBack={handleBackToDashboard}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

// ============== LOGIN PAGE ==============

interface LoginPageProps {
  onLogin: (user: User) => void;
  onSwitchToSignup: () => void;
}

function LoginPage({ onLogin, onSwitchToSignup }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    const emailNorm = normalizeEmail(email);
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]') as Array<User & { password: string }>;
    const foundUser = registeredUsers.find(
      u => normalizeEmail(u.email) === emailNorm && u.password === password,
    );

    if (foundUser) {
      const { password: _, ...userWithoutPassword } = foundUser;
      onLogin(userWithoutPassword);
    } else {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-card-top">
        <h1 className="auth-title">Customs Case Manager</h1>
        <p className="auth-subtitle">Sign in to your workspace</p>
      </div>
      <div className="header-divider" aria-hidden="true" />
      <div className="auth-card-body">
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="auth-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
        </div>

        <div className="form-group form-group-password">
          <label htmlFor="password">Password</label>
          <div className="password-input-row">
            <div className="password-input-shell">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                spellCheck={false}
                autoCapitalize="off"
              />
            </div>
            <button
              type="button"
              className="btn-toggle-password"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-auth-submit">
          Log In
        </button>
      </form>

      <p className="auth-switch">
        Don&apos;t have an account?{' '}
        <button type="button" className="link-btn" onClick={onSwitchToSignup}>
          Sign up
        </button>
      </p>
      </div>
    </div>
  );
}

// ============== SIGNUP PAGE ==============

interface SignupPageProps {
  onSignup: (user: User) => void;
  onSwitchToLogin: () => void;
}

function SignupPage({ onSignup, onSwitchToLogin }: SignupPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('writer');
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password || !confirmPassword || !company || !name) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const emailNorm = normalizeEmail(email);
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]') as Array<User & { password: string }>;
    if (registeredUsers.some(u => normalizeEmail(u.email) === emailNorm)) {
      setError('An account with this email already exists');
      return;
    }

    const userWithPassword = { email: emailNorm, password, role, company, name };
    registeredUsers.push(userWithPassword);
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));

    onSignup({ email: emailNorm, role, company, name });
  };

  return (
    <div className="auth-card auth-card--register">
      <div className="auth-card-top">
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Join Customs Case Manager</p>
      </div>
      <div className="header-divider" aria-hidden="true" />
      <div className="auth-card-body">
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="auth-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="signup-email">Email</label>
          <input
            type="email"
            id="signup-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="signup-password">Password</label>
          <input
            type="password"
            id="signup-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            type="password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
          />
        </div>

        <div className="form-group">
          <label htmlFor="role">Role</label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="writer">Case Writer</option>
            <option value="lead_reviewer">Lead Reviewer</option>
            <option value="ceo">CEO</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="company">Company Name</label>
          <input
            type="text"
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Enter your company name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
          />
        </div>

        <button type="submit" className="btn btn-success btn-auth-submit">
          Create Account
        </button>
      </form>

      <p className="auth-switch">
        Already have an account?{' '}
        <button type="button" className="link-btn" onClick={onSwitchToLogin}>
          Log in
        </button>
      </p>
      </div>
    </div>
  );
}

// ============== DASHBOARD PAGE ==============

interface DashboardPageProps {
  user: User;
  cases: Case[];
  notifications: Notification[];
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  notificationPanelOpen: boolean;
  onNotificationBellClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  closeNotificationPanel: () => void;
  onLogout: () => void;
  onOpenCase: (caseId: string) => void;
}

const STATUS_LANES: { status: CaseStatus; label: string; color: string }[] = [
  { status: 'drafting', label: 'DRAFTING', color: '#1e2d40' },
  { status: 'missing_ev', label: 'MISSING EV.', color: '#f59e0b' },
  { status: 'ready_review', label: 'HEAD REVIEWER', color: '#2f6fd4' },
  { status: 'returned', label: 'RETURNED (FIX)', color: '#ef4444' },
  { status: 'completed', label: 'COMPLETED', color: '#22c55e' },
];

/** Main kanban lanes (excludes ceo_review — those cards appear in the COMPLETED column) */
const KANBAN_MAIN_STATUSES: CaseStatus[] = [
  'drafting',
  'missing_ev',
  'ready_review',
  'returned',
];

const KANBAN_TOTAL_COLUMNS = KANBAN_MAIN_STATUSES.length + 1;

const ALL_KANBAN_BOARD_COLUMNS: CaseStatus[] = [...KANBAN_MAIN_STATUSES, 'completed'];

const KANBAN_MULTI_FILTER_OPTIONS: { value: CaseStatus; label: string }[] = [
  ...KANBAN_MAIN_STATUSES.map(s => {
    const lane = STATUS_LANES.find(l => l.status === s)!;
    return { value: s, label: lane.label };
  }),
  { value: 'completed', label: 'COMPLETED' },
];

const KANBAN_EMPTY_LABEL: Record<CaseStatus, string> = {
  drafting: 'No drafts',
  missing_ev: 'None missing',
  ready_review: 'None ready',
  ceo_review: 'Nothing submitted yet',
  returned: 'None returned',
  completed: 'No completed cases',
};

function kanbanHeaderClassForStatus(s: CaseStatus): string {
  switch (s) {
    case 'drafting':
      return 'kanban-col-drafting';
    case 'missing_ev':
      return 'kanban-col-missing';
    case 'ready_review':
      return 'kanban-col-review';
    case 'ceo_review':
      return 'kanban-col-submitted';
    case 'returned':
      return 'kanban-col-returned';
    case 'completed':
      return 'kanban-col-completed';
    default:
      return '';
  }
}

/** Next `Case #N` for new drafts; only considers titles that are exactly `Case #number` (ignores e.g. ERDEMIR #4). */
function nextDefaultCaseTitle(existing: Case[]): string {
  let max = 0;
  for (const c of existing) {
    const m = c.title.trim().match(/^Case\s*#(\d+)\s*$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `Case #${max + 1}`;
}

function DashboardPage({
  user,
  cases,
  notifications,
  setCases,
  setNotifications,
  notificationPanelOpen,
  onNotificationBellClick,
  closeNotificationPanel,
  onLogout,
  onOpenCase
}: DashboardPageProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCompletedHistory, setShowCompletedHistory] = useState(true);
  /** null = all columns visible; otherwise only statuses in the set */
  const [kanbanColumnSelection, setKanbanColumnSelection] = useState<Set<CaseStatus> | null>(null);
  const [showKanbanFilterMenu, setShowKanbanFilterMenu] = useState(false);
  const [kanbanDeleteTarget, setKanbanDeleteTarget] = useState<Case | null>(null);
  /** Writer dashboard: completed cases collapsed at bottom of the list until expanded */
  const [writerCompletedExpanded, setWriterCompletedExpanded] = useState(false);

  const createCase = () => {
    const newCase: Case = {
      id: `case-${Date.now()}`,
      title: nextDefaultCaseTitle(cases),
      createdBy: user.name,
      createdAt: new Date(),
      status: 'drafting',
      fields: {
        hsCode: '',
        originCountry: '',
        destCountry: '',
        invoiceAmount: '',
        netWeight: '',
        grossWeight: '',
        exitCustoms: '',
        iban: '',
        others: '',
      },
      docs: [],
      links: [],
      regions: [],
      comments: [],
      matrixManualConflicts: [],
    };
    setCases(prev => [...prev, newCase]);
    onOpenCase(newCase.id);
  };

  const handleNotificationClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setShowUserMenu(false);
    setShowKanbanFilterMenu(false);
    onNotificationBellClick(e);
  };

  const filterCases = (status: CaseStatus): Case[] => {
    return cases.filter(c => c.status === status);
  };

  const getFilledFieldsCount = (c: Case): number => {
    return Object.values(c.fields).filter(v => v.trim() !== '').length;
  };

  const getConflictsCount = (c: Case): number => {
    return c.links.filter(l => l.status === 'conflict').length;
  };

  const myNotifications = notifications.filter(n => notificationVisibleToUser(n, user));
  const unreadCount = myNotifications.filter(n => !n.read).length;
  const userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Count of flagged (returned) cases for the writer view
  const flaggedCount = cases.filter(c => c.status === 'returned').length;

  // Get status pill info
  const getStatusPill = (status: CaseStatus): { label: string; color: string } => {
    switch (status) {
      case 'drafting': return { label: 'Draft', color: '#64748b' };
      case 'missing_ev': return { label: 'Missing Ev.', color: '#f59e0b' };
      case 'ready_review':
        return user.role === 'writer'
          ? { label: 'Submitted', color: '#2f6fd4' }
          : { label: 'Head Reviewer', color: '#2f6fd4' };
      case 'ceo_review': return { label: 'Pending CEO', color: '#0e7490' };
      case 'returned': return { label: 'Returned', color: '#ef4444' };
      case 'completed': return { label: 'Completed', color: '#22c55e' };
      default: return { label: 'New', color: '#22c55e' };
    }
  };

  // Generate mock recent activity from cases
  const recentActivity = cases.slice(0, 5).map(c => ({
    id: c.id,
    title: c.title,
    status: c.status,
    createdBy: c.createdBy,
    timestamp: c.createdAt,
  }));

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  useEffect(() => {
    if (!showUserMenu && !notificationPanelOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const n = e.target;
      if (!(n instanceof Element)) return;
      if (
        n.closest('.notification-bell-trigger') ||
        n.closest('.notification-flyout-panel') ||
        n.closest('.user-avatar-wrapper')
      ) {
        return;
      }
      closeNotificationPanel();
      setShowUserMenu(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [showUserMenu, notificationPanelOpen, closeNotificationPanel]);

  useEffect(() => {
    if (!showKanbanFilterMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.kanban-filter-wrapper')) return;
      setShowKanbanFilterMenu(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showKanbanFilterMenu]);

  // Writer Dashboard - Two Column Layout
  if (user.role === 'writer') {
    const writerActiveCases = cases.filter(c => c.status !== 'completed');
    const writerCompletedCases = cases.filter(c => c.status === 'completed');

    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <header className="dashboard-header">
            <h1 className="dashboard-title">DASHBOARD</h1>

            <div className="header-actions">
              <div className="notification-wrapper notification-bell-trigger">
                <button
                  type="button"
                  className="notification-btn"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={handleNotificationClick}
                  aria-label="Notifications"
                  aria-expanded={notificationPanelOpen}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount}</span>
                  )}
                </button>
              </div>

              <div className="user-avatar-wrapper">
                <button
                  className="user-avatar"
                  title={user.name}
                  onClick={() => {
                    closeNotificationPanel();
                    setShowKanbanFilterMenu(false);
                    setShowUserMenu(prev => !prev);
                  }}
                >
                  {userInitials}
                </button>
                {showUserMenu && (
                  <div className="user-menu">
                    <div className="user-menu-info">
                      <div className="user-menu-name">{user.name}</div>
                      <div className="user-menu-email">{user.email}</div>
                      <div className="user-menu-role">{user.role.replace('_', ' ')}</div>
                    </div>
                    <button
                      className="user-menu-item"
                      onClick={() => { setShowUserMenu(false); onLogout(); }}
                    >
                      🚪 Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="header-divider"></div>

          <main className="dashboard-main writer-dashboard">
            <div className="writer-two-column">
              {/* LEFT COLUMN */}
              <div className="writer-left-column">
                {/* Box 1: Open Cases */}
                <div className="writer-box">
                  <div className="writer-box-header">
                    <div className="writer-box-title-row">
                      <span className="writer-box-count">{writerActiveCases.length}</span>
                      <span className="writer-box-label">Open Cases</span>
                      {flaggedCount > 0 && (
                        <span className="writer-flagged-badge">{flaggedCount} Flagged</span>
                      )}
                    </div>
                  </div>
                  <div className="writer-box-divider"></div>
                  <div className="writer-cases-stack">
                    <div className="writer-cases-list">
                      {writerActiveCases.length === 0 ? (
                        <div className="writer-empty-state">
                          <p>
                            {writerCompletedCases.length > 0
                              ? 'No active cases. Completed cases are below.'
                              : 'No cases yet. Create your first case to get started.'}
                          </p>
                        </div>
                      ) : (
                        writerActiveCases.map(c => {
                          const statusPill = getStatusPill(c.status);
                          return (
                            <div
                              key={c.id}
                              className="writer-case-row"
                              onClick={() => onOpenCase(c.id)}
                            >
                              <div className="writer-case-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                              </div>
                              <span className="writer-case-name">{c.title}</span>
                              <span
                                className="writer-status-pill"
                                style={{ backgroundColor: statusPill.color }}
                              >
                                {statusPill.label}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {writerCompletedCases.length > 0 && (
                      <div className="writer-completed-section">
                        <button
                          type="button"
                          className="writer-completed-toggle"
                          aria-expanded={writerCompletedExpanded}
                          onClick={() => setWriterCompletedExpanded(v => !v)}
                        >
                          <span>
                            Completed ({writerCompletedCases.length})
                            {!writerCompletedExpanded ? ' — click to expand' : ''}
                          </span>
                          <span
                            className={
                              'writer-completed-chevron' +
                              (writerCompletedExpanded ? ' writer-completed-chevron--open' : '')
                            }
                            aria-hidden
                          >
                            ▼
                          </span>
                        </button>
                        {writerCompletedExpanded && (
                          <div className="writer-cases-list writer-completed-cases-list">
                            {writerCompletedCases.map(c => {
                              const statusPill = getStatusPill(c.status);
                              return (
                                <div
                                  key={c.id}
                                  className="writer-case-row"
                                  onClick={() => onOpenCase(c.id)}
                                >
                                  <div className="writer-case-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                      <polyline points="14 2 14 8 20 8"></polyline>
                                    </svg>
                                  </div>
                                  <span className="writer-case-name">{c.title}</span>
                                  <span
                                    className="writer-status-pill"
                                    style={{ backgroundColor: statusPill.color }}
                                  >
                                    {statusPill.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Box 2: File Upload */}
                <div className="writer-box">
                  <div className="writer-box-header">
                    <span className="writer-box-label">File Upload</span>
                  </div>
                  <div className="writer-box-divider"></div>
                  <div className="writer-file-upload-content">
                    <div className="writer-file-thumbnails">
                      <div className="writer-file-thumb">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>Invoice...</span>
                      </div>
                      <div className="writer-file-thumb">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span>Folder</span>
                      </div>
                    </div>
                    <div className="writer-drop-zone" onClick={createCase}>
                      <div className="writer-drop-zone-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                      </div>
                      <p className="writer-drop-zone-text">Drag and drop to upload files,<br />Create a new case</p>
                      <button className="btn btn-primary writer-create-case-btn" onClick={(e) => { e.stopPropagation(); createCase(); }}>
                        Create Case
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="writer-right-column">
                {/* Box 1: Recent Activity */}
                <div className="writer-box writer-activity-box">
                  <div className="writer-box-header">
                    <span className="writer-box-label">Recent Activity</span>
                  </div>
                  <div className="writer-box-divider"></div>
                  <div className="writer-activity-list">
                    {recentActivity.length === 0 ? (
                      <div className="writer-empty-state">
                        <p>No recent activity</p>
                      </div>
                    ) : (
                      recentActivity.map(activity => {
                        const statusPill = getStatusPill(activity.status);
                        return (
                          <div key={activity.id} className="writer-activity-item" onClick={() => onOpenCase(activity.id)}>
                            <div className="writer-case-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                              </svg>
                            </div>
                            <div className="writer-activity-info">
                              <div className="writer-activity-title-row">
                                <span className="writer-activity-title">{activity.title}</span>
                                <span
                                  className="writer-status-pill writer-status-pill-sm"
                                  style={{ backgroundColor: statusPill.color }}
                                >
                                  {statusPill.label}
                                </span>
                              </div>
                              <div className="writer-activity-meta">
                                <span>Cr: by {activity.createdBy === user.name ? 'you' : activity.createdBy}</span>
                                <span className="writer-activity-time">{formatTimestamp(activity.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Box 2: Create Case CTA */}
                <div className="writer-box writer-cta-box">
                  <button className="writer-big-create-btn" onClick={createCase}>
                    + Create Case
                  </button>
                  <p className="writer-cta-note">Note: A blank page will be opened for case</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Lead Reviewer / CEO Dashboard - True Kanban Board
  // Get stale count for a case
  const getStaleCount = (c: Case): number => {
    return c.links.filter(l => l.status === 'stale').length;
  };

  // Check if case needs re-uploading (has comments mentioning re-upload or similar)
  const needsReUploading = (c: Case): boolean => {
    return c.comments.some(comment => 
      comment.text.toLowerCase().includes('re-upload') || 
      comment.text.toLowerCase().includes('reupload') ||
      comment.text.toLowerCase().includes('upload again')
    );
  };

  // Check for critical comments
  const getCriticalComments = (c: Case): number => {
    return c.comments.filter(comment => 
      comment.text.toLowerCase().includes('critical') ||
      comment.text.toLowerCase().includes('urgent') ||
      comment.text.toLowerCase().includes('important')
    ).length;
  };

  // Check if case has questions
  const getQuestionCount = (c: Case): number => {
    return c.comments.filter(comment => comment.text.includes('?')).length;
  };

  // Check if needs fixing (returned status has specific fix requirements)
  const getNeedsFixingCount = (c: Case): number => {
    if (c.status !== 'returned') return 0;
    return c.comments.filter(comment => 
      comment.text.toLowerCase().includes('[returned]') ||
      comment.text.toLowerCase().includes('fix') ||
      comment.text.toLowerCase().includes('correct')
    ).length || 1; // At least 1 if returned
  };

  /** Submitted to customs — not deletable from the board */
  const isCaseSubmittedToCustoms = (c: Case) => c.status === 'completed';

  const confirmKanbanDelete = () => {
    if (!kanbanDeleteTarget) return;
    const id = kanbanDeleteTarget.id;
    setCases(prev => prev.filter(c => c.id !== id));
    setNotifications(prev => prev.filter(n => n.caseId !== id));
    setKanbanDeleteTarget(null);
  };

  // Render a kanban card
  const renderKanbanCard = (c: Case) => {
    const filledFields = getFilledFieldsCount(c);
    const conflicts = getConflictsCount(c);
    const staleCount = getStaleCount(c);
    const criticalComments = getCriticalComments(c);
    const questionCount = getQuestionCount(c);
    const needsFixing = getNeedsFixingCount(c);
    const needsReUpload = needsReUploading(c);
    const showDelete =
      (user.role === 'lead_reviewer' || user.role === 'ceo') &&
      !isCaseSubmittedToCustoms(c);
    return (
      <div
        key={c.id}
        className={`kanban-card${showDelete ? ' kanban-card--deletable' : ''}`}
        onClick={() => onOpenCase(c.id)}
      >
        {showDelete && (
          <button
            type="button"
            className="kanban-card-delete"
            aria-label={`Delete ${c.title}`}
            onClick={(e) => {
              e.stopPropagation();
              setKanbanDeleteTarget(c);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        )}
        <div className="kanban-card-header">
          <span className="kanban-card-title">{c.title.length > 18 ? c.title.slice(0, 18) + '...' : c.title}</span>
        </div>
        <div className="kanban-card-author">by {c.createdBy}</div>
        <div className="kanban-card-bullets">
          <div className="kanban-bullet">
            <span className="kanban-bullet-dot" style={{ backgroundColor: filledFields === 9 ? '#2f6fd4' : '#64748b' }}></span>
            <span>Fields {filledFields}/9</span>
          </div>
          {conflicts > 0 && (
            <div className="kanban-bullet kanban-bullet-red">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#ef4444' }}></span>
              <span>Conflicts: {conflicts}</span>
            </div>
          )}
          {staleCount > 0 && (
            <div className="kanban-bullet kanban-bullet-red">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#ef4444' }}></span>
              <span>Stale: {staleCount}</span>
            </div>
          )}
          {c.status === 'missing_ev' && (
            <div className="kanban-bullet kanban-bullet-amber">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#f59e0b' }}></span>
              <span>Due: Today</span>
            </div>
          )}
          {c.status === 'ceo_review' && (
            <div className="kanban-bullet kanban-bullet-amber">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#0e7490' }}></span>
              <span>Awaiting CEO approval</span>
            </div>
          )}
          {questionCount === 0 && (
            <div className="kanban-bullet">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#94a3b8' }}></span>
              <span>No questions</span>
            </div>
          )}
          {questionCount > 0 && (
            <div className="kanban-bullet">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#64748b' }}></span>
              <span>{questionCount} Question{questionCount > 1 ? 's' : ''}</span>
            </div>
          )}
          {criticalComments > 0 && (
            <div className="kanban-bullet kanban-bullet-red">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#ef4444' }}></span>
              <span>{criticalComments} critical comment{criticalComments > 1 ? 's' : ''}</span>
            </div>
          )}
          {needsFixing > 0 && (
            <div className="kanban-bullet kanban-bullet-red">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#ef4444' }}></span>
              <span>Needs fixing: {needsFixing}</span>
            </div>
          )}
          {needsReUpload && (
            <div className="kanban-bullet kanban-bullet-red">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#ef4444' }}></span>
              <span>Needs re-uploading</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLaneColumn = (status: CaseStatus) => {
    const list = filterCases(status);
    const lane = STATUS_LANES.find(l => l.status === status);
    return (
      <div className="kanban-column" key={status}>
        <div className={`kanban-col-header ${kanbanHeaderClassForStatus(status)}`}>
          {lane?.label ?? status}
        </div>
        <div className="kanban-column-scroll">
          {list.map(c => renderKanbanCard(c))}
          {list.length === 0 && (
            <div className="kanban-empty-col">{KANBAN_EMPTY_LABEL[status]}</div>
          )}
        </div>
      </div>
    );
  };

  /** Completed column = customs-completed cases plus lead-submitted (ceo_review) queue */
  const casesInCompletedColumn = (): Case[] => {
    return cases
      .filter(c => c.status === 'completed' || c.status === 'ceo_review')
      .sort((a, b) => {
        if (a.status === 'ceo_review' && b.status !== 'ceo_review') return -1;
        if (a.status !== 'ceo_review' && b.status === 'ceo_review') return 1;
        return 0;
      });
  };

  // Render completed column (CEO: submitted-to-customs toggle only for true completed; lead: plain cards)
  const renderCompletedColumn = () => {
    const laneCases = casesInCompletedColumn();
    const customsCompleted = filterCases('completed');
    const submittedToCustomsCount = customsCompleted.length;
    const isCeo = user.role === 'ceo';

    if (!isCeo) {
      return (
        <div className="kanban-column">
          <div className="kanban-col-header kanban-col-completed">COMPLETED</div>
          <div className="kanban-column-scroll">
            {laneCases.map(c => renderKanbanCard(c))}
            {laneCases.length === 0 && (
              <div className="kanban-empty-col">No completed cases</div>
            )}
          </div>
        </div>
      );
    }

    const pendingCeo = laneCases.filter(c => c.status === 'ceo_review');

    return (
      <div className="kanban-column">
        <div className="kanban-col-header kanban-col-completed">COMPLETED</div>
        {pendingCeo.length === 0 && customsCompleted.length === 0 ? (
          <div className="kanban-empty-col">No completed cases</div>
        ) : (
          <div className="kanban-column-scroll">
            {pendingCeo.map(c => renderKanbanCard(c))}
            {customsCompleted.length > 0 && (
              <>
                {/* Preview card only while history is collapsed (avoids duplicating row when expanded). */}
                {!showCompletedHistory &&
                  customsCompleted.slice(0, 1).map(c => {
                    const filledFields = getFilledFieldsCount(c);
                    return (
                      <div
                        key={c.id}
                        className="kanban-card kanban-card-completed"
                        onClick={() => onOpenCase(c.id)}
                      >
                        <div className="kanban-card-header">
                          <span className="kanban-card-title">
                            {c.title.length > 15 ? c.title.slice(0, 15) + '...' : c.title}
                          </span>
                        </div>
                        <div className="kanban-card-author">by {c.createdBy}</div>
                        <div className="kanban-card-bullets">
                          <div className="kanban-bullet">
                            <span className="kanban-bullet-dot" style={{ backgroundColor: '#f59e0b' }}></span>
                            <span>Fields {filledFields}/10</span>
                          </div>
                          <div className="kanban-bullet kanban-bullet-green">
                            <span className="kanban-bullet-dot" style={{ backgroundColor: '#22c55e' }}></span>
                            <span>Everything correct</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                <button
                  type="button"
                  className="kanban-submitted-btn"
                  onClick={() => setShowCompletedHistory(!showCompletedHistory)}
                >
                  {showCompletedHistory ? 'Hide' : 'Show'} submitted documents
                  <br />
                  <span className="kanban-submitted-count">
                    (
                    {submittedToCustomsCount === 0
                      ? 'none yet'
                      : `${submittedToCustomsCount} ${submittedToCustomsCount === 1 ? 'case' : 'cases'} submitted to customs`}
                    )
                  </span>
                </button>
                {showCompletedHistory && customsCompleted.length > 0 && (
                  <div className="kanban-submission-history">
                    {customsCompleted.map(c => {
                      const dateStr = new Date(c.createdAt).toLocaleDateString();
                      return (
                        <div key={c.id} className="kanban-history-item" onClick={() => onOpenCase(c.id)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                          <div className="kanban-history-info">
                            <span className="kanban-history-title">{c.title}</span>
                            <span className="kanban-history-meta">by {c.createdBy} • {dateStr}</span>
                          </div>
                          <svg className="kanban-history-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const mainKanbanStatusesVisible: CaseStatus[] =
    kanbanColumnSelection === null
      ? KANBAN_MAIN_STATUSES
      : KANBAN_MAIN_STATUSES.filter(s => kanbanColumnSelection.has(s));
  const showCompletedKanbanColumn =
    kanbanColumnSelection === null || kanbanColumnSelection.has('completed');
  const kanbanGridColumnCount =
    mainKanbanStatusesVisible.length + (showCompletedKanbanColumn ? 1 : 0);

  const toggleKanbanColumn = (col: CaseStatus) => {
    setKanbanColumnSelection(prev => {
      if (prev === null) {
        return new Set<CaseStatus>([col]);
      }
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        next.add(col);
      }
      if (next.size === 0 || next.size === ALL_KANBAN_BOARD_COLUMNS.length) {
        return null;
      }
      return next;
    });
  };

  const filterSelectionCount =
    kanbanColumnSelection === null ? null : kanbanColumnSelection.size;

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <header className="dashboard-header">
          <h1 className="dashboard-title">DASHBOARD</h1>

          <div className="header-actions">
            <div className="kanban-filter-wrapper">
              <button
                type="button"
                className="btn-kanban-filter"
                onClick={() => {
                  closeNotificationPanel();
                  setShowUserMenu(false);
                  setShowKanbanFilterMenu(v => !v);
                }}
                aria-expanded={showKanbanFilterMenu}
                aria-haspopup="true"
                aria-label="Filter kanban columns"
              >
                Filter
                {filterSelectionCount != null ? ` (${filterSelectionCount})` : ''} +
              </button>
              {showKanbanFilterMenu && (
                <div className="kanban-filter-dropdown" role="group" aria-label="Column filter">
                  <button
                    type="button"
                    aria-pressed={kanbanColumnSelection === null}
                    className={`kanban-filter-option ${kanbanColumnSelection === null ? 'kanban-filter-option--active' : ''}`}
                    onClick={() => setKanbanColumnSelection(null)}
                  >
                    All columns
                  </button>
                  <div className="kanban-filter-divider" aria-hidden="true" />
                  {KANBAN_MULTI_FILTER_OPTIONS.map(opt => {
                    const checked =
                      kanbanColumnSelection !== null && kanbanColumnSelection.has(opt.value);
                    return (
                      <label key={opt.value} className="kanban-filter-checkbox-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleKanbanColumn(opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <button className="btn btn-primary" onClick={createCase}>
              + Create Case
            </button>

            <div className="notification-wrapper notification-bell-trigger">
              <button
                type="button"
                className="notification-btn"
                onPointerDown={e => e.stopPropagation()}
                onClick={handleNotificationClick}
                aria-label="Notifications"
                aria-expanded={notificationPanelOpen}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </button>
            </div>

            <div className="user-avatar-wrapper">
              <button
                className="user-avatar"
                title={user.name}
                onClick={() => {
                  closeNotificationPanel();
                  setShowKanbanFilterMenu(false);
                  setShowUserMenu(prev => !prev);
                }}
              >
                {userInitials}
              </button>
              {showUserMenu && (
                <div className="user-menu">
                  <div className="user-menu-info">
                    <div className="user-menu-name">{user.name}</div>
                    <div className="user-menu-email">{user.email}</div>
                    <div className="user-menu-role">{user.role.replace('_', ' ')}</div>
                  </div>
                  <button
                    className="user-menu-item"
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                  >
                    🚪 Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="header-divider"></div>

        <main className="dashboard-main reviewer-dashboard">
          {cases.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
              </div>
              <h3 className="empty-state-title">NO CASES YET</h3>
              <p className="empty-state-text">Get started by creating your first customs case.</p>
              <button className="btn btn-primary" onClick={createCase}>
                + Create Your First Case
              </button>
            </div>
          ) : (
            <div
              className={`reviewer-kanban ${kanbanGridColumnCount < KANBAN_TOTAL_COLUMNS ? 'reviewer-kanban--filtered' : ''}`}
              style={
                kanbanGridColumnCount < KANBAN_TOTAL_COLUMNS
                  ? { gridTemplateColumns: `repeat(${kanbanGridColumnCount}, minmax(0, 1fr))` }
                  : undefined
              }
            >
              {mainKanbanStatusesVisible.map(s => renderLaneColumn(s))}
              {showCompletedKanbanColumn && renderCompletedColumn()}
            </div>
          )}
        </main>

        {kanbanDeleteTarget && (
          <div className="modal-overlay" role="presentation" onClick={() => setKanbanDeleteTarget(null)}>
            <div
              className="modal-card kanban-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="kanban-delete-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="kanban-delete-title" className="modal-title">Delete case?</h3>
              <p className="kanban-delete-warning">
                Are you sure? This action cannot be reversed.
              </p>
              <p className="kanban-delete-case-title">{kanbanDeleteTarget.title}</p>
              <div className="modal-actions kanban-delete-actions">
                <button type="button" className="btn btn-modal-cancel" onClick={() => setKanbanDeleteTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmKanbanDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== CASE EDITOR PAGE ==============

interface CaseEditorPageProps {
  user: User;
  caseId: string;
  cases: Case[];
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  notificationPanelOpen: boolean;
  onNotificationBellClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  closeNotificationPanel: () => void;
  onBack: () => void;
  onLogout: () => void;
}

const FIELD_LABELS: Record<DeclarantField, string> = {
  hsCode: 'HS Code',
  originCountry: 'Origin Country',
  destCountry: 'Destination Country',
  invoiceAmount: 'Invoice Amount',
  netWeight: 'Net Weight',
  grossWeight: 'Gross Weight',
  exitCustoms: 'Exit Customs',
  iban: 'IBAN',
  others: 'Others',
};

const DECLARANT_FIELDS_ORDER: DeclarantField[] = [
  'hsCode',
  'originCountry',
  'destCountry',
  'invoiceAmount',
  'netWeight',
  'grossWeight',
  'exitCustoms',
  'iban',
  'others',
];

type WriterSubmitIssue = { field: DeclarantField; kind: 'yellow' | 'red'; message: string };

function fieldHasEvidenceLink(c: Case, field: DeclarantField): boolean {
  return c.links.some(l => l.field === field);
}

function isWriterCaseCompletelyEmpty(c: Case): boolean {
  if (c.docs.length > 0) return false;
  return DECLARANT_FIELDS_ORDER.every(f => !String(c.fields[f] ?? '').trim());
}

function getWriterSubmitIssues(c: Case): WriterSubmitIssue[] {
  const hasFiles = c.docs.length > 0;
  const issues: WriterSubmitIssue[] = [];
  for (const field of DECLARANT_FIELDS_ORDER) {
    const filled = String(c.fields[field] ?? '').trim().length > 0;
    const linked = fieldHasEvidenceLink(c, field);
    if (filled && !linked) {
      issues.push({ field, kind: 'yellow', message: `${FIELD_LABELS[field]} — not linked` });
    } else if (!filled && hasFiles) {
      issues.push({ field, kind: 'red', message: `${FIELD_LABELS[field]} — data field not entered` });
    }
  }
  return issues;
}

function truncateTabLabel(filename: string, maxLen = 22): string {
  if (filename.length <= maxLen) return filename;
  return `${filename.slice(0, maxLen - 1)}…`;
}

function CaseEditorPage({
  user,
  caseId,
  cases,
  setCases,
  notifications,
  setNotifications,
  notificationPanelOpen,
  onNotificationBellClick,
  closeNotificationPanel,
  onBack,
  onLogout,
}: CaseEditorPageProps) {
  const currentCase = cases.find(c => c.id === caseId);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [editingField, setEditingField] = useState<DeclarantField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitExplanationOpen, setSubmitExplanationOpen] = useState(false);
  const [submitExplanationText, setSubmitExplanationText] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // SVG Arrow System State
  const [, setLinkOverlayTick] = useState(0);
  const [draggingField, setDraggingField] = useState<DeclarantField | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  /** When true, clicks on the document add a highlight (avoids accidental placement). */
  const [markEvidenceMode, setMarkEvidenceMode] = useState(false);
  const [docEmptyHintDismissed, setDocEmptyHintDismissed] = useState(false);

  // Refs for arrow positioning
  const editorRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<DeclarantField, HTMLDivElement | null>>({
    hsCode: null,
    originCountry: null,
    destCountry: null,
    invoiceAmount: null,
    netWeight: null,
    grossWeight: null,
    exitCustoms: null,
    iban: null,
    others: null,
  });
  const regionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const docViewerRef = useRef<HTMLDivElement>(null);
  const declarantFieldsRef = useRef<HTMLDivElement>(null);
  const pdfLayoutRef = useRef<PdfPageLayoutInfo | null>(null);
  const [pdfLayout, setPdfLayout] = useState<PdfPageLayoutInfo | null>(null);
  const updatePdfLayout = useCallback((layout: PdfPageLayoutInfo | null) => {
    pdfLayoutRef.current = layout;
    setPdfLayout(layout);
  }, []);
  const commentsListRef = useRef<HTMLDivElement>(null);
  const commentsScrollCaseIdRef = useRef<string | null>(null);
  const commentsScrollPrevLenRef = useRef<number | null>(null);
  /** Case snapshot when this `caseId` was opened; used for dirty check and “don’t save”. */
  const editorBaselineRef = useRef<Case | null>(null);

  useLayoutEffect(() => {
    const c = cases.find(x => x.id === caseId);
    if (!c) {
      editorBaselineRef.current = null;
      return;
    }
    editorBaselineRef.current = cloneCaseDeep(c);
  }, [caseId]);

  const [unsavedLeaveOpen, setUnsavedLeaveOpen] = useState(false);
  const [dontShowUnsavedAgain, setDontShowUnsavedAgain] = useState(false);

  const isEditorDirty = useCallback((): boolean => {
    const baseline = editorBaselineRef.current;
    if (!baseline || !currentCase) return false;
    return caseEditorDraftDirtyFingerprint(currentCase) !== caseEditorDraftDirtyFingerprint(baseline);
  }, [currentCase]);

  /** Mirrors ref-based dirty check for UI (avoid reading refs during render). */
  const [showEditorUnsavedHint, setShowEditorUnsavedHint] = useState(false);
  useEffect(() => {
    setShowEditorUnsavedHint(isEditorDirty());
  }, [currentCase, isEditorDirty]);

  /** Revert to baseline; drop the case entirely if baseline is still an empty writer draft (e.g. new case). */
  const discardEditorToBaseline = useCallback(() => {
    const baseline = editorBaselineRef.current;
    if (!baseline) return;
    const restored = cloneCaseDeep(baseline);
    if (isWriterPristineDraftCase(restored)) {
      setCases(prev => prev.filter(c => c.id !== caseId));
    } else {
      setCases(prev => prev.map(c => (c.id === caseId ? restored : c)));
    }
  }, [caseId, setCases]);

  const handleSaveDraft = useCallback(() => {
    setCases(prev => {
      const next = prev.map(c => {
        if (c.id !== caseId) return c;
        let u = c;
        if (u.status === 'returned') u = { ...u, status: 'drafting' as const };
        return normalizeWriterFacingKanbanStatus(u);
      });
      const cur = next.find(x => x.id === caseId);
      if (cur) editorBaselineRef.current = cloneCaseDeep(cur);
      return next;
    });
    setShowEditorUnsavedHint(false);
  }, [caseId, setCases]);

  const requestEditorBack = useCallback(() => {
    if (skipUnsavedLeaveStored()) {
      if (currentCase && isEditorDirty()) {
        discardEditorToBaseline();
      }
      onBack();
      return;
    }
    if (!isEditorDirty()) {
      if (currentCase && isWriterPristineDraftCase(currentCase)) {
        setCases(prev => prev.filter(c => c.id !== caseId));
      }
      onBack();
      return;
    }
    setDontShowUnsavedAgain(false);
    setUnsavedLeaveOpen(true);
  }, [onBack, isEditorDirty, caseId, setCases, currentCase, discardEditorToBaseline]);

  const editorUnsavedSaveDraftAndLeave = useCallback(() => {
    if (dontShowUnsavedAgain) persistSkipUnsavedLeave();
    handleSaveDraft();
    setUnsavedLeaveOpen(false);
    onBack();
  }, [dontShowUnsavedAgain, handleSaveDraft, onBack]);

  const editorUnsavedLeaveWithoutSave = useCallback(() => {
    if (dontShowUnsavedAgain) persistSkipUnsavedLeave();
    setUnsavedLeaveOpen(false);
    discardEditorToBaseline();
    onBack();
  }, [discardEditorToBaseline, onBack, dontShowUnsavedAgain]);

  useEffect(() => {
    if (!currentCase) return;
    const ids = currentCase.docs.map(d => d.id);
    if (ids.length === 0) {
      setActiveDocId(null);
      return;
    }
    setActiveDocId(prev => (prev !== null && ids.includes(prev) ? prev : ids[0]));
  }, [currentCase?.id, currentCase?.docs]);

  useEffect(() => {
    setMarkEvidenceMode(false);
  }, [activeDocId]);

  useEffect(() => {
    setDocEmptyHintDismissed(false);
  }, [activeDocId]);

  // Get field position relative to editor container
  const getFieldPosition = useCallback((field: DeclarantField): { x: number; y: number } | null => {
    const fieldEl = fieldRefs.current[field];
    const editorEl = editorRef.current;
    if (!fieldEl || !editorEl) return null;

    const fieldRect = fieldEl.getBoundingClientRect();
    const editorRect = editorEl.getBoundingClientRect();

    return {
      x: fieldRect.right - editorRect.left,
      y: fieldRect.top + fieldRect.height / 2 - editorRect.top,
    };
  }, []);

  // Get region position relative to editor container
  const getRegionPosition = useCallback((regionId: string): { x: number; y: number } | null => {
    const regionEl = regionRefs.current[regionId];
    const editorEl = editorRef.current;
    if (!regionEl || !editorEl) return null;

    const regionRect = regionEl.getBoundingClientRect();
    const editorRect = editorEl.getBoundingClientRect();

    return {
      x: regionRect.left + regionRect.width / 2 - editorRect.left,
      y: regionRect.top + regionRect.height / 2 - editorRect.top,
    };
  }, []);

  /** Link SVG reads refs during render; refs are set after commit. Re-render once layout/refs/PDF are ready. */
  const linkOverlayDepsKey =
    currentCase == null
      ? `nocase:${caseId}`
      : [
          caseId,
          activeDocId ?? '',
          editingField ?? '',
          pdfLayout
            ? `${pdfLayout.scale}:${pdfLayout.cw}:${pdfLayout.ch}:${pdfLayout.pageW}:${pdfLayout.pageH}`
            : 'none',
          currentCase.regions
            .map(r => `${r.id}:${r.docId}:${r.x}:${r.y}:${r.widthPct}:${r.heightPct}`)
            .join('|'),
          currentCase.links
            .map(l => `${l.field}:${l.docId}:${l.region}:${l.status}`)
            .join('|'),
        ].join('::');

  useLayoutEffect(() => {
    if (!currentCase) return;
    setLinkOverlayTick(t => t + 1);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setLinkOverlayTick(t => t + 1);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [linkOverlayDepsKey, currentCase]);

  useLayoutEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => {
      setLinkOverlayTick(t => t + 1);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [caseId]);

  useEffect(() => {
    const el = docViewerRef.current;
    if (!el) return;
    const onScroll = () => setLinkOverlayTick(t => t + 1);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [caseId, activeDocId]);

  useEffect(() => {
    const el = declarantFieldsRef.current;
    if (!el) return;
    const onScroll = () => setLinkOverlayTick(t => t + 1);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [caseId]);

  // Generate curved bezier path between two points
  const generatePath = useCallback((start: { x: number; y: number }, end: { x: number; y: number }): string => {
    const midX = (start.x + end.x) / 2;
    const controlOffset = Math.min(80, Math.abs(end.x - start.x) / 3);
    return `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${midX} ${(start.y + end.y) / 2}, ${end.x} ${end.y}`;
  }, []);

  // Start field drag
  const startFieldDrag = useCallback((field: DeclarantField, event: React.MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const editorEl = editorRef.current;
    if (!editorEl) return;

    setDraggingField(field);
    const editorRect = editorEl.getBoundingClientRect();
    setDragPoint({
      x: event.clientX - editorRect.left,
      y: event.clientY - editorRect.top,
    });
  }, []);

  // Update drag position
  const updateDrag = useCallback((event: React.MouseEvent | MouseEvent) => {
    if (!draggingField) return;
    const editorEl = editorRef.current;
    if (!editorEl) return;

    const editorRect = editorEl.getBoundingClientRect();
    setDragPoint({
      x: event.clientX - editorRect.left,
      y: event.clientY - editorRect.top,
    });
  }, [draggingField]);

  // Finish drag - check if over a region
  const finishDrag = useCallback((event: React.MouseEvent | MouseEvent) => {
    if (!draggingField || !currentCase) {
      setDraggingField(null);
      setDragPoint(null);
      return;
    }

    // Check if dropped over any region marker
    const regionIds = Object.keys(regionRefs.current);
    let targetRegion: DocumentRegion | null = null;

    for (const regionId of regionIds) {
      const regionEl = regionRefs.current[regionId];
      if (regionEl) {
        const rect = regionEl.getBoundingClientRect();
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          targetRegion = currentCase.regions.find(r => r.id === regionId) || null;
          break;
        }
      }
    }

    if (targetRegion) {
      const docMeta = currentCase.docs.find(d => d.id === targetRegion!.docId);
      const alreadySame = currentCase.links.some(
        l => l.field === draggingField && l.region === targetRegion!.id,
      );
      if (!alreadySame) {
        const newLink: EvidenceLink = {
          field: draggingField,
          docId: targetRegion.docId,
          docType: docMeta?.docType ?? 'invoice',
          region: targetRegion.id,
          value: currentCase.fields[draggingField] || '',
          status: 'linked',
        };

        setCases(prev =>
          prev.map(c => {
            if (c.id !== caseId) return c;
            const links = c.links.filter(l => l.field !== draggingField);
            return { ...c, links: [...links, newLink] };
          }),
        );
      }
    }

    setDraggingField(null);
    setDragPoint(null);
  }, [draggingField, currentCase, caseId, setCases]);

  // Add document region marker
  const addDocumentRegion = useCallback((docId: string, event: React.MouseEvent) => {
    const docViewerEl = docViewerRef.current;
    if (!docViewerEl) return;

    const L = pdfLayoutRef.current;
    let newRegion: DocumentRegion;

    if (L && L.pageW > 0 && L.pageH > 0) {
      const { x: mx, y: my } = viewerContentPoint(docViewerEl, event.clientX, event.clientY);
      const u = mx / L.scale;
      const v = my / L.scale;
      if (u < 0 || v < 0 || u > L.pageW || v > L.pageH) return;
      const { w, h } = defaultPageNormSize(L);
      const pageNorm: RegionPageNorm = { cx: u / L.pageW, cy: v / L.pageH, w, h };
      const d = pageNormToPercents(pageNorm, L);
      newRegion = {
        id: `region-${Date.now()}`,
        docId,
        x: d.x,
        y: d.y,
        widthPct: d.widthPct,
        heightPct: d.heightPct,
        pageNorm,
      };
    } else {
      const pt = viewerContentPoint(docViewerEl, event.clientX, event.clientY);
      const sw = Math.max(1, docViewerEl.scrollWidth);
      const sh = Math.max(1, docViewerEl.scrollHeight);
      const x = (pt.x / sw) * 100;
      const y = (pt.y / sh) * 100;
      newRegion = {
        id: `region-${Date.now()}`,
        docId,
        x,
        y,
        widthPct: DEFAULT_REGION_SIZE_PCT,
        heightPct: DEFAULT_REGION_SIZE_PCT,
      };
    }

    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return { ...c, regions: [...c.regions, newRegion] };
      }
      return c;
    }));

    setSelectedRegion(newRegion.id);
  }, [caseId, setCases]);

  const beginRegionResize = useCallback(
    (region: DocumentRegion, handle: RegionResizeHandle, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const L = pdfLayoutRef.current;

      if (L) {
        const pn0 =
          region.pageNorm ?? percentsToPageNorm(region.x, region.y, region.widthPct, region.heightPct, L);
        const icx = pn0.cx * L.pageW;
        const icy = pn0.cy * L.pageH;
        const iw = pn0.w * L.pageW;
        const ih = pn0.h * L.pageH;
        const iL = icx - iw / 2;
        const iT = icy - ih / 2;
        const iR = icx + iw / 2;
        const iB = icy + ih / 2;
        const minW = minPageWidth(L);
        const minH = minPageHeight(L);
        const maxW = maxPageWidth(L);
        const maxH = maxPageHeight(L);

        const onMove = (ev: MouseEvent) => {
          const el = docViewerRef.current;
          if (!el) return;
          const pt = viewerContentPoint(el, ev.clientX, ev.clientY);
          const pu = pt.x / L.scale;
          const pv = pt.y / L.scale;

          let ncx = icx;
          let ncy = icy;
          let nw = iw;
          let nh = ih;

          switch (handle) {
            case 'se': {
              const nR = Math.min(L.pageW, Math.max(iL + minW, pu));
              const nB = Math.min(L.pageH, Math.max(iT + minH, pv));
              nw = clamp(nR - iL, minW, maxW);
              nh = clamp(nB - iT, minH, maxH);
              ncx = iL + nw / 2;
              ncy = iT + nh / 2;
              break;
            }
            case 'nw': {
              const nL = Math.max(0, Math.min(iR - minW, pu));
              const nT = Math.max(0, Math.min(iB - minH, pv));
              nw = clamp(iR - nL, minW, maxW);
              nh = clamp(iB - nT, minH, maxH);
              ncx = iR - nw / 2;
              ncy = iB - nh / 2;
              break;
            }
            case 'ne': {
              const nR = Math.min(L.pageW, Math.max(iL + minW, pu));
              const nT = Math.max(0, Math.min(iB - minH, pv));
              nw = clamp(nR - iL, minW, maxW);
              nh = clamp(iB - nT, minH, maxH);
              ncx = iL + nw / 2;
              ncy = iB - nh / 2;
              break;
            }
            case 'sw': {
              const nL = Math.max(0, Math.min(iR - minW, pu));
              const nB = Math.min(L.pageH, Math.max(iT + minH, pv));
              nw = clamp(iR - nL, minW, maxW);
              nh = clamp(nB - iT, minH, maxH);
              ncx = iR - nw / 2;
              ncy = iT + nh / 2;
              break;
            }
            case 'n': {
              const nT = Math.max(0, Math.min(iB - minH, pv));
              nh = clamp(iB - nT, minH, maxH);
              nw = iw;
              ncx = icx;
              ncy = nT + nh / 2;
              break;
            }
          }

          ncx = clamp(ncx, nw / 2, L.pageW - nw / 2);
          ncy = clamp(ncy, nh / 2, L.pageH - nh / 2);

          const pageNorm: RegionPageNorm = {
            cx: ncx / L.pageW,
            cy: ncy / L.pageH,
            w: nw / L.pageW,
            h: nh / L.pageH,
          };
          const d = pageNormToPercents(pageNorm, L);

          setCases(prev =>
            prev.map(c => {
              if (c.id !== caseId) return c;
              return {
                ...c,
                regions: c.regions.map(r =>
                  r.id === region.id
                    ? { ...r, x: d.x, y: d.y, widthPct: d.widthPct, heightPct: d.heightPct, pageNorm }
                    : r,
                ),
              };
            }),
          );
        };

        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return;
      }

      const cx0 = region.x;
      const cy0 = region.y;
      const w0 = region.widthPct;
      const h0 = region.heightPct;
      const L0 = cx0 - w0 / 2;
      const T0 = cy0 - h0 / 2;
      const R0 = cx0 + w0 / 2;
      const B0 = cy0 + h0 / 2;

      const onMoveLegacy = (ev: MouseEvent) => {
        const el = docViewerRef.current;
        if (!el) return;
        const pt = viewerContentPoint(el, ev.clientX, ev.clientY);
        const px = (pt.x / Math.max(1, el.scrollWidth)) * 100;
        const py = (pt.y / Math.max(1, el.scrollHeight)) * 100;

        let ncx = cx0;
        let ncy = cy0;
        let nw = w0;
        let nh = h0;

        switch (handle) {
          case 'se': {
            const nR = Math.min(100, Math.max(L0 + MIN_REGION_SIZE_PCT, px));
            const nB = Math.min(100, Math.max(T0 + MIN_REGION_SIZE_PCT, py));
            nw = clampRegionDimension(nR - L0);
            nh = clampRegionDimension(nB - T0);
            ncx = L0 + nw / 2;
            ncy = T0 + nh / 2;
            break;
          }
          case 'nw': {
            const nL = Math.max(0, Math.min(R0 - MIN_REGION_SIZE_PCT, px));
            const nT = Math.max(0, Math.min(B0 - MIN_REGION_SIZE_PCT, py));
            nw = clampRegionDimension(R0 - nL);
            nh = clampRegionDimension(B0 - nT);
            ncx = R0 - nw / 2;
            ncy = B0 - nh / 2;
            break;
          }
          case 'ne': {
            const nR = Math.min(100, Math.max(L0 + MIN_REGION_SIZE_PCT, px));
            const nT = Math.max(0, Math.min(B0 - MIN_REGION_SIZE_PCT, py));
            nw = clampRegionDimension(nR - L0);
            nh = clampRegionDimension(B0 - nT);
            ncx = L0 + nw / 2;
            ncy = B0 - nh / 2;
            break;
          }
          case 'sw': {
            const nL = Math.max(0, Math.min(R0 - MIN_REGION_SIZE_PCT, px));
            const nB = Math.min(100, Math.max(T0 + MIN_REGION_SIZE_PCT, py));
            nw = clampRegionDimension(R0 - nL);
            nh = clampRegionDimension(nB - T0);
            ncx = R0 - nw / 2;
            ncy = T0 + nh / 2;
            break;
          }
          case 'n': {
            const nT = Math.max(0, Math.min(B0 - MIN_REGION_SIZE_PCT, py));
            nh = clampRegionDimension(B0 - nT);
            nw = w0;
            ncx = cx0;
            ncy = nT + nh / 2;
            break;
          }
        }

        ncx = Math.max(nw / 2, Math.min(100 - nw / 2, ncx));
        ncy = Math.max(nh / 2, Math.min(100 - nh / 2, ncy));

        setCases(prev =>
          prev.map(c => {
            if (c.id !== caseId) return c;
            return {
              ...c,
              regions: c.regions.map(r =>
                r.id === region.id ? { ...r, x: ncx, y: ncy, widthPct: nw, heightPct: nh } : r,
              ),
            };
          }),
        );
      };

      const onUpLegacy = () => {
        document.removeEventListener('mousemove', onMoveLegacy);
        document.removeEventListener('mouseup', onUpLegacy);
      };

      document.addEventListener('mousemove', onMoveLegacy);
      document.addEventListener('mouseup', onUpLegacy);
    },
    [caseId, setCases],
  );

  const beginRegionDrag = useCallback(
    (region: DocumentRegion, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest('.region-marker-handle') || t.closest('.region-marker-trash')) return;
      e.stopPropagation();
      e.preventDefault();
      const startCX = e.clientX;
      const startCY = e.clientY;
      const L = pdfLayoutRef.current;

      if (L) {
        const el0 = docViewerRef.current;
        if (!el0) return;
        const startPt = viewerContentPoint(el0, startCX, startCY);
        const pn0 =
          region.pageNorm ?? percentsToPageNorm(region.x, region.y, region.widthPct, region.heightPct, L);
        const origU = pn0.cx * L.pageW;
        const origV = pn0.cy * L.pageH;
        const hw = (pn0.w * L.pageW) / 2;
        const hh = (pn0.h * L.pageH) / 2;

        const onMove = (ev: MouseEvent) => {
          const el = docViewerRef.current;
          if (!el) return;
          const cur = viewerContentPoint(el, ev.clientX, ev.clientY);
          const du = (cur.x - startPt.x) / L.scale;
          const dv = (cur.y - startPt.y) / L.scale;
          let nu = origU + du;
          let nv = origV + dv;
          nu = clamp(nu, hw, L.pageW - hw);
          nv = clamp(nv, hh, L.pageH - hh);
          const pageNorm: RegionPageNorm = {
            cx: nu / L.pageW,
            cy: nv / L.pageH,
            w: pn0.w,
            h: pn0.h,
          };
          const d = pageNormToPercents(pageNorm, L);
          setCases(prev =>
            prev.map(c => {
              if (c.id !== caseId) return c;
              return {
                ...c,
                regions: c.regions.map(r =>
                  r.id === region.id
                    ? { ...r, x: d.x, y: d.y, widthPct: d.widthPct, heightPct: d.heightPct, pageNorm }
                    : r,
                ),
              };
            }),
          );
        };

        const onUp = (ev: MouseEvent) => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          const moved = (ev.clientX - startCX) ** 2 + (ev.clientY - startCY) ** 2 > 36;
          if (!moved) {
            setSelectedRegion(cur => (cur === region.id ? null : region.id));
          }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return;
      }

      const { x: origX, y: origY } = region;
      const el0 = docViewerRef.current;
      if (!el0) return;
      const startPtLegacy = viewerContentPoint(el0, startCX, startCY);
      const onMoveLegacy = (ev: MouseEvent) => {
        const el = docViewerRef.current;
        if (!el) return;
        const cur = viewerContentPoint(el, ev.clientX, ev.clientY);
        const nx = Math.max(
          0,
          Math.min(100, origX + ((cur.x - startPtLegacy.x) / Math.max(1, el.scrollWidth)) * 100),
        );
        const ny = Math.max(
          0,
          Math.min(100, origY + ((cur.y - startPtLegacy.y) / Math.max(1, el.scrollHeight)) * 100),
        );
        setCases(prev =>
          prev.map(c => {
            if (c.id !== caseId) return c;
            return {
              ...c,
              regions: c.regions.map(r => (r.id === region.id ? { ...r, x: nx, y: ny } : r)),
            };
          }),
        );
      };

      const onUpLegacy = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', onMoveLegacy);
        document.removeEventListener('mouseup', onUpLegacy);
        const moved = (ev.clientX - startCX) ** 2 + (ev.clientY - startCY) ** 2 > 36;
        if (!moved) {
          setSelectedRegion(cur => (cur === region.id ? null : region.id));
        }
      };

      document.addEventListener('mousemove', onMoveLegacy);
      document.addEventListener('mouseup', onUpLegacy);
    },
    [caseId, setCases],
  );

  const updateRegionDimensions = useCallback(
    (regionId: string, patch: { widthPct?: number; heightPct?: number }) => {
      const L = pdfLayoutRef.current;
      setCases(prev =>
        prev.map(c => {
          if (c.id !== caseId) return c;
          return {
            ...c,
            regions: c.regions.map(r => {
              if (r.id !== regionId) return r;
              const widthPct =
                patch.widthPct != null ? clampRegionDimension(patch.widthPct) : r.widthPct;
              const heightPct =
                patch.heightPct != null ? clampRegionDimension(patch.heightPct) : r.heightPct;
              if (L) {
                const base =
                  r.pageNorm ?? percentsToPageNorm(r.x, r.y, r.widthPct, r.heightPct, L);
                const pageNorm: RegionPageNorm = {
                  cx: base.cx,
                  cy: base.cy,
                  w: ((widthPct / 100) * L.cw) / L.scale / L.pageW,
                  h: ((heightPct / 100) * L.ch) / L.scale / L.pageH,
                };
                const d = pageNormToPercents(pageNorm, L);
                return { ...r, x: d.x, y: d.y, widthPct, heightPct, pageNorm };
              }
              return { ...r, widthPct, heightPct };
            }),
          };
        }),
      );
    },
    [caseId, setCases],
  );

  // Remove the single evidence link for this field (if any).
  const removeLink = useCallback((field: DeclarantField) => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          links: c.links.filter(l => l.field !== field),
        };
      }
      return c;
    }));
  }, [caseId, setCases]);

  // Remove region
  const removeRegion = useCallback((regionId: string) => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          regions: c.regions.filter(r => r.id !== regionId),
          links: c.links.filter(l => l.region !== regionId),
        };
      }
      return c;
    }));
    setSelectedRegion(null);
  }, [caseId, setCases]);

  // Mouse event handlers
  useEffect(() => {
    if (draggingField) {
      const handleMouseMove = (e: MouseEvent) => updateDrag(e);
      const handleMouseUp = (e: MouseEvent) => finishDrag(e);

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingField, updateDrag, finishDrag]);

  useEffect(() => {
    if (!showUserMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.closest('.user-avatar-wrapper') ||
        t.closest('.notification-bell-trigger') ||
        t.closest('.notification-flyout-panel')
      ) {
        return;
      }
      setShowUserMenu(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showUserMenu]);

  useLayoutEffect(() => {
    const el = commentsListRef.current;
    const len = currentCase?.comments.length ?? 0;
    if (!el) return;

    const sameCase = commentsScrollCaseIdRef.current === caseId;
    commentsScrollCaseIdRef.current = caseId;

    if (!sameCase) {
      commentsScrollPrevLenRef.current = len;
      if (len > 0) {
        el.scrollTop = el.scrollHeight;
      }
      return;
    }

    const prev = commentsScrollPrevLenRef.current ?? 0;
    commentsScrollPrevLenRef.current = len;
    if (len > prev) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [caseId, currentCase?.comments.length]);

  const writerSubmitIssues = useMemo(
    () => (currentCase ? getWriterSubmitIssues(currentCase) : []),
    [currentCase],
  );
  const writerCaseCompletelyEmpty = useMemo(
    () => (currentCase ? isWriterCaseCompletelyEmpty(currentCase) : true),
    [currentCase],
  );
  const writerCaseHasNoFiles = !currentCase || currentCase.docs.length === 0;

  const canSendSubmitFiles = useMemo(() => {
    if (!currentCase) return false;
    if (writerCaseCompletelyEmpty) return false;
    if (writerCaseHasNoFiles) return false;
    if (writerSubmitIssues.length === 0) return true;
    return submitExplanationText.trim().length > 0;
  }, [
    currentCase,
    writerCaseCompletelyEmpty,
    writerCaseHasNoFiles,
    writerSubmitIssues.length,
    submitExplanationText,
  ]);

  const closeSubmitModal = useCallback(() => {
    setShowSubmitModal(false);
    setSubmitExplanationOpen(false);
    setSubmitExplanationText('');
  }, []);

  const handleSubmitCase = () => {
    setSubmitExplanationOpen(false);
    setSubmitExplanationText('');
    setShowSubmitModal(true);
  };

  const confirmSubmit = () => {
    if (!currentCase || !canSendSubmitFiles) return;
    const note = submitExplanationText.trim();
    setCases(prev =>
      prev.map(c => {
        if (c.id !== caseId) return c;
        const writerExitLaneAtReviewSubmit: 'drafting' | 'missing_ev' =
          c.status === 'missing_ev' ? 'missing_ev' : 'drafting';
        let next: Case = {
          ...c,
          status: 'ready_review',
          writerExitLaneAtReviewSubmit,
        };
        if (note) {
          next = {
            ...next,
            comments: [
              ...next.comments,
              {
                author: user.name,
                text: `Submission note: ${note}`,
                timestamp: new Date(),
              },
            ],
          };
        }
        return next;
      }),
    );
    setNotifications(prev => [
      ...prev,
      {
        id: `notif-${Date.now()}`,
        message: `${currentCase.title || 'Case'} has been submitted for review`,
        caseId,
        timestamp: new Date(),
        read: false,
        audienceRole: 'lead_reviewer',
      },
    ]);
    closeSubmitModal();
    onBack();
  };

  const activeDoc =
    currentCase && activeDocId ? currentCase.docs.find(d => d.id === activeDocId) : undefined;
  const currentDocs = activeDoc ? [activeDoc] : [];
  const hasDocs = (currentCase?.docs.length ?? 0) > 0;
  const activeDocIsPdf =
    currentDocs.length > 0 && currentDocs[0].dataUrl.startsWith('data:application/pdf');

  useEffect(() => {
    if (!activeDocIsPdf) {
      updatePdfLayout(null);
    }
  }, [activeDocIsPdf, activeDocId, updatePdfLayout]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isEditorDirty()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isEditorDirty]);

  const editorStaleFingerprint = useMemo(
    () => (currentCase ? caseEditorContentFingerprint(currentCase) : ''),
    [currentCase],
  );

  useEffect(() => {
    if (!currentCase || currentCase.id !== caseId) return;
    setCases(prev => {
      const idx = prev.findIndex(x => x.id === caseId);
      if (idx < 0) return prev;
      const c = prev[idx];
      let next = c;
      if (c.status === 'drafting' || c.status === 'returned') {
        next = upgradeDraftingToMissingEvIfStale(c);
      } else if (c.status === 'missing_ev') {
        next = downgradeMissingEvToDraftIfClear(c);
      }
      if (next === c) return prev;
      const out = [...prev];
      out[idx] = next;
      return out;
    });
  }, [editorStaleFingerprint, caseId, setCases, currentCase]);

  if (!currentCase) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className="empty-state-title">CASE NOT FOUND</h3>
            <p className="empty-state-text">The requested case could not be located.</p>
            <button className="btn btn-primary" onClick={onBack}>Go Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  const userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const myNotifications = notifications.filter(n => notificationVisibleToUser(n, user));
  const unreadBellCount = myNotifications.filter(n => !n.read).length;

  const handleFieldEdit = (field: DeclarantField) => {
    setEditingField(field);
    setEditValue(currentCase.fields[field]);
  };

  const handleFieldSave = (field: DeclarantField, value: string) => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          fields: { ...c.fields, [field]: value }
        };
      }
      return c;
    }));
    setEditingField(null);
    setEditValue('');
  };

  const handleFieldCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const slotsLeft = Math.max(0, MAX_DOCUMENTS_PER_CASE - currentCase.docs.length);
    const toRead = Array.from(files).slice(0, slotsLeft);
    const lastFileInBatch = toRead[toRead.length - 1];

    toRead.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const newDoc: UploadedDoc = {
          id: newId,
          name: file.name,
          docType: DEFAULT_WRITER_DOC_TYPE,
          dataUrl,
        };
        setCases(prev => prev.map(c => {
          if (c.id === caseId) {
            return { ...c, docs: [...c.docs, newDoc] };
          }
          return c;
        }));
        if (file === lastFileInBatch) {
          setActiveDocId(newId);
        }
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const handleAddComment = (text: string) => {
    if (!text.trim()) return;
    const newComment = {
      author: user.name,
      text: text.trim(),
      timestamp: new Date(),
    };
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return { ...c, comments: [...c.comments, newComment] };
      }
      return c;
    }));
    setNewCommentText('');
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <header className="dashboard-header">
          <button className="btn-back" onClick={requestEditorBack} aria-label="Go back to dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div className="dashboard-title-block">
            <h1 className="dashboard-title">{currentCase.title.toUpperCase()}</h1>
            {showEditorUnsavedHint && (
              <span className="editor-unsaved-hint" role="status">
                Not saved
              </span>
            )}
          </div>
          <div className="header-actions editor-matrix-header-actions">
            <div className="notification-wrapper notification-bell-trigger">
              <button
                type="button"
                className="notification-btn"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  setShowUserMenu(false);
                  onNotificationBellClick(e);
                }}
                aria-label="Notifications"
                aria-expanded={notificationPanelOpen}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadBellCount > 0 && (
                  <span className="notification-badge">{unreadBellCount}</span>
                )}
              </button>
            </div>
            <div className="user-avatar-wrapper">
              <button
                type="button"
                className="user-avatar"
                title={user.name}
                onClick={() => {
                  closeNotificationPanel();
                  setShowUserMenu(v => !v);
                }}
              >
                {userInitials}
              </button>
              {showUserMenu && (
                <div className="user-menu">
                  <div className="user-menu-info">
                    <div className="user-menu-name">{user.name}</div>
                    <div className="user-menu-email">{user.email}</div>
                    <div className="user-menu-role">{user.role.replace('_', ' ')}</div>
                  </div>
                  <button
                    type="button"
                    className="user-menu-item"
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                  >
                    🚪 Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="header-divider"></div>

        <main className="editor-main">
          <div className="editor-panels" ref={editorRef}>
            {/* SVG ARROW OVERLAY */}
            <svg className="editor-svg-overlay">
              <defs>
                {/* Blue arrowhead — midpoint trash control uses its own red pill (link-label-bg). */}
                <marker
                  id="arrowhead-blue"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#2f6fd4" />
                </marker>
                {/* Amber arrowhead for dragging */}
                <marker
                  id="arrowhead-conflict"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                </marker>
                <marker
                  id="arrowhead-amber"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
                </marker>
              </defs>

              {/* Persistent link arrows (only for the active document tab) */}
              {currentCase.links
                .filter(link => {
                  const region = currentCase.regions.find(r => r.id === link.region);
                  return region?.docId === activeDocId;
                })
                .map(link => {
                const fieldPos = getFieldPosition(link.field);
                const regionPos = getRegionPosition(link.region);
                if (!fieldPos || !regionPos) return null;
                if (
                  !evidenceLinkAnchorsInView(
                    regionRefs.current[link.region],
                    fieldRefs.current[link.field],
                    docViewerRef.current,
                    declarantFieldsRef.current,
                  )
                ) {
                  return null;
                }

                const pathD = generatePath(fieldPos, regionPos);
                const midX = (fieldPos.x + regionPos.x) / 2;
                const midY = (fieldPos.y + regionPos.y) / 2;

                return (
                  <g key={`${link.field}-${link.docId}-${link.region}`}>
                    <path
                      d={pathD}
                      className={`link-line ${link.status === 'conflict' ? 'link-line-conflict' : ''}`}
                      markerEnd={
                        link.status === 'conflict' ? 'url(#arrowhead-conflict)' : 'url(#arrowhead-blue)'
                      }
                    />
                    {/* Midpoint control: remove evidence link */}
                    <g className="link-label-group" onClick={() => removeLink(link.field)}>
                      <title>{`Remove evidence link (${FIELD_LABELS[link.field]})`}</title>
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x={-14}
                          y={-14}
                          width={28}
                          height={28}
                          rx={8}
                          className="link-label-bg"
                        />
                        <path
                          fill="#ffffff"
                          transform="translate(-12, -12)"
                          d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm13-14h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </g>
                    </g>
                    {/* Conflict marker */}
                    {link.status === 'conflict' && (
                      <g transform={`translate(${midX + 36}, ${midY})`}>
                        <circle r="10" fill="#ef4444" />
                        <path
                          d="M-4 -4 L4 4 M-4 4 L4 -4"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Drag in progress arrow */}
              {draggingField && dragPoint && (() => {
                const fieldPos = getFieldPosition(draggingField);
                if (!fieldPos) return null;
                const editorEl = editorRef.current;
                const docEl = docViewerRef.current;
                const declEl = declarantFieldsRef.current;
                const fieldEl = fieldRefs.current[draggingField];
                if (editorEl && docEl && declEl && fieldEl) {
                  const er = editorEl.getBoundingClientRect();
                  const dcx = dragPoint.x + er.left;
                  const dcy = dragPoint.y + er.top;
                  if (
                    !clientPointInsideRect(dcx, dcy, docEl.getBoundingClientRect()) ||
                    !clientPointInsideRect(
                      fieldPos.x + er.left,
                      fieldPos.y + er.top,
                      declEl.getBoundingClientRect(),
                    )
                  ) {
                    return null;
                  }
                }
                const pathD = generatePath(fieldPos, dragPoint);
                return (
                  <path
                    d={pathD}
                    className="link-line-dragging"
                    markerEnd="url(#arrowhead-amber)"
                  />
                );
              })()}
            </svg>

            {/* LEFT PANEL - DECLARANT */}
            <div className="editor-panel declarant-panel">
              <div className="panel-header">
                <h2 className="panel-title">DECLARANT</h2>
              </div>
              <div className="panel-divider"></div>
              <div className="declarant-fields" ref={declarantFieldsRef}>
                {(Object.keys(FIELD_LABELS) as DeclarantField[]).map((field, idx) => {
                  const hasLink = currentCase.links.some(l => l.field === field);
                  return (
                    <div key={field} className="declarant-row">
                      {editingField === field ? (
                        <div className="field-edit-mode">
                          <div className="field-label-row">
                            <span className="field-label">{FIELD_LABELS[field]}</span>
                            {hasLink ? (
                              <span className="field-linked-badge" title="Linked to evidence on a document">
                                Linked
                              </span>
                            ) : null}
                          </div>
                          <input
                            type="text"
                            className="field-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleFieldSave(field, editValue);
                              }
                            }}
                            autoFocus
                          />
                          <div className="field-actions">
                            <button className="btn-icon btn-save" onClick={() => handleFieldSave(field, editValue)} aria-label="Save field">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 6L9 17l-5-5"></path>
                              </svg>
                            </button>
                            <button className="btn-icon btn-cancel" onClick={handleFieldCancel} aria-label="Cancel editing">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="field-view-mode"
                          ref={(el) => { fieldRefs.current[field] = el; }}
                        >
                          <div className="field-label-row">
                            <span className="field-label">{FIELD_LABELS[field]}</span>
                            {hasLink ? (
                              <span className="field-linked-badge" title="Linked to evidence on a document">
                                Linked
                              </span>
                            ) : null}
                          </div>
                          <span className="field-value">{currentCase.fields[field] || '—'}</span>
                          <button className="btn-icon btn-edit" onClick={() => handleFieldEdit(field)} aria-label={`Edit ${FIELD_LABELS[field]}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                            </svg>
                          </button>
                          <div
                            className={`drag-handle ${hasLink ? 'has-link' : ''} ${draggingField === field ? 'dragging' : ''}`}
                            onMouseDown={(e) => startFieldDrag(field, e)}
                          >
                            <span className="drag-circle"></span>
                          </div>
                        </div>
                      )}
                      {idx < Object.keys(FIELD_LABELS).length - 1 && <div className="field-separator"></div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT PANEL - DOCUMENTS */}
            <div className="editor-panel documents-panel">
              <div className="panel-header">
                <h2 className="panel-title">DOCUMENTS</h2>
              </div>
              <div className="panel-divider"></div>

              {!hasDocs ? (
                <div className="upload-zone">
                  <div className="upload-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17 21H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4z"></path>
                      <path d="M12 8v8"></path>
                      <path d="M8 12h8"></path>
                    </svg>
                  </div>
                  <p className="upload-text">Drag & Drop files here or click below</p>
                  <label
                    className="btn btn-primary upload-btn"
                    title={`Up to ${MAX_DOCUMENTS_PER_CASE} files per case`}
                  >
                    Upload Files
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              ) : (
                <div className="docs-content">
                  <div className="doc-tabs-row">
                    <div className="doc-tabs-strip">
                      <div className="doc-tabs" role="tablist" aria-label="Uploaded files">
                        {currentCase.docs.map(doc => (
                          <button
                            key={doc.id}
                            type="button"
                            role="tab"
                            aria-selected={activeDocId === doc.id}
                            className={`doc-tab ${activeDocId === doc.id ? 'active' : ''}`}
                            onClick={() => setActiveDocId(doc.id)}
                            title={doc.name}
                          >
                            {truncateTabLabel(doc.name)}
                          </button>
                        ))}
                      </div>
                      <label
                        className="doc-tab-add"
                        title={`Upload more files (max ${MAX_DOCUMENTS_PER_CASE} per case)`}
                        aria-label="Upload more files"
                      >
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </label>
                    </div>
                  </div>
                  {(() => {
                    const sel =
                      selectedRegion &&
                      currentCase.regions.find(
                        r => r.id === selectedRegion && r.docId === activeDocId,
                      );
                    if (!sel) return null;
                    return (
                      <div className="region-toolbar" role="region" aria-label="Selected highlight controls">
                        <span className="region-toolbar-label">Highlight</span>
                        <label className="region-toolbar-slider">
                          <span>Width</span>
                          <input
                            type="range"
                            min={MIN_REGION_SIZE_PCT}
                            max={MAX_REGION_SIZE_PCT}
                            value={sel.widthPct}
                            onChange={e =>
                              updateRegionDimensions(sel.id, { widthPct: Number(e.target.value) })
                            }
                          />
                          <span className="region-toolbar-value">{Math.round(sel.widthPct)}%</span>
                        </label>
                        <label className="region-toolbar-slider">
                          <span>Height</span>
                          <input
                            type="range"
                            min={MIN_REGION_SIZE_PCT}
                            max={MAX_REGION_SIZE_PCT}
                            value={sel.heightPct}
                            onChange={e =>
                              updateRegionDimensions(sel.id, { heightPct: Number(e.target.value) })
                            }
                          />
                          <span className="region-toolbar-value">{Math.round(sel.heightPct)}%</span>
                        </label>
                      </div>
                    );
                  })()}
                  <div className="doc-viewer">
                    {currentDocs.length === 0 ? (
                      <div className="doc-empty">
                        <p>{hasDocs ? 'Select a file tab above.' : 'No files uploaded.'}</p>
                        <label
                          className="btn btn-sm btn-primary"
                          title={`Up to ${MAX_DOCUMENTS_PER_CASE} files per case`}
                        >
                          Upload
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    ) : (
                      <div
                        className={`doc-preview${markEvidenceMode ? ' mark-evidence-active' : ''}`}
                        ref={docViewerRef}
                        onClick={(e) => {
                          const el = e.target as HTMLElement;
                          if (el.closest('.doc-preview-mark-toggle')) return;
                          if (el.closest('.doc-hint-dismiss')) return;
                          if (
                            !markEvidenceMode ||
                            !activeDocId ||
                            currentDocs.length === 0 ||
                            el.closest('.region-marker') !== null
                          ) {
                            return;
                          }
                          /* Selected highlight: first background click deselects only; next click adds a new circle */
                          if (selectedRegion !== null) {
                            setSelectedRegion(null);
                            return;
                          }
                          addDocumentRegion(activeDocId, e);
                        }}
                      >
                        {currentDocs.length > 0 && activeDocId && (
                          <button
                            type="button"
                            className="doc-preview-mark-toggle"
                            onClick={e => {
                              e.stopPropagation();
                              if (editingField) {
                                handleFieldCancel();
                                return;
                              }
                              if (markEvidenceMode) {
                                setMarkEvidenceMode(false);
                                setSelectedRegion(null);
                              } else {
                                setMarkEvidenceMode(true);
                              }
                            }}
                          >
                            {editingField ? 'Close editing' : markEvidenceMode ? 'Close editing' : 'Mark evidence'}
                          </button>
                        )}
                        {currentDocs[0].dataUrl.startsWith('data:application/pdf') ? (
                          <div
                            className="doc-pdf-stack"
                            style={
                              pdfLayout
                                ? {
                                    height: pdfLayout.ch,
                                    minHeight: pdfLayout.ch,
                                  }
                                : undefined
                            }
                          >
                            <PdfJsPreview
                              dataUrl={currentDocs[0].dataUrl}
                              fitMode="fitWidth"
                              onPdfLayout={updatePdfLayout}
                            />
                            <div className="pdf-interaction-shield" aria-hidden={true} />
                            {pdfLayout && (
                              <div
                                className="doc-region-layer"
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  zIndex: 5,
                                  pointerEvents: 'none',
                                }}
                              >
                                {currentCase.regions
                                  .filter(r => r.docId === activeDocId)
                                  .map(region => {
                                    const linkedField = currentCase.links.find(l => l.region === region.id);
                                    const isSelected = selectedRegion === region.id;
                                    const disp = regionDisplayPercents(region, pdfLayout);
                                    return (
                                      <div
                                        key={region.id}
                                        ref={(el) => { regionRefs.current[region.id] = el; }}
                                        className={`region-marker ${isSelected ? 'selected' : ''} ${linkedField ? 'linked' : ''}`}
                                        style={{
                                          left: `${disp.x}%`,
                                          top: `${disp.y}%`,
                                          width: `${disp.widthPct}%`,
                                          height: `${disp.heightPct}%`,
                                          minWidth: 20,
                                          minHeight: 20,
                                        }}
                                        onMouseDown={(e) => {
                                          if (e.button !== 0) return;
                                          beginRegionDrag(region, e);
                                        }}
                                        title={
                                          linkedField
                                            ? `Linked to ${FIELD_LABELS[linkedField.field]}. Drag to move; trash removes; corners resize.`
                                            : 'Drag to move. Use trash to remove; Mark evidence to add new highlights.'
                                        }
                                      >
                                        <span className="region-marker-inner"></span>
                                        {isSelected && (
                                          <button
                                            type="button"
                                            className="region-marker-trash"
                                            aria-label="Remove highlight"
                                            onMouseDown={ev => {
                                              ev.stopPropagation();
                                              ev.preventDefault();
                                            }}
                                            onClick={ev => {
                                              ev.stopPropagation();
                                              removeRegion(region.id);
                                            }}
                                          >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true}>
                                              <polyline points="3 6 5 6 21 6"></polyline>
                                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                              <line x1="10" y1="11" x2="10" y2="17"></line>
                                              <line x1="14" y1="11" x2="14" y2="17"></line>
                                            </svg>
                                          </button>
                                        )}
                                        {isSelected && (
                                          <>
                                            {(['nw', 'ne', 'sw', 'se', 'n'] as const).map(h => (
                                              <div
                                                key={h}
                                                className={`region-marker-handle region-marker-handle-${h}`}
                                                aria-hidden={true}
                                                onMouseDown={ev => beginRegionResize(region, h, ev)}
                                              />
                                            ))}
                                          </>
                                        )}
                                        {linkedField && (
                                          <span className="region-marker-label">{FIELD_LABELS[linkedField.field]}</span>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <img src={currentDocs[0].dataUrl} alt={currentDocs[0].name} className="doc-image" />
                            <div
                              className="doc-region-layer"
                              style={{
                                position: 'absolute',
                                inset: 0,
                                zIndex: 5,
                                pointerEvents: 'none',
                              }}
                            >
                              {currentCase.regions
                                .filter(r => r.docId === activeDocId)
                                .map(region => {
                                  const linkedField = currentCase.links.find(l => l.region === region.id);
                                  const isSelected = selectedRegion === region.id;
                                  const disp = regionDisplayPercents(region, null);
                                  return (
                                    <div
                                      key={region.id}
                                      ref={(el) => { regionRefs.current[region.id] = el; }}
                                      className={`region-marker ${isSelected ? 'selected' : ''} ${linkedField ? 'linked' : ''}`}
                                      style={{
                                        left: `${disp.x}%`,
                                        top: `${disp.y}%`,
                                        width: `${disp.widthPct}%`,
                                        height: `${disp.heightPct}%`,
                                        minWidth: 20,
                                        minHeight: 20,
                                      }}
                                      onMouseDown={(e) => {
                                        if (e.button !== 0) return;
                                        beginRegionDrag(region, e);
                                      }}
                                      title={
                                        linkedField
                                          ? `Linked to ${FIELD_LABELS[linkedField.field]}. Drag to move; trash removes; corners resize.`
                                          : 'Drag to move. Use trash to remove; Mark evidence to add new highlights.'
                                      }
                                    >
                                      <span className="region-marker-inner"></span>
                                      {isSelected && (
                                        <button
                                          type="button"
                                          className="region-marker-trash"
                                          aria-label="Remove highlight"
                                          onMouseDown={ev => {
                                            ev.stopPropagation();
                                            ev.preventDefault();
                                          }}
                                          onClick={ev => {
                                            ev.stopPropagation();
                                            removeRegion(region.id);
                                          }}
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={true}>
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            <line x1="10" y1="11" x2="10" y2="17"></line>
                                            <line x1="14" y1="11" x2="14" y2="17"></line>
                                          </svg>
                                        </button>
                                      )}
                                      {isSelected && (
                                        <>
                                          {(['nw', 'ne', 'sw', 'se', 'n'] as const).map(h => (
                                            <div
                                              key={h}
                                              className={`region-marker-handle region-marker-handle-${h}`}
                                              aria-hidden={true}
                                              onMouseDown={ev => beginRegionResize(region, h, ev)}
                                            />
                                          ))}
                                        </>
                                      )}
                                      {linkedField && (
                                        <span className="region-marker-label">{FIELD_LABELS[linkedField.field]}</span>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          </>
                        )}

                        {currentDocs.length > 0 &&
                          activeDocId &&
                          currentCase.regions.filter(r => r.docId === activeDocId).length === 0 &&
                          !docEmptyHintDismissed && (
                          <div className="doc-hint">
                            <button
                              type="button"
                              className="doc-hint-dismiss"
                              aria-label="Dismiss hint"
                              onClick={e => {
                                e.stopPropagation();
                                setDocEmptyHintDismissed(true);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden={true}>
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                            <span className="doc-hint-text">
                              Choose Mark evidence, then click the document to place a highlight
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="comments-section">
                <div className="comments-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span>Comments</span>
                </div>
                <div className="comments-list" ref={commentsListRef}>
                  {currentCase.comments.length === 0 ? (
                    <p className="comments-empty">No comments...</p>
                  ) : (
                    currentCase.comments.map((comment, idx) => (
                      <div key={idx} className="comment-item">
                        <div className="comment-author">{comment.author}</div>
                        <div className="comment-text">{comment.text}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="comment-input-row">
                  <input
                    type="text"
                    className="comment-input"
                    placeholder="Add a comment..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment(newCommentText)}
                  />
                  <button className="btn-send" onClick={() => handleAddComment(newCommentText)} aria-label="Send comment">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="submit-area">
                <button type="button" className="btn btn-outline btn-save-draft" onClick={handleSaveDraft}>
                  Save draft
                </button>
                <button type="button" className="btn btn-success btn-submit" onClick={handleSubmitCase} aria-label="Submit case for review">
                  Submit Case
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && currentCase && (
        <div className="modal-overlay" onClick={closeSubmitModal}>
          <div className="modal-card submit-send-modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Send files</h3>

            {writerCaseCompletelyEmpty ? (
              <>
                <div className="modal-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <p className="submit-send-modal-block-msg">
                  Add at least one file and enter declarant data before you can send.
                </p>
                <div className="modal-actions">
                  <button type="button" className="btn btn-modal-cancel" onClick={closeSubmitModal}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-modal-confirm" disabled>
                    Send files
                  </button>
                </div>
              </>
            ) : writerCaseHasNoFiles ? (
              <>
                <div className="modal-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <p className="submit-send-modal-block-msg">Upload files before sending.</p>
                <div className="modal-actions">
                  <button type="button" className="btn btn-modal-cancel" onClick={closeSubmitModal}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-modal-confirm" disabled>
                    Send files
                  </button>
                </div>
              </>
            ) : writerSubmitIssues.length > 0 ? (
              <>
                <p className="submit-send-modal-errors-title">Errors encountered</p>
                <ul className="submit-send-modal-issues" aria-label="Validation issues">
                  {writerSubmitIssues.map(issue => (
                    <li
                      key={issue.field}
                      className={
                        issue.kind === 'yellow'
                          ? 'submit-send-modal-issue submit-send-modal-issue--yellow'
                          : 'submit-send-modal-issue submit-send-modal-issue--red'
                      }
                    >
                      {issue.message}
                    </li>
                  ))}
                </ul>
                {!submitExplanationOpen ? (
                  <button
                    type="button"
                    className="btn btn-outline submit-send-modal-add-explanation"
                    onClick={() => setSubmitExplanationOpen(true)}
                  >
                    Add explanation
                  </button>
                ) : (
                  <label className="submit-send-modal-explanation-label">
                    <span className="submit-send-modal-explanation-caption">Explanation (required to send)</span>
                    <textarea
                      className="submit-send-modal-explanation-input"
                      rows={3}
                      value={submitExplanationText}
                      onChange={e => setSubmitExplanationText(e.target.value)}
                      placeholder="Describe why you are submitting despite the issues above…"
                    />
                  </label>
                )}
                <p className="submit-send-modal-hint">
                  {submitExplanationText.trim()
                    ? 'This explanation will be saved as a comment on the case when you send.'
                    : submitExplanationOpen
                      ? 'Enter an explanation to enable Send files.'
                      : 'Add an explanation describing why you are submitting despite these issues — it is required to send.'}
                </p>
                <div className="modal-actions">
                  <button type="button" className="btn btn-modal-cancel" onClick={closeSubmitModal}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-modal-confirm"
                    onClick={confirmSubmit}
                    disabled={!canSendSubmitFiles}
                  >
                    Send files
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <p className="modal-status">READY to send. Files verified.</p>
                <p className="modal-question">Proceed to send these files?</p>
                <div className="modal-actions">
                  <button type="button" className="btn btn-modal-cancel" onClick={closeSubmitModal}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-modal-confirm" onClick={confirmSubmit}>
                    Send files
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {unsavedLeaveOpen && (
        <div className="modal-overlay" onClick={() => setUnsavedLeaveOpen(false)}>
          <div className="modal-card unsaved-leave-modal" onClick={(e) => e.stopPropagation()}>
            <div className="unsaved-leave-header">
              <button
                type="button"
                className="btn-back unsaved-leave-back"
                onClick={() => setUnsavedLeaveOpen(false)}
                aria-label="Back to case"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5"></path>
                  <path d="M12 19l-7-7 7-7"></path>
                </svg>
              </button>
              <h3 className="modal-title">Unsaved work</h3>
            </div>
            <p className="unsaved-leave-text">
              Your work is not saved as a draft. Do you want to save it before leaving?
            </p>
            <label className="unsaved-leave-checkbox">
              <input
                type="checkbox"
                checked={dontShowUnsavedAgain}
                onChange={(e) => setDontShowUnsavedAgain(e.target.checked)}
              />
              <span>Don&apos;t show this again</span>
            </label>
            <div className="modal-actions unsaved-leave-actions">
              <button type="button" className="btn btn-modal-cancel" onClick={editorUnsavedLeaveWithoutSave}>
                Don&apos;t save
              </button>
              <button type="button" className="btn btn-primary" onClick={editorUnsavedSaveDraftAndLeave}>
                Save draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== REVIEW MATRIX PAGE ==============

interface ReviewMatrixPageProps {
  user: User;
  caseId: string;
  cases: Case[];
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  notificationPanelOpen: boolean;
  onNotificationBellClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  closeNotificationPanel: () => void;
  inspectingCell: { field: DeclarantField; docId: string } | null;
  setInspectingCell: React.Dispatch<React.SetStateAction<{ field: DeclarantField; docId: string } | null>>;
  showReturnModal: boolean;
  setShowReturnModal: React.Dispatch<React.SetStateAction<boolean>>;
  onBack: () => void;
  onLogout: () => void;
}

/** Evidence for matrix cell popup: prefer link on this document column, else any link for the field. */
function resolveEvidenceForInspection(
  c: Case,
  field: DeclarantField,
  columnDocId: string,
): {
  doc: UploadedDoc;
  region: DocumentRegion | null;
  crossColumn: boolean;
} | null {
  const cellLinks = getMatchingLinksForMatrixCell(c, field, columnDocId);
  const pick =
    cellLinks.find(l => l.status === 'linked') ??
    cellLinks.find(l => l.status === 'stale') ??
    cellLinks.find(l => l.status === 'conflict') ??
    cellLinks[0];
  if (pick) {
    const doc = c.docs.find(d => d.id === pick.docId);
    if (!doc) return null;
    const region =
      c.regions.find(r => r.id === pick.region && r.docId === pick.docId) ??
      c.regions.find(r => r.id === pick.region) ??
      null;
    return { doc, region, crossColumn: false };
  }
  const anyLink = c.links.find(l => l.field === field);
  if (!anyLink) return null;
  const doc = c.docs.find(d => d.id === anyLink.docId);
  if (!doc) return null;
  const region =
    c.regions.find(r => r.id === anyLink.region && r.docId === anyLink.docId) ??
    c.regions.find(r => r.id === anyLink.region) ??
    null;
  return {
    doc,
    region,
    crossColumn: anyLink.docId !== columnDocId,
  };
}

function matrixColumnMatchesFieldLink(c: Case, field: DeclarantField, docId: string): boolean {
  return getMatchingLinksForMatrixCell(c, field, docId).length > 0;
}

function ReviewMatrixPage({
  user,
  caseId,
  cases,
  setCases,
  notifications,
  setNotifications,
  notificationPanelOpen,
  onNotificationBellClick,
  closeNotificationPanel,
  inspectingCell,
  setInspectingCell,
  showReturnModal,
  setShowReturnModal,
  onBack,
  onLogout,
}: ReviewMatrixPageProps) {
  const currentCase = cases.find(c => c.id === caseId);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [editingFieldValue, setEditingFieldValue] = useState('');
  const inspectionPreviewRef = useRef<HTMLDivElement>(null);
  const inspectionPdfLayoutRef = useRef<PdfPageLayoutInfo | null>(null);
  const [inspectionPdfLayout, setInspectionPdfLayout] = useState<PdfPageLayoutInfo | null>(null);
  const updateInspectionPdfLayout = useCallback((layout: PdfPageLayoutInfo | null) => {
    inspectionPdfLayoutRef.current = layout;
    setInspectionPdfLayout(layout);
  }, []);
  const matrixCommentsListRef = useRef<HTMLDivElement>(null);
  const matrixCommentsScrollCaseIdRef = useRef<string | null>(null);
  const matrixCommentsScrollPrevLenRef = useRef<number | null>(null);
  const matrixDirtyRef = useRef(false);
  const matrixPendingLeaveRef = useRef<'return' | 'back' | null>(null);
  const [matrixSidebarDocId, setMatrixSidebarDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCase) return;
    const docs = currentCase.docs;
    if (docs.length === 0) {
      setMatrixSidebarDocId(null);
      return;
    }
    setMatrixSidebarDocId(prev =>
      prev !== null && docs.some(d => d.id === prev) ? prev : docs[0].id,
    );
  }, [currentCase?.id, currentCase?.docs]);

  useEffect(() => {
    if (cases.find(c => c.id === caseId)?.status === 'completed') {
      setShowReturnModal(false);
    }
  }, [caseId, cases, setShowReturnModal]);

  const [matrixUnsavedOpen, setMatrixUnsavedOpen] = useState(false);
  const [dontShowMatrixUnsavedAgain, setDontShowMatrixUnsavedAgain] = useState(false);
  /** Declarant edits confirmed with OK in the inspection modal — applied on “Save draft” (or submit/return). */
  const [matrixPendingFields, setMatrixPendingFields] = useState<Partial<Record<DeclarantField, string>>>({});
  /** Last saved-to-store snapshot for this matrix session (discard restores this). */
  const [matrixSavedSnapshot, setMatrixSavedSnapshot] = useState<Case | null>(null);

  useLayoutEffect(() => {
    const c = cases.find(x => x.id === caseId);
    if (c) setMatrixSavedSnapshot(cloneCaseDeep(c));
    else setMatrixSavedSnapshot(null);
    setMatrixPendingFields({});
  }, [caseId]);

  const handleMatrixSaveDraft = useCallback(() => {
    const c0 = cases.find(x => x.id === caseId);
    if (!c0 || c0.status === 'completed') return;
    const flush: Partial<Record<DeclarantField, string>> = {
      ...matrixPendingFields,
      ...(inspectingCell ? { [inspectingCell.field]: editingFieldValue } : {}),
    };
    if (Object.keys(flush).length === 0) {
      const normalized = normalizeWriterFacingKanbanStatus(c0);
      if (normalized !== c0) {
        setCases(prev => prev.map(c => (c.id === caseId ? normalized : c)));
      }
      setMatrixSavedSnapshot(cloneCaseDeep(normalized));
      setInspectingCell(null);
      return;
    }
    let merged: Case | null = null;
    setCases(prev => {
      const next = prev.map(c => {
        if (c.id !== caseId) return c;
        const withFields = { ...c, fields: { ...c.fields, ...flush } };
        merged = normalizeWriterFacingKanbanStatus(withFields);
        return merged;
      });
      return next;
    });
    if (merged) setMatrixSavedSnapshot(cloneCaseDeep(merged));
    setMatrixPendingFields({});
    setInspectingCell(null);
  }, [caseId, cases, matrixPendingFields, inspectingCell, editingFieldValue, setCases, setInspectingCell]);

  const requestOpenReturnModal = useCallback(() => {
    if (cases.find(c => c.id === caseId)?.status === 'completed') return;
    if (skipUnsavedLeaveStored() || !matrixDirtyRef.current) {
      setShowReturnModal(true);
      return;
    }
    setDontShowMatrixUnsavedAgain(false);
    matrixPendingLeaveRef.current = 'return';
    setMatrixUnsavedOpen(true);
  }, [setShowReturnModal, cases, caseId]);

  const requestMatrixBackNav = useCallback(() => {
    if (skipUnsavedLeaveStored() || !matrixDirtyRef.current) {
      onBack();
      return;
    }
    setDontShowMatrixUnsavedAgain(false);
    matrixPendingLeaveRef.current = 'back';
    setMatrixUnsavedOpen(true);
  }, [onBack]);

  const matrixUnsavedSaveDraftAndContinue = useCallback(() => {
    if (dontShowMatrixUnsavedAgain) persistSkipUnsavedLeave();
    handleMatrixSaveDraft();
    const t = matrixPendingLeaveRef.current;
    matrixPendingLeaveRef.current = null;
    setMatrixUnsavedOpen(false);
    if (t === 'return') setShowReturnModal(true);
    else if (t === 'back') onBack();
  }, [dontShowMatrixUnsavedAgain, handleMatrixSaveDraft, onBack, setShowReturnModal]);

  const matrixUnsavedDontSaveAndContinue = useCallback(() => {
    if (dontShowMatrixUnsavedAgain) persistSkipUnsavedLeave();
    const snap = matrixSavedSnapshot;
    if (snap) {
      const restored = cloneCaseDeep(snap);
      setCases(prev => prev.map(c => (c.id === caseId ? restored : c)));
    }
    setMatrixPendingFields({});
    setInspectingCell(null);
    const t = matrixPendingLeaveRef.current;
    matrixPendingLeaveRef.current = null;
    setMatrixUnsavedOpen(false);
    if (t === 'return') setShowReturnModal(true);
    else if (t === 'back') onBack();
  }, [dontShowMatrixUnsavedAgain, caseId, matrixSavedSnapshot, onBack, setCases, setInspectingCell, setShowReturnModal]);

  useEffect(() => {
    if (!showUserMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.closest('.user-avatar-wrapper') ||
        t.closest('.notification-bell-trigger') ||
        t.closest('.notification-flyout-panel')
      ) {
        return;
      }
      setShowUserMenu(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showUserMenu]);

  useLayoutEffect(() => {
    const el = matrixCommentsListRef.current;
    const len = currentCase?.comments.length ?? 0;
    if (!el) return;

    const sameCase = matrixCommentsScrollCaseIdRef.current === caseId;
    matrixCommentsScrollCaseIdRef.current = caseId;

    if (!sameCase) {
      matrixCommentsScrollPrevLenRef.current = len;
      if (len > 0) {
        el.scrollTop = el.scrollHeight;
      }
      return;
    }

    const prev = matrixCommentsScrollPrevLenRef.current ?? 0;
    matrixCommentsScrollPrevLenRef.current = len;
    if (len > prev) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [caseId, currentCase?.comments.length]);

  useLayoutEffect(() => {
    if (!inspectingCell) return;
    const root = inspectionPreviewRef.current;
    if (!root) return;
    const stopWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const stopTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };
    root.addEventListener('wheel', stopWheel, { passive: false });
    root.addEventListener('touchmove', stopTouchMove, { passive: false });
    return () => {
      root.removeEventListener('wheel', stopWheel);
      root.removeEventListener('touchmove', stopTouchMove);
    };
  }, [inspectingCell]);

  const matrixInspectionContextCase =
    currentCase != null ? mergePendingMatrixFields(currentCase, matrixPendingFields) : null;

  const inspectionLinkedEvidence = inspectingCell && matrixInspectionContextCase
    ? resolveEvidenceForInspection(
        matrixInspectionContextCase,
        inspectingCell.field,
        inspectingCell.docId,
      )
    : null;

  const inspectionCellMatchesLink =
    !!inspectingCell &&
    !!matrixInspectionContextCase &&
    matrixColumnMatchesFieldLink(
      matrixInspectionContextCase,
      inspectingCell.field,
      inspectingCell.docId,
    );

  const inspectionEvidenceIsPdf = !!inspectionLinkedEvidence?.doc?.dataUrl?.startsWith(
    'data:application/pdf',
  );

  useEffect(() => {
    updateInspectionPdfLayout(null);
  }, [
    inspectingCell?.field,
    inspectingCell?.docId,
    inspectionLinkedEvidence?.doc?.id,
    updateInspectionPdfLayout,
  ]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!matrixDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  /** Same as case editor: keep `missing_ev` ↔ `drafting` in sync with matrix evidence rules when reviewers edit here. */
  const matrixKanbanEvidenceFingerprint = useMemo(() => {
    const c = cases.find(x => x.id === caseId);
    if (!c) return '';
    const w = mergePendingMatrixFields(c, matrixPendingFields);
    return caseEditorContentFingerprint(w);
  }, [cases, caseId, matrixPendingFields]);

  useEffect(() => {
    setCases(prev => {
      const idx = prev.findIndex(x => x.id === caseId);
      if (idx < 0) return prev;
      const row = prev[idx];
      if (row.status === 'completed') return prev;
      let next = row;
      if (row.status === 'drafting' || row.status === 'returned') {
        next = upgradeDraftingToMissingEvIfStale(row);
      } else if (row.status === 'missing_ev') {
        next = downgradeMissingEvToDraftIfClear(row);
      }
      if (next === row) return prev;
      const out = [...prev];
      out[idx] = next;
      return out;
    });
  }, [matrixKanbanEvidenceFingerprint, caseId, setCases]);

  /** Match case editor: omit `status` so auto missing_ev ↔ drafting (matrix + writer rules) does not look “unsaved”. */
  const showMatrixUnsavedHint = useMemo(() => {
    const c = cases.find(x => x.id === caseId);
    if (!c || c.status === 'completed') return false;
    if (!matrixSavedSnapshot) return false;
    const w = mergePendingMatrixFields(c, matrixPendingFields);
    return (
      caseEditorDraftDirtyFingerprint(w) !== caseEditorDraftDirtyFingerprint(matrixSavedSnapshot)
    );
  }, [cases, caseId, matrixPendingFields, matrixSavedSnapshot]);

  useEffect(() => {
    matrixDirtyRef.current = showMatrixUnsavedHint;
  }, [showMatrixUnsavedHint]);

  if (!currentCase) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className="empty-state-title">CASE NOT FOUND</h3>
            <p className="empty-state-text">The requested case could not be located.</p>
            <button className="btn btn-primary" onClick={onBack}>Go Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  const matrixReadOnly = currentCase.status === 'completed';

  const userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const myMatrixNotifications = notifications.filter(n => notificationVisibleToUser(n, user));
  const unreadMatrixBellCount = myMatrixNotifications.filter(n => !n.read).length;

  const matrixDocs = currentCase.docs;
  const matrixColumnDocIds =
    matrixDocs.length > 0 ? matrixDocs.map(d => d.id) : [MATRIX_NO_FILE_COLUMN_ID];

  const matrixLiveFieldOverrides: Partial<Record<DeclarantField, string>> = {
    ...matrixPendingFields,
    ...(inspectingCell ? { [inspectingCell.field]: editingFieldValue } : {}),
  };

  const linkedCount = countMatrixCells(currentCase, 'linked', matrixLiveFieldOverrides, matrixColumnDocIds);
  const conflictCount = countMatrixCells(currentCase, 'conflict', matrixLiveFieldOverrides, matrixColumnDocIds);
  const staleCount = countMatrixCells(currentCase, 'stale', matrixLiveFieldOverrides, matrixColumnDocIds);
  const matrixManyCols = matrixDocs.length > 8;
  const matrixScrollMinWidth =
    matrixManyCols && matrixDocs.length > 0 ? 172 + matrixDocs.length * 122 : undefined;

  const handleCellClick = (field: DeclarantField, docId: string) => {
    const v = matrixPendingFields[field] ?? currentCase.fields[field] ?? '';
    setEditingFieldValue(v);
    setInspectingCell({ field, docId });
  };

  const handleAddComment = (text: string) => {
    if (matrixReadOnly) return;
    if (!text.trim()) return;
    const newComment = {
      author: user.name,
      text: text.trim(),
      timestamp: new Date(),
    };
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return { ...c, comments: [...c.comments, newComment] };
      }
      return c;
    }));
    setNewCommentText('');
  };

  const handleMatrixFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (matrixReadOnly) return;
    const files = event.target.files;
    if (!files) return;
    const slotsLeft = Math.max(0, MAX_DOCUMENTS_PER_CASE - currentCase.docs.length);
    const toRead = Array.from(files).slice(0, slotsLeft);
    const lastFileInBatch = toRead[toRead.length - 1];

    toRead.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const newId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const newDoc: UploadedDoc = {
          id: newId,
          name: file.name,
          docType: DEFAULT_WRITER_DOC_TYPE,
          dataUrl,
        };
        setCases(prev =>
          prev.map(c => (c.id === caseId ? { ...c, docs: [...c.docs, newDoc] } : c)),
        );
        if (file === lastFileInBatch) {
          setMatrixSidebarDocId(newId);
        }
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const handleReturn = () => {
    if (matrixReadOnly) return;
    const fieldFlush: Partial<Record<DeclarantField, string>> = {
      ...matrixPendingFields,
      ...(inspectingCell ? { [inspectingCell.field]: editingFieldValue } : {}),
    };
    setCases(prev => prev.map(c => {
      if (c.id !== caseId) return c;
      const merged = { ...c, fields: { ...c.fields, ...fieldFlush } };
      const returnCommentObj = returnComment.trim() ? {
        author: user.name,
        text: `[RETURNED] ${returnComment.trim()}`,
        timestamp: new Date(),
      } : null;
      return {
        ...merged,
        status: 'returned' as CaseStatus,
        comments: returnCommentObj ? [...merged.comments, returnCommentObj] : merged.comments,
      };
    }));
    setMatrixPendingFields({});
    setInspectingCell(null);
    setNotifications(prev => [...prev, {
      id: `notif-${Date.now()}`,
      message: `${currentCase?.title || 'Case'} has been returned for corrections`,
      caseId,
      timestamp: new Date(),
      read: false,
      audienceRole: 'writer',
    }]);
    setShowReturnModal(false);
    setReturnComment('');
    onBack();
  };

  const handleSubmit = () => {
    if (matrixReadOnly) return;
    const isCeo = user.role === 'ceo';
    const newStatus: CaseStatus = isCeo ? 'completed' : 'ceo_review';
    const snapshot = currentCase;
    const fieldFlush: Partial<Record<DeclarantField, string>> = {
      ...matrixPendingFields,
      ...(inspectingCell ? { [inspectingCell.field]: editingFieldValue } : {}),
    };
    setCases(prev => prev.map(c => {
      if (c.id !== caseId) return c;
      const merged = { ...c, fields: { ...c.fields, ...fieldFlush } };
      if (isCeo) return { ...merged, status: newStatus };
      return { ...merged, status: newStatus, passedLeadReviewBeforeCeo: true };
    }));
    setMatrixPendingFields({});
    setInspectingCell(null);
    if (!isCeo) {
      setNotifications(prev => [...prev, {
        id: `notif-${Date.now()}`,
        message: `${currentCase?.title || 'Case'} has been sent to CEO for approval`,
        caseId,
        timestamp: new Date(),
        read: false,
        audienceRole: 'ceo',
      }]);
    } else if (snapshot) {
      const lane = snapshot.writerExitLaneAtReviewSubmit;
      const passedLead = snapshot.passedLeadReviewBeforeCeo === true;
      const legacy = lane === undefined;
      const notifyWriter =
        lane === 'drafting' || lane === 'missing_ev' || legacy;
      const notifyLead =
        lane === 'drafting' || lane === 'missing_ev' || passedLead || legacy;
      const title = snapshot.title || 'Case';
      const ts = Date.now();
      setNotifications(prev => {
        const next = [...prev];
        if (notifyWriter) {
          next.push({
            id: `notif-${ts}-cw`,
            message: `${title} was submitted to customs by the CEO.`,
            caseId,
            timestamp: new Date(),
            read: false,
            audienceRole: 'writer',
          });
        }
        if (notifyLead) {
          next.push({
            id: `notif-${ts}-lr`,
            message: `${title} was submitted to customs by the CEO.`,
            caseId,
            timestamp: new Date(),
            read: false,
            audienceRole: 'lead_reviewer',
          });
        }
        return next;
      });
    }
    onBack();
  };

  /** Apply inspection input to pending edits only — persists when “Save draft” (or submit/return) runs. */
  const handleInspectionOk = () => {
    if (matrixReadOnly) return;
    if (!inspectingCell) return;
    setMatrixPendingFields(prev => ({ ...prev, [inspectingCell.field]: editingFieldValue }));
    setInspectingCell(null);
  };

  const toggleInspectionManualConflict = () => {
    if (matrixReadOnly) return;
    if (!inspectingCell) return;
    const key = matrixCellKey(inspectingCell.field, inspectingCell.docId);
    setCases(prev =>
      prev.map(c => {
        if (c.id !== caseId) return c;
        const list = [...(c.matrixManualConflicts ?? [])];
        const i = list.indexOf(key);
        if (i >= 0) list.splice(i, 1);
        else list.push(key);
        return { ...c, matrixManualConflicts: list };
      }),
    );
  };

  const inspectionHasValue = editingFieldValue.trim().length > 0;
  const inspectionEvidenceStatusLabel = !inspectionHasValue
    ? 'NO VALUE ENTERED'
    : inspectionCellMatchesLink
      ? 'EVIDENCE LINKED'
      : inspectionLinkedEvidence
        ? 'LINKED — OTHER DOCUMENT COLUMN'
        : 'EVIDENCE NOT LINKED';
  const inspectionEvidenceStatusClass =
    'inspection-evidence-status' +
    (!inspectionHasValue
      ? ' inspection-evidence-status--no-value'
      : inspectionCellMatchesLink
        ? ' inspection-evidence-status--linked'
        : inspectionLinkedEvidence
          ? ' inspection-evidence-status--cross-column'
          : ' inspection-evidence-status--not-linked');

  const inspectionManualConflict =
    !!inspectingCell &&
    (currentCase.matrixManualConflicts ?? []).includes(
      matrixCellKey(inspectingCell.field, inspectingCell.docId),
    );

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <header className="dashboard-header">
          <button className="btn-back" onClick={requestMatrixBackNav} aria-label="Go back to dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div className="dashboard-title-block">
            <h1 className="dashboard-title">{currentCase.title.toUpperCase()}</h1>
            {showMatrixUnsavedHint && (
              <span className="editor-unsaved-hint" role="status">
                Not saved
              </span>
            )}
          </div>
          <div className="header-actions editor-matrix-header-actions">
            <div className="notification-wrapper notification-bell-trigger">
              <button
                type="button"
                className="notification-btn"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  setShowUserMenu(false);
                  onNotificationBellClick(e);
                }}
                aria-label="Notifications"
                aria-expanded={notificationPanelOpen}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadMatrixBellCount > 0 && (
                  <span className="notification-badge">{unreadMatrixBellCount}</span>
                )}
              </button>
            </div>
            <div className="user-avatar-wrapper">
              <button
                type="button"
                className="user-avatar"
                title={user.name}
                onClick={() => {
                  closeNotificationPanel();
                  setShowUserMenu(v => !v);
                }}
              >
                {userInitials}
              </button>
              {showUserMenu && (
                <div className="user-menu">
                  <div className="user-menu-info">
                    <div className="user-menu-name">{user.name}</div>
                    <div className="user-menu-email">{user.email}</div>
                    <div className="user-menu-role">{user.role.replace('_', ' ')}</div>
                  </div>
                  <button
                    type="button"
                    className="user-menu-item"
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                  >
                    🚪 Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="header-divider"></div>
        {matrixReadOnly && (
          <p className="matrix-readonly-banner" role="status">
            Submitted to customs — this case is read-only. No edits, uploads, or comments can be added.
          </p>
        )}

        <main className="matrix-main">
          <div className="matrix-layout">
            {/* LEFT: Matrix Table */}
            <div className="matrix-panel">
              <div className="matrix-table-wrap">
                <table
                  className={`matrix-table${matrixManyCols ? ' matrix-table--scroll-cols' : ''}`}
                  style={matrixScrollMinWidth ? { minWidth: matrixScrollMinWidth } : undefined}
                >
                  <colgroup>
                    <col
                      style={
                        matrixManyCols
                          ? { width: 172, minWidth: 172 }
                          : { width: '24%' }
                      }
                    />
                    {matrixDocs.length === 0 ? (
                      <col style={{ width: matrixManyCols ? 320 : '76%' }} />
                    ) : (
                      matrixDocs.map(doc => (
                        <col
                          key={doc.id}
                          style={
                            matrixManyCols
                              ? { width: 122, minWidth: 122 }
                              : { width: `${76 / matrixDocs.length}%` }
                          }
                        />
                      ))
                    )}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="matrix-corner" />
                      {matrixDocs.length === 0 ? (
                        <th className="matrix-col-header matrix-col-header--empty" scope="colgroup">
                          No files yet — click a cell to edit declarant values, or add attachments (each file becomes a column).
                        </th>
                      ) : (
                        matrixDocs.map(doc => (
                          <th
                            key={doc.id}
                            className="matrix-col-header matrix-col-header--file"
                            scope="col"
                            title={doc.name}
                          >
                            {truncateTabLabel(doc.name, 18)}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {MATRIX_FIELDS.map(field => (
                      <tr key={field}>
                        <td className="matrix-row-header">{FIELD_LABELS[field]}</td>
                        {matrixColumnDocIds.map(docId => {
                          const visual = getMatrixCellVisual(
                            currentCase,
                            field,
                            docId,
                            matrixLiveFieldOverrides,
                          );
                          return (
                            <td
                              key={docId}
                              className={`matrix-cell matrix-cell-${visual}`}
                              onClick={() => handleCellClick(field, docId)}
                              title="View declarant value and evidence"
                            >
                              {visual === 'none' && (
                                <span className="matrix-icon matrix-icon-none">✕</span>
                              )}
                              {visual === 'na' && (
                                <span className="matrix-cell-na-label">N/A</span>
                              )}
                              {visual === 'orange' && (
                                <span className="matrix-icon matrix-icon-orange">!</span>
                              )}
                              {visual === 'stale' && (
                                <span className="matrix-icon matrix-icon-stale">⟳</span>
                              )}
                              {visual === 'linked' && (
                                <span className="matrix-icon matrix-icon-linked">✓</span>
                              )}
                              {visual === 'conflict' && (
                                <span className="matrix-icon matrix-icon-conflict">!</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT: Sidebar */}
            <div className="matrix-sidebar">
              <div className="matrix-status-summary">
                <div className="status-stat">
                  <span className="status-stat-icon status-stat-linked">✓</span>
                  <span className="status-stat-label">Linked</span>
                  <span className="status-stat-value">{linkedCount}</span>
                </div>
                <div className="status-stat">
                  <span className="status-stat-icon status-stat-conflict">!</span>
                  <span className="status-stat-label">Conflict</span>
                  <span className="status-stat-value">{conflictCount}</span>
                </div>
                <div className="status-stat">
                  <span className="status-stat-icon status-stat-stale">⟳</span>
                  <span className="status-stat-label">Stale</span>
                  <span className="status-stat-value">{staleCount}</span>
                </div>
              </div>

              <label
                className={`btn btn-primary btn-add-files${matrixReadOnly ? ' matrix-control-disabled' : ''}`}
                title={
                  matrixReadOnly
                    ? 'Read-only: submitted to customs'
                    : `Add files (max ${MAX_DOCUMENTS_PER_CASE} per case)`
                }
                aria-disabled={matrixReadOnly}
              >
                + Add Files
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={matrixReadOnly}
                  onChange={handleMatrixFileUpload}
                  style={{ display: 'none' }}
                />
              </label>

              <div className="matrix-files-preview">
                <div className="matrix-files-preview-header">
                  <span className="matrix-files-preview-title">Attached files</span>
                  <span className="matrix-files-preview-count">{currentCase.docs.length}</span>
                </div>
                {currentCase.docs.length === 0 ? (
                  <p className="matrix-files-preview-empty">No files attached.</p>
                ) : (
                  <>
                    <div className="matrix-doc-tabs-row">
                      <div className="matrix-doc-tabs-strip">
                        <div className="matrix-doc-tabs" role="tablist" aria-label="Case attachments">
                          {currentCase.docs.map(doc => (
                            <button
                              key={doc.id}
                              type="button"
                              role="tab"
                              aria-selected={matrixSidebarDocId === doc.id}
                              className={`matrix-doc-tab ${matrixSidebarDocId === doc.id ? 'active' : ''}`}
                              onClick={() => setMatrixSidebarDocId(doc.id)}
                              title={doc.name}
                            >
                              {truncateTabLabel(doc.name, 18)}
                            </button>
                          ))}
                        </div>
                        <label
                          className={`matrix-doc-tab-add${matrixReadOnly ? ' matrix-control-disabled' : ''}`}
                          title={
                            matrixReadOnly
                              ? 'Read-only: submitted to customs'
                              : `Add files (max ${MAX_DOCUMENTS_PER_CASE} per case)`
                          }
                          aria-label="Add files"
                          aria-disabled={matrixReadOnly}
                        >
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg"
                            disabled={matrixReadOnly}
                            onChange={handleMatrixFileUpload}
                            style={{ display: 'none' }}
                          />
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        </label>
                      </div>
                    </div>
                    <div className="matrix-files-preview-pane">
                      {(() => {
                        const doc = currentCase.docs.find(d => d.id === matrixSidebarDocId);
                        if (!doc) return null;
                        const isPdf = doc.dataUrl.startsWith('data:application/pdf');
                        return (
                          <div className="matrix-files-preview-pane-inner">
                            <p className="matrix-preview-active-name" title={doc.name}>
                              {doc.name}
                            </p>
                            <div className="matrix-single-preview-shell">
                              {isPdf ? (
                                <PdfJsPreview
                                  dataUrl={doc.dataUrl}
                                  className="matrix-sidebar-pdf-js"
                                  fitMode="fitWidth"
                                />
                              ) : (
                                <div className="matrix-single-preview-image-wrap">
                                  <img src={doc.dataUrl} alt="" className="matrix-sidebar-doc-img" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>

              <div className="matrix-sidebar-bottom">
                <div className="matrix-comments-box">
                  <div className="comments-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>Comments</span>
                  </div>
                  <div className="comments-list" ref={matrixCommentsListRef}>
                    {currentCase.comments.length === 0 ? (
                      <p className="comments-empty">No comments...</p>
                    ) : (
                      currentCase.comments.map((comment, idx) => (
                        <div key={idx} className="comment-item">
                          <div className="comment-author">{comment.author}</div>
                          <div className="comment-text">{comment.text}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="comment-input-row">
                    <input
                      type="text"
                      className="comment-input"
                      placeholder={matrixReadOnly ? 'Comments are closed (submitted to customs)' : 'Add a comment...'}
                      value={newCommentText}
                      disabled={matrixReadOnly}
                      readOnly={matrixReadOnly}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment(newCommentText)}
                    />
                    <button
                      type="button"
                      className="btn-send"
                      disabled={matrixReadOnly}
                      onClick={() => handleAddComment(newCommentText)}
                      aria-label="Send comment"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="matrix-actions">
                  <button
                    type="button"
                    className="btn btn-danger btn-return matrix-actions-return-btn"
                    disabled={matrixReadOnly}
                    onClick={requestOpenReturnModal}
                    aria-label="Return case for corrections"
                  >
                    Return
                  </button>
                  <div className="matrix-actions-submit-group">
                    <button
                      type="button"
                      className="btn btn-outline btn-save-draft"
                      disabled={matrixReadOnly}
                      onClick={handleMatrixSaveDraft}
                    >
                      Save draft
                    </button>
                    <button
                      type="button"
                      className="btn btn-success btn-submit-review"
                      disabled={matrixReadOnly}
                      onClick={handleSubmit}
                      aria-label={
                        user.role === 'ceo'
                          ? `Submit “${currentCase.title}” to customs`
                          : `Submit “${currentCase.title}” to CEO`
                      }
                    >
                      {user.role === 'ceo' ? 'Submit to Customs' : 'Submit to CEO'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Field Inspection Popup — view value + evidence; edit only when not submitted to customs */}
      {inspectingCell && (
        <div className="modal-overlay" onClick={() => setInspectingCell(null)}>
          <div className="inspection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspection-header">
              <h3 className="inspection-title">
                {matrixReadOnly ? 'View' : 'Edit'}: {FIELD_LABELS[inspectingCell.field]}
              </h3>
              <button type="button" className="inspection-close" onClick={() => setInspectingCell(null)}>
                ✕
              </button>
            </div>
            <div className="inspection-content">
              <div className="inspection-declarant-block">
                <span className="inspection-declarant-label">Declarant value</span>
                {matrixReadOnly ? (
                  <div className="inspection-declarant-readonly">
                    {currentCase.fields[inspectingCell.field]?.trim() || '—'}
                  </div>
                ) : (
                  <div className="inspection-field-row">
                    <input
                      type="text"
                      className="inspection-input"
                      value={editingFieldValue}
                      onChange={(e) => setEditingFieldValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleInspectionOk();
                        }
                      }}
                      placeholder="Enter value..."
                    />
                    <button type="button" className="btn btn-sm btn-primary" onClick={handleInspectionOk}>
                      OK
                    </button>
                  </div>
                )}
              </div>
              {inspectionLinkedEvidence?.crossColumn && (
                <p className="inspection-cross-column-note">
                  Evidence for this field is linked on another document column; the preview below shows that
                  source file.
                </p>
              )}
              <div className={inspectionEvidenceStatusClass} role="status" aria-live="polite">
                {inspectionEvidenceStatusLabel}
              </div>
              <div
                className={
                  'inspection-preview' +
                  (inspectionLinkedEvidence ? ' inspection-preview--with-doc-bar' : '')
                }
              >
                {inspectionLinkedEvidence ? (
                  <>
                    <div className="inspection-preview-doc-bar">
                      <span className="inspection-preview-doc-bar-label">Linked file</span>
                      <span className="inspection-preview-doc-bar-name" title={inspectionLinkedEvidence.doc.name}>
                        {inspectionLinkedEvidence.doc.name}
                      </span>
                    </div>
                    <div ref={inspectionPreviewRef} className="inspection-preview-content">
                      {inspectionEvidenceIsPdf ? (
                        <>
                          <PdfJsPreview
                            dataUrl={inspectionLinkedEvidence.doc.dataUrl}
                            className="inspection-pdf-js"
                            fitMode="cover"
                            onPdfLayout={updateInspectionPdfLayout}
                          />
                          <div className="pdf-interaction-shield inspection-pdf-shield" aria-hidden={true} />
                        </>
                      ) : (
                        <img
                          src={inspectionLinkedEvidence.doc.dataUrl}
                          alt=""
                          className="inspection-doc-image"
                        />
                      )}
                      {inspectionLinkedEvidence.region &&
                        (!inspectionEvidenceIsPdf || inspectionPdfLayout) && (
                          <div
                            className="doc-region-layer"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              zIndex: 5,
                              pointerEvents: 'none',
                            }}
                          >
                            <div
                              className="inspection-region-marker linked"
                              style={(() => {
                                const disp = regionDisplayPercents(
                                  inspectionLinkedEvidence.region,
                                  inspectionPdfLayout,
                                );
                                return {
                                  left: `${disp.x}%`,
                                  top: `${disp.y}%`,
                                  width: `${disp.widthPct}%`,
                                  height: `${disp.heightPct}%`,
                                  minWidth: 20,
                                  minHeight: 20,
                                };
                              })()}
                            >
                              <span className="region-marker-inner"></span>
                            </div>
                          </div>
                        )}
                    </div>
                  </>
                ) : (
                  <div className="inspection-preview-empty">
                    <p>No evidence linked for this field</p>
                  </div>
                )}
              </div>
              {!matrixReadOnly && inspectionHasValue && (
                <div className="inspection-conflict-row">
                  <button
                    type="button"
                    className={`btn btn-sm ${inspectionManualConflict ? 'btn-outline inspection-conflict-clear' : 'btn-danger'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleInspectionManualConflict();
                    }}
                  >
                    {inspectionManualConflict ? 'Remove conflict' : 'Mark conflict'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {matrixUnsavedOpen && (
        <div className="modal-overlay" onClick={() => { matrixPendingLeaveRef.current = null; setMatrixUnsavedOpen(false); }}>
          <div className="modal-card unsaved-leave-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Unsaved work</h3>
            <p className="unsaved-leave-text">
              Your work is not saved as a draft. Do you want to save it before continuing?
            </p>
            <label className="unsaved-leave-checkbox">
              <input
                type="checkbox"
                checked={dontShowMatrixUnsavedAgain}
                onChange={(e) => setDontShowMatrixUnsavedAgain(e.target.checked)}
              />
              <span>Don&apos;t show this again</span>
            </label>
            <div className="modal-actions unsaved-leave-actions">
              <button type="button" className="btn btn-modal-cancel" onClick={matrixUnsavedDontSaveAndContinue}>
                Don&apos;t save
              </button>
              <button type="button" className="btn btn-primary" onClick={matrixUnsavedSaveDraftAndContinue}>
                Save draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && !matrixReadOnly && (
        <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
          <div className="return-modal" onClick={(e) => e.stopPropagation()}>
            <div className="return-modal-header">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <h3 className="return-modal-title">RETURN THE FILES</h3>
            </div>
            <textarea
              className="return-modal-textarea"
              placeholder="Add comments explaining why the case is being returned..."
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
            ></textarea>
            <div className="return-modal-actions">
              <button className="btn btn-modal-cancel" onClick={() => setShowReturnModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleReturn}>
                Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
