import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { UserRole } from '../lib/roleDashboardData';
import { dashboardRowsForRole } from '../lib/roleDashboardData';
import { getDashboardRowsForDisplay, isDemoDashboardRow } from '../state/dashboardQueueStore';
import { NeoButton } from './NeoButton';

type Props = {
  role: UserRole;
};

export function NeoDashboardPhotoGrid({ role }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    window.addEventListener('hw5-dashboard-queue-changed', fn);
    return () => window.removeEventListener('hw5-dashboard-queue-changed', fn);
  }, []);

  const all = useMemo(() => getDashboardRowsForDisplay(), [tick]);
  const visible = useMemo(() => dashboardRowsForRole(role, all), [role, all, tick]);
  const openDrafts = useMemo(() => visible.filter((r) => r.status === 'Draft' || r.status === 'Returned for Changes'), [visible]);
  const recent = useMemo(() => [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4), [all, tick]);

  return (
    <div className="neo-dash-photo-grid">
      <div className="neo-dash-photo-card">
        <div className="neo-dash-photo-card__head">
          <span className="neo-dash-photo-card__title">{openDrafts.length} Open cases</span>
          <span className="neo-dash-photo-pill neo-dash-photo-pill--flag">0 Flagged</span>
        </div>
        <div className="neo-dash-photo-card__body">
          {openDrafts.length === 0 ? (
            <p className="neo-dash-photo-empty">No open cases for this role.</p>
          ) : (
            <ul className="neo-dash-photo-list">
              {openDrafts.slice(0, 4).map((r) => (
                <li key={r.id} className="neo-dash-photo-list-item">
                  <span className="neo-dash-photo-doc" aria-hidden>
                    📄
                  </span>
                  <div>
                    <div className="neo-dash-photo-case-name">{r.title}</div>
                    <div className="neo-dash-photo-case-id">{r.caseId}</div>
                  </div>
                  <span className="neo-dash-photo-pill neo-dash-photo-pill--new">{isDemoDashboardRow(r) ? 'Demo' : 'New'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="neo-dash-photo-card">
        <div className="neo-dash-photo-card__head">
          <span className="neo-dash-photo-card__title">Recent activity</span>
          <div className="neo-dash-photo-filters">
            <button type="button" className="neo-dash-photo-chip">
              All
            </button>
            <button type="button" className="neo-dash-photo-chip" disabled>
              Filter
            </button>
          </div>
        </div>
        <div className="neo-dash-photo-card__body">
          {recent.length === 0 ? (
            <p className="neo-dash-photo-empty">No activity yet.</p>
          ) : (
            <ul className="neo-dash-photo-activity">
              {recent.map((r) => (
                <li key={r.id} className="neo-dash-photo-activity-row">
                  <span className="neo-dash-photo-doc" aria-hidden>
                    📄
                  </span>
                  <div>
                    <div className="neo-dash-photo-case-name">{r.caseId}</div>
                    <div className="neo-dash-photo-meta">{r.status}</div>
                  </div>
                  <span className="neo-dash-photo-pill neo-dash-photo-pill--submitted">Updated</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="neo-dash-photo-card neo-dash-photo-card--upload">
        <div className="neo-dash-photo-card__head">
          <span className="neo-dash-photo-card__title">File upload</span>
        </div>
        <div className="neo-dash-photo-card__body neo-dash-photo-drop">
          <div className="neo-dash-photo-icons">
            <span>📕</span>
            <span>📁</span>
          </div>
          <p className="neo-dash-photo-drop-text">Drag and drop to upload files, or open the case flow to create a new case.</p>
          <Link to="/caseflow" style={{ textDecoration: 'none' }}>
            <NeoButton variant="primary">Create case</NeoButton>
          </Link>
        </div>
      </div>

      <div className="neo-dash-photo-card neo-dash-photo-card--cta">
        <Link to="/caseflow" style={{ textDecoration: 'none', display: 'block' }}>
          <NeoButton variant="primary" style={{ width: '100%', justifyContent: 'center' }}>
            + Create case
          </NeoButton>
        </Link>
        <p className="neo-dash-photo-cta-note">Opens the full stepper (same logic as port 5174).</p>
      </div>
    </div>
  );
}
