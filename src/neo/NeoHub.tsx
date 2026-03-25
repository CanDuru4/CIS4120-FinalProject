import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { UserRole } from '../lib/roleDashboardData';
import { NeoKanbanBoard } from './NeoKanbanBoard';
import { NeoDashboardPhotoGrid } from './NeoDashboardPhotoGrid';
import { NeoPageShell } from './NeoPageShell';
import { useNeoRole } from './NeoRoleContext';

const HUB_VIEW_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'Case Analyst', label: 'Case analyst' },
  { value: 'Lead Reviewer', label: 'Reviewer' },
  { value: 'CEO', label: 'CEO' },
];

export function NeoHub() {
  const { role, setRole } = useNeoRole();
  const [labOpen, setLabOpen] = useState(false);
  const isAnalyst = role === 'Case Analyst';

  return (
    <NeoPageShell
      title="Dashboard"
      subtitle={
        isAnalyst
          ? 'Case workspace — create cases and complete the customs flow.'
          : 'Executive and lead review queue — same cases as the integrated review board.'
      }
      showBackHub={false}
      wide
      headerVariant="customs"
      shellClassName="neo-shell--hub-photo"
      bodyClassName="neo-shell-body--customs-hub"
    >
      <div className="neo-hub-view-switch" role="tablist" aria-label="Prototype dashboard view">
        <span className="neo-hub-view-switch__label">View as</span>
        <div className="neo-hub-view-switch__pills">
          {HUB_VIEW_OPTIONS.map(({ value, label }) => {
            const selected = role === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`neo-hub-view-pill ${selected ? 'neo-hub-view-pill--active' : ''}`}
                onClick={() => setRole(value)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {isAnalyst ? <NeoDashboardPhotoGrid role={role} /> : null}

      {!isAnalyst ? (
        <div className="neo-hub-kanban-block">
          <div className="neo-section-title">Workflow board</div>
          <NeoKanbanBoard role={role} onRoleChange={setRole} showRolePicker={false} />
        </div>
      ) : null}

      <div className="neo-hub-lab">
        <button type="button" className="neo-hub-lab-toggle" onClick={() => setLabOpen((o) => !o)} aria-expanded={labOpen}>
          <span className="neo-hub-lab-toggle__caret" aria-hidden>
            {labOpen ? '▼' : '▶'}
          </span>
          <span className="neo-hub-lab-toggle__text">Lab — requirement routes (grading)</span>
        </button>
        <div className="neo-hub-lab-footer">
          <Link to="/lab" className="neo-hub-lab-link">
            Open full lab page
          </Link>
        </div>
        {labOpen ? (
          <nav className="neo-req-nav neo-req-nav--lab" aria-label="Requirement prototypes">
            {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
              <Link key={n} to={`/req/${n}`}>
                {n}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </NeoPageShell>
  );
}
