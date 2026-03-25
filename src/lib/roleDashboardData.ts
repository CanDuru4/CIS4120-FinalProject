import type { CaseWorkflowState } from '../state/caseStore';
import type { DashboardQueueRow } from '../state/dashboardQueueStore';

export type UserRole = 'Case Analyst' | 'Lead Reviewer' | 'CEO';

/** Used if Open case is re-enabled later (5173 deep links). */
export type DashboardEntryStep = 'upload' | 'parse' | 'compare' | 'evidence' | 'validate' | 'workflow';

/** Lead + CEO share the same prototype board: everything after analyst send (review queue + executive queue). */
function isLeadOrCeoPipelineRow(r: DashboardQueueRow) {
  return r.status === 'Ready for Review' || r.status === 'Ready to Submit';
}

export function dashboardRowsForRole(role: UserRole, rows: DashboardQueueRow[]): DashboardQueueRow[] {
  if (role === 'CEO' || role === 'Lead Reviewer') return rows.filter(isLeadOrCeoPipelineRow);
  return rows.filter((r) => r.status === 'Draft' || r.status === 'Returned for Changes');
}

export function queueActionsForRole(role: UserRole, status: CaseWorkflowState): string[] {
  if (role === 'Case Analyst') {
    if (status === 'Draft') return ['Continue in Upload / Parse steps', 'Send Files when ready for Lead'];
    if (status === 'Returned for Changes') return ['Address Lead feedback', 'Resubmit via Send Files'];
  }
  if (role === 'Lead Reviewer' && status === 'Ready for Review') {
    return ['Return to Case Analyst', 'Release to CEO (Ready to submit)'];
  }
  if (role === 'CEO' && status === 'Ready to Submit') return ['Executive submission (prototype view-only)'];
  return [];
}

export function entryStepToRoute(step: DashboardEntryStep): string {
  const map: Record<DashboardEntryStep, string> = {
    upload: '/req/3',
    parse: '/req/5',
    compare: '/req/6',
    evidence: '/req/8',
    validate: '/req/9',
    workflow: '/req/10',
  };
  return map[step];
}
