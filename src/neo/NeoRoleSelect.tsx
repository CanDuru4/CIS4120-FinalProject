import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserRole } from '../lib/roleDashboardData';
import { useNeoRole } from './NeoRoleContext';

const ROLES: Array<{ id: UserRole; icon: string; desc: string }> = [
  { id: 'Case Analyst', icon: '✎', desc: 'Create and manage cases' },
  { id: 'Lead Reviewer', icon: '🔍', desc: 'Review and approve' },
  { id: 'CEO', icon: '◆', desc: 'Executive submission queue' },
];

export function NeoRoleSelect() {
  const navigate = useNavigate();
  const { setRole } = useNeoRole();

  function pick(r: UserRole) {
    setRole(r);
    navigate('/hub');
  }

  return (
    <div className="neo-frame neo-role-page neo-role-page--photo">
      <div className="neo-role-photo-card">
        <h1 className="neo-page-title">Select your role</h1>
        <p className="neo-role-page__sub">Customs review workspace — create cases, upload documents, and move work through review.</p>
        <p className="neo-role-page__sub neo-role-page__sub--muted">Course prototype; some features are intentionally limited.</p>
        <div className="neo-role-grid">
          {ROLES.map((r) => (
            <button key={r.id} type="button" className="neo-role-card" onClick={() => pick(r.id)}>
              <div className="neo-role-icon">{r.icon}</div>
              <h2 className="neo-role-name">{r.id}</h2>
              <p className="neo-role-desc">{r.desc}</p>
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <button type="button" className="neo-btn neo-btn--secondary" onClick={() => navigate('/hub')}>
            Skip to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
