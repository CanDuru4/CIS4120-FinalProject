import React from 'react';
import { RoleDashboardPanel } from '../dashboard/RoleDashboardPanel';
import { NeoKanbanBoard } from '../neo/NeoKanbanBoard';
import { NeoPanel } from '../neo/NeoPanel';
import { useNeoRole } from '../neo/NeoRoleContext';
import './caseflow-ui.css';

type Props = { variant?: 'default' | 'neo' };

export function CaseStepDashboard({ variant = 'default' }: Props) {
  if (variant === 'neo') {
    return <CaseStepDashboardNeo />;
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="cf-ui-card" style={{ padding: 16 }}>
        <div className="cf-ui-muted" style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#163a63' }}>
          CIS 4120 HW5 — Requirement 11
        </div>
        <h2 className="cf-ui-title">Role-based dashboard visibility</h2>
        <p className="cf-ui-muted" style={{ marginTop: 8, marginBottom: 0 }}>
          <strong>Case Analyst</strong> sees <strong>Draft</strong> and <strong>Returned for Changes</strong>. <strong>Lead Reviewer</strong> sees{' '}
          <strong>Ready for Review</strong> (after Send Files). <strong>CEO</strong> only sees <strong>Ready to Submit</strong> after the Lead releases a case. A{' '}
          <strong>Draft</strong> row appears after extract + parse (Parse step), not on upload alone. <strong>Open case</strong> is disabled for now.
        </p>
      </div>
      <RoleDashboardPanel useCaseflowUi />
    </div>
  );
}

function CaseStepDashboardNeo() {
  const { role, setRole } = useNeoRole();
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <NeoPanel title="Requirement 11 — Role dashboard">
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: '#4a5568', lineHeight: 1.5 }}>
          Kanban uses the same queue as Req 11 / port 5173. <strong>Open case</strong> stays disabled. Role matches your selection on the hub (change below).
        </p>
      </NeoPanel>
      <NeoKanbanBoard role={role} onRoleChange={setRole} showRolePicker />
      <RoleDashboardPanel useCaseflowUi hideRolePicker forcedRole={role} variant="neo" />
    </div>
  );
}
