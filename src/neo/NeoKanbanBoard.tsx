import React, { useEffect, useMemo, useState } from 'react';
import type { UserRole } from '../lib/roleDashboardData';
import { dashboardRowsForRole, queueActionsForRole } from '../lib/roleDashboardData';
import type { DashboardQueueRow } from '../state/dashboardQueueStore';
import { getDashboardRowsForDisplay, isDemoDashboardRow, loadDashboardQueue } from '../state/dashboardQueueStore';
import { loadCaseStore } from '../state/caseStore';
import { NeoButton } from './NeoButton';

type KanColumn = 'missing' | 'draft' | 'review' | 'returned' | 'done';

const COLS: Array<{ key: KanColumn; label: string; classSuffix: string }> = [
  { key: 'missing', label: 'Missing ev.', classSuffix: 'missing' },
  { key: 'draft', label: 'Drafting', classSuffix: 'draft' },
  { key: 'review', label: 'Ready for review', classSuffix: 'review' },
  { key: 'returned', label: 'Returned (fix)', classSuffix: 'returned' },
  { key: 'done', label: 'Completed', classSuffix: 'done' },
];

function routeRowToColumn(row: DashboardQueueRow): KanColumn {
  const store = loadCaseStore();
  if (row.status === 'Draft') {
    if (row.caseId === store.caseId && !store.parsed) return 'missing';
    return 'draft';
  }
  if (row.status === 'Returned for Changes') return 'returned';
  if (row.status === 'Ready for Review') return 'review';
  if (row.status === 'Ready to Submit') return 'done';
  return 'draft';
}

type Props = {
  role: UserRole;
  onRoleChange?: (r: UserRole) => void;
  showRolePicker?: boolean;
  dense?: boolean;
};

export function NeoKanbanBoard({ role, onRoleChange, showRolePicker = true, dense }: Props) {
  const [queueTick, setQueueTick] = useState(0);

  useEffect(() => {
    const onChange = () => setQueueTick((t) => t + 1);
    window.addEventListener('hw5-dashboard-queue-changed', onChange);
    return () => window.removeEventListener('hw5-dashboard-queue-changed', onChange);
  }, []);

  const allRows = useMemo(() => getDashboardRowsForDisplay(), [queueTick]);
  const visible = useMemo(() => dashboardRowsForRole(role, allRows), [role, allRows]);
  const userRowCount = useMemo(() => loadDashboardQueue().length, [queueTick]);

  const byCol = useMemo(() => {
    const m: Record<KanColumn, DashboardQueueRow[]> = {
      missing: [],
      draft: [],
      review: [],
      returned: [],
      done: [],
    };
    for (const row of visible) {
      m[routeRowToColumn(row)].push(row);
    }
    return m;
  }, [visible]);

  return (
    <div>
      {showRolePicker && onRoleChange ? (
        <div className="neo-role-inline" style={{ marginBottom: 14 }}>
          <span>View as:</span>
          {(['Case Analyst', 'Lead Reviewer', 'CEO'] as const).map((r) => (
            <label key={r}>
              <input type="radio" name="neoKanbanRole" checked={role === r} onChange={() => onRoleChange(r)} />
              {r}
            </label>
          ))}
          <span style={{ color: '#4a5568', fontSize: '0.8rem' }}>
            ({visible.length} visible · {userRowCount} session rows)
          </span>
        </div>
      ) : null}

      <div className="neo-kanban">
        {COLS.map((c) => (
          <div key={c.key} className={`neo-kan-col neo-kan-col--${c.classSuffix}`}>
            <div className="neo-kan-col__head">{c.label}</div>
            <div className="neo-kan-col__body">
              {byCol[c.key].map((row) => (
                <NeoKanbanCard key={row.id} row={row} role={role} dense={dense} />
              ))}
              {byCol[c.key].length === 0 && !dense ? (
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#718096', padding: 8 }}>—</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {role === 'CEO' && byCol.done.length > 0 ? (
        <div className="neo-kan-success-banner">Submitted 15 documents to customs</div>
      ) : null}
    </div>
  );
}

function NeoKanbanCard({ row, role, dense }: { row: DashboardQueueRow; role: UserRole; dense?: boolean }) {
  const actions = queueActionsForRole(role, row.status);
  return (
    <div className="neo-kan-card">
      <div className="neo-kan-card__top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="neo-sq neo-sq--b" />
          <span className="neo-kan-card__title">{row.title}</span>
        </div>
        <span className="neo-kan-card__id" title={row.caseId}>
          #{row.caseId}
        </span>
      </div>
      <div style={{ fontSize: '0.72rem', color: '#718096', fontWeight: 700, marginTop: 4 }}>by User (prototype)</div>
      {isDemoDashboardRow(row) ? (
        <div style={{ marginTop: 8 }}>
          <span className="neo-badge-demo">Demo</span>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <span className="neo-badge-new">New</span>
        </div>
      )}
      {!dense ? (
        <div className="neo-kan-meta">
          <div className="neo-kan-meta__row">
            <span className="neo-sq neo-sq--y" />
            {row.status}
          </div>
          {actions.slice(0, 2).map((a) => (
            <div key={a} className="neo-kan-meta__row">
              <span className="neo-sq neo-sq--g" />
              {a}
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: 10 }}>
        <NeoButton variant="secondary" size="sm" disabled style={{ width: '100%' }}>
          Open case
        </NeoButton>
      </div>
    </div>
  );
}
