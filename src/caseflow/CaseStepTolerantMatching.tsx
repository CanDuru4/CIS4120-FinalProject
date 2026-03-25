import React from 'react';
import { useNeoUi } from '../neo/NeoUiContext';
import Req7TolerantMatching from '../pages/Req7TolerantMatching';
import './caseflow-ui.css';

export function CaseStepTolerantMatching({ embeddedInWorkspace }: { embeddedInWorkspace?: boolean } = {}) {
  const neo = useNeoUi();
  return (
    <div
      className={[neo ? 'neo-surface' : '', embeddedInWorkspace && neo ? 'neo-step-embedded' : ''].filter(Boolean).join(' ') || undefined}
      style={{ display: 'grid', gap: embeddedInWorkspace && neo ? 10 : 14 }}
    >
      {!(embeddedInWorkspace && neo) ? (
        <div className="cf-ui-card">
          <div className="cf-ui-muted" style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#163a63' }}>
            {neo ? 'Matching rules' : 'CIS 4120 HW5 — Requirement 7'}
          </div>
          <h2 className="cf-ui-title">Tolerant textual matching</h2>
          <p className="cf-ui-muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Near-matches (e.g. company name punctuation, spacing on item description) should stay <strong>Match</strong>; clearly different values (e.g. invoice numbers)
            stay <strong>Mismatch</strong>.
          </p>
        </div>
      ) : null}
      <Req7TolerantMatching hideTitle />
    </div>
  );
}
