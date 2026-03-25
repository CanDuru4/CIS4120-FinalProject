import type { CaseWorkflowState } from './caseStore';
import { loadCaseStore } from './caseStore';

export type DashboardQueueRow = {
  id: string;
  caseId: string;
  title: string;
  summary: string;
  status: CaseWorkflowState;
  createdAt: number;
  updatedAt: number;
};

/** Fixed examples for each workflow state (not persisted). Open case stays disabled in the UI. */
export const DEMO_DASHBOARD_ROWS: DashboardQueueRow[] = [
  {
    id: 'demo-state-draft-a',
    caseId: 'DEMO-1001',
    title: 'Maritime parts shipment',
    summary: 'declaration + 3 supporting PDFs on file; not yet sent to Lead.',
    status: 'Draft',
    createdAt: 1_700_001_000_000,
    updatedAt: 1_700_001_000_000,
  },
  {
    id: 'demo-state-draft-b',
    caseId: 'DEMO-1002',
    title: 'Electronics consolidation',
    summary: 'Upload complete; analyst still running parse / compare.',
    status: 'Draft',
    createdAt: 1_700_001_100_000,
    updatedAt: 1_700_001_100_000,
  },
  {
    id: 'demo-state-returned',
    caseId: 'DEMO-1003',
    title: 'Textiles — invoice variance',
    summary: 'Lead returned: reconcile invoice line vs supporting doc 2.',
    status: 'Returned for Changes',
    createdAt: 1_700_001_200_000,
    updatedAt: 1_700_001_250_000,
  },
  {
    id: 'demo-state-review-a',
    caseId: 'DEMO-2001',
    title: 'Food ingredients batch',
    summary: 'Analyst sent files; waiting for Lead decision.',
    status: 'Ready for Review',
    createdAt: 1_700_001_300_000,
    updatedAt: 1_700_001_300_000,
  },
  {
    id: 'demo-state-review-b',
    caseId: 'DEMO-2002',
    title: 'Machinery spares',
    summary: 'Submitted with documented exceptions in Send Files.',
    status: 'Ready for Review',
    createdAt: 1_700_001_400_000,
    updatedAt: 1_700_001_400_000,
  },
  {
    id: 'demo-state-ceo-a',
    caseId: 'DEMO-3001',
    title: 'Pharma cold chain',
    summary: 'Lead released to CEO; executive filing window.',
    status: 'Ready to Submit',
    createdAt: 1_700_001_500_000,
    updatedAt: 1_700_001_500_000,
  },
  {
    id: 'demo-state-ceo-b',
    caseId: 'DEMO-3002',
    title: 'Consumer goods PO #4481',
    summary: 'Final packet ready for executive submission.',
    status: 'Ready to Submit',
    createdAt: 1_700_001_600_000,
    updatedAt: 1_700_001_600_000,
  },
];

export function isDemoDashboardRow(row: DashboardQueueRow): boolean {
  return row.id.startsWith('demo-state-');
}

/** Demo rows first (for teaching each state), then real rows from localStorage. */
export function getDashboardRowsForDisplay(): DashboardQueueRow[] {
  return [...DEMO_DASHBOARD_ROWS, ...loadDashboardQueue()];
}

const QUEUE_KEY = 'hw5_dashboard_queue_v1';

function safeParse(s: string | null): DashboardQueueRow[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s) as DashboardQueueRow[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function loadDashboardQueue(): DashboardQueueRow[] {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(QUEUE_KEY));
}

export function saveDashboardQueue(rows: DashboardQueueRow[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(rows));
}

export function notifyDashboardQueueChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('hw5-dashboard-queue-changed'));
}

/** After extract + parse succeeds: draft row (expects caseId already set on the case). Skips if this caseId is already in the queue. */
/** Title/summary for a queue row when the active case in localStorage matches `caseId`. */
export function queueLabelsFromActiveCase(caseId: string): { title: string; summary: string; storeMatches: boolean } {
  const cm = loadCaseStore();
  if (cm.caseId !== caseId) {
    return { title: caseId, summary: 'Updated from case flow', storeMatches: false };
  }
  const names = cm.files.map((f) => f.fileName).filter(Boolean);
  const decl = cm.files.find((f) => f.role === 'declaration');
  return {
    title: decl?.fileName ?? caseId,
    summary: names.length ? names.join(', ') : 'Updated from case flow',
    storeMatches: true,
  };
}

export function appendDraftQueueRow(caseStore: { caseId: string; files: { role: string; fileName: string }[] }) {
  const q = loadDashboardQueue();
  if (q.some((r) => r.caseId === caseStore.caseId)) return;

  const names = caseStore.files.map((f) => f.fileName).filter(Boolean);
  const summary = names.length ? names.join(', ') : '(no file names)';
  const decl = caseStore.files.find((f) => f.role === 'declaration');
  const row: DashboardQueueRow = {
    id: `q_${caseStore.caseId}_${Date.now()}`,
    caseId: caseStore.caseId,
    title: decl?.fileName ?? caseStore.caseId,
    summary,
    status: 'Draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveDashboardQueue(q.concat([row]));
  notifyDashboardQueueChanged();
}

/**
 * Set status on all rows for this caseId. If no row exists yet (e.g. Send Files without a prior upload row),
 * append a single row so the Lead/CEO dashboards still update.
 */
export function setDashboardQueueStatusForCase(caseId: string, status: CaseWorkflowState) {
  const q = loadDashboardQueue();
  const has = q.some((r) => r.caseId === caseId);
  const { title, summary, storeMatches } = queueLabelsFromActiveCase(caseId);
  if (!has) {
    saveDashboardQueue(
      q.concat([
        {
          id: `q_${caseId}_${Date.now()}`,
          caseId,
          title,
          summary,
          status,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]),
    );
  } else {
    saveDashboardQueue(
      q.map((r) =>
        r.caseId === caseId
          ? {
              ...r,
              status,
              updatedAt: Date.now(),
              ...(storeMatches ? { title, summary } : {}),
            }
          : r,
      ),
    );
  }
  notifyDashboardQueueChanged();
}
