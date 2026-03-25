import React from 'react';
import { useNeoUi } from '../neo/NeoUiContext';
import Req2HelloStyles from '../pages/Req2HelloStyles';
import './caseflow-ui.css';

export function CaseStepHelloStyles() {
  const neo = useNeoUi();
  return (
    <div className={`cf-ui-card${neo ? ' neo-surface' : ''}`.trim()}>
      <div className="cf-ui-muted" style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#163a63' }}>
        CIS 4120 HW5 — Requirement 2
      </div>
      <h2 className="cf-ui-title">Hello styles</h2>
      <p className="cf-ui-muted" style={{ marginTop: 8, marginBottom: 0 }}>
        Colors, typography hierarchy, icons, badges, and warning styles for the customs-review UI.
      </p>
      <div style={{ marginTop: 12 }}>
        <Req2HelloStyles hideTitle />
      </div>
    </div>
  );
}

