import React from 'react';
import { RoleDashboardPanel } from '../dashboard/RoleDashboardPanel';
import '../styles/theme.css';

export default function Req11RoleDashboard() {
  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Requirement 11: Role-based dashboard visibility</h2>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 700 }}>
          Fixed <strong>demo</strong> rows (tagged “Demo”, case IDs <code>DEMO-…</code>) always appear so you can see each status per role. The live queue is backed by{' '}
          <code>localStorage</code>. <strong>Draft</strong> rows appear after successful extract + parse (Req 3 “Extract + parse”, Req 4 analyze, or case-flow Parse step), not when files are only stored.{' '}
          <strong>Send Files</strong> (Req 9) moves the active case to{' '}
          <strong>Ready for Review</strong>. Lead uses Req 10 / workflow to <strong>Return</strong> or <strong>Release to CEO</strong>. <strong>Open case</strong> stays disabled.
        </p>
      </div>
      <RoleDashboardPanel />
    </div>
  );
}
