import React, { useEffect, useMemo, useState } from 'react';
import type { CaseWorkflowState } from '../state/caseStore';
import { dashboardRowsForRole, queueActionsForRole, type UserRole } from '../lib/roleDashboardData';
import { DEMO_DASHBOARD_ROWS, getDashboardRowsForDisplay, isDemoDashboardRow, loadDashboardQueue } from '../state/dashboardQueueStore';
import '../caseflow/caseflow-ui.css';

export type RoleDashboardPanelProps = {
  className?: string;
  useCaseflowUi?: boolean;
  /** When true, skip “View as” radios (e.g. neo flow uses hub / kanban role). */
  hideRolePicker?: boolean;
  /** When set with hideRolePicker, filter rows with this role instead of internal state. */
  forcedRole?: UserRole;
  /** Neo-brutalist table chrome for port 5175. */
  variant?: 'default' | 'neo';
};

function workflowPillClass(status: CaseWorkflowState) {
  switch (status) {
    case 'Draft':
      return 'cf-workflowDraft';
    case 'Returned for Changes':
      return 'cf-workflowReturned';
    case 'Ready for Review':
      return 'cf-workflowReview';
    case 'Ready to Submit':
      return 'cf-workflowCEO';
    default:
      return 'cf-workflowDraft';
  }
}

export function RoleDashboardPanel({
  className,
  useCaseflowUi,
  hideRolePicker,
  forcedRole,
  variant = 'default',
}: RoleDashboardPanelProps) {
  const [role, setRole] = useState<UserRole>('Case Analyst');
  const effectiveRole = forcedRole ?? role;
  const [queueTick, setQueueTick] = useState(0);

  useEffect(() => {
    const onChange = () => setQueueTick((t) => t + 1);
    window.addEventListener('hw5-dashboard-queue-changed', onChange);
    return () => window.removeEventListener('hw5-dashboard-queue-changed', onChange);
  }, []);

  const { allRows, userRowCount } = useMemo(() => {
    const user = loadDashboardQueue();
    return { allRows: getDashboardRowsForDisplay(), userRowCount: user.length };
  }, [queueTick]);
  const visible = useMemo(() => dashboardRowsForRole(effectiveRole, allRows), [effectiveRole, allRows]);

  const cardClass = useCaseflowUi ? 'cf-ui-card' : '';
  const neoTable = variant === 'neo';
  const tableWrapStyle: React.CSSProperties = useCaseflowUi
    ? {}
    : { background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 };

  return (
    <div className={className} style={{ display: 'grid', gap: 14 }}>
      {!hideRolePicker ? (
        <div className={cardClass} style={useCaseflowUi ? { padding: 16 } : { ...tableWrapStyle, padding: 16 }}>
          <div style={{ fontWeight: 950, color: '#0f172a', marginBottom: 8 }}>View as</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['Case Analyst', 'Lead Reviewer', 'CEO'] as const).map((r) => (
              <label key={r} style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 900, color: '#0f172a', cursor: 'pointer' }}>
                <input type="radio" name="dashRole" checked={role === r} onChange={() => setRole(r)} />
                {r}
              </label>
            ))}
          </div>
          <div style={{ marginTop: 10, color: '#334155', fontWeight: 850, fontSize: 13 }}>
            Flow: <strong>Draft</strong> → <strong>Ready for Review</strong> (Lead) → <strong>Ready to Submit</strong> (CEO).{' '}
            <strong>Returned for Changes</strong> sends a case back to the Case Analyst from the Lead.
          </div>
          <div style={{ marginTop: 8, color: '#334155', fontWeight: 850, fontSize: 13 }}>
            Showing <strong>{visible.length}</strong> case{visible.length === 1 ? '' : 's'} for this role.{' '}
            <strong>{DEMO_DASHBOARD_ROWS.length}</strong> demo rows (every state) + <strong>{userRowCount}</strong> from your session.
          </div>
        </div>
      ) : null}

      <div
        className={neoTable ? 'neo-panel' : cardClass}
        style={neoTable ? { padding: 0, overflow: 'hidden' } : useCaseflowUi ? { padding: 0, overflow: 'hidden' } : tableWrapStyle}
      >
        <div style={{ padding: 16, borderBottom: neoTable ? '2px solid #000' : '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 950, color: '#0f172a' }}>Case queue</div>
          <div style={{ marginTop: 6, color: '#334155', fontWeight: 850, fontSize: 13 }}>
            <strong>Demo</strong> rows (case IDs <code>DEMO-…</code>) illustrate each status for each role. Your uploads append below. <strong>Send Files</strong> moves the
            active case to Lead as <strong>Ready for Review</strong>. Open case is disabled everywhere for now.
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: '#64748b', fontWeight: 950 }}>Case</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: '#64748b', fontWeight: 950 }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: '#64748b', fontWeight: 950 }}>Files / summary</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: '#64748b', fontWeight: 950 }}>Actions (this role)</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 12, color: '#64748b', fontWeight: 950 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const actions = queueActionsForRole(effectiveRole, row.status);
                return (
                  <tr key={row.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontWeight: 950, color: '#0f172a' }}>{row.caseId}</span>
                        {isDemoDashboardRow(row) ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 950,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              padding: '4px 8px',
                              borderRadius: 999,
                              border: '1px solid #bfd6ff',
                              background: '#f0f6ff',
                              color: '#163a63',
                            }}
                          >
                            Demo
                          </span>
                        ) : null}
                      </div>
                      <div style={{ marginTop: 4, fontWeight: 900, color: '#334155', fontSize: 13 }}>{row.title}</div>
                    </td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <span
                        className={workflowPillClass(row.status)}
                        style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, fontWeight: 950, fontSize: 12 }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', color: '#334155', fontWeight: 850, fontSize: 13, maxWidth: 320 }}>
                      {row.summary}
                    </td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontWeight: 850, fontSize: 13 }}>
                        {actions.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        disabled
                        className="cf-ui-primaryBtn"
                        title="Open case is disabled for now"
                        style={{ opacity: 0.45, cursor: 'not-allowed' }}
                      >
                        Open case
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visible.length === 0 ? (
          <div style={{ padding: 16, color: '#334155', fontWeight: 900 }}>
            {effectiveRole === 'CEO'
              ? 'No cases are Ready to submit yet. Lead reviewers must release a case from Ready for Review first.'
              : effectiveRole === 'Lead Reviewer'
                ? 'No cases in Ready for Review. Analysts must parse a case, then Send Files (Req 9).'
                : 'No Draft or Returned cases. Run extract + parse (Req 3 / case-flow Parse step) to add a Draft row.'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
