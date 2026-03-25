import React from 'react';
import { useNeoUi } from '../neo/NeoUiContext';
import Req1HelloWorld from '../pages/Req1HelloWorld';
import './caseflow-ui.css';

export function CaseStepHelloWorld() {
  const neo = useNeoUi();
  return (
    <div className={`cf-ui-card${neo ? ' neo-surface' : ''}`.trim()}>
      <div className="cf-ui-muted" style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#163a63' }}>
        CIS 4120 HW5 — Requirement 1
      </div>
      <h2 className="cf-ui-title">Hello world</h2>
      <p className="cf-ui-muted" style={{ marginTop: 8, marginBottom: 0 }}>
        One-screen React app running in a laptop browser; opening view renders “Hello World”.
      </p>
      <div style={{ marginTop: 12 }}>
        <Req1HelloWorld hideTitle />
      </div>
    </div>
  );
}

