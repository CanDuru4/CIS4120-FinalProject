import React from 'react';
import { RoleDashboardPanel } from '../dashboard/RoleDashboardPanel';
import { NeoKanbanBoard } from './NeoKanbanBoard';
import { NeoPanel } from './NeoPanel';
import { useNeoRole } from './NeoRoleContext';

export function NeoReq11Route() {
  const { role, setRole } = useNeoRole();
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <NeoPanel title="Requirement 11: Role-based dashboard visibility">
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#4a5568', lineHeight: 1.55 }}>
          Fixed <strong>demo</strong> rows (tagged “Demo”, case IDs <code>DEMO-…</code>) always appear so you can see each status per role. The live queue is backed by{' '}
          <code>localStorage</code>. <strong>Draft</strong> rows appear after successful extract + parse, not when files are only stored. <strong>Send Files</strong> (Req 9) moves the
          active case to <strong>Ready for Review</strong>. Lead uses Req 10 / workflow to <strong>Return</strong> or <strong>Release to CEO</strong>.{' '}
          <strong>Open case</strong> stays disabled.
        </p>
      </NeoPanel>
      <NeoKanbanBoard role={role} onRoleChange={setRole} showRolePicker />
      <RoleDashboardPanel hideRolePicker forcedRole={role} variant="neo" />
    </div>
  );
}
