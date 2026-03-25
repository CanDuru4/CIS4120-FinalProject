import React from 'react';
import { useNeoUi } from '../neo/NeoUiContext';
import type { CaseStore } from '../state/caseStore';
import type { FieldDiscrepancy } from '../lib/discrepancyDetection';
import { CHECKED_FIELDS } from '../lib/discrepancyDetection';
import type { FieldKey } from '../lib/fieldParsing';
import '../styles/theme.css';

function labelForField(key: FieldKey) {
  switch (key) {
    case 'companyName':
      return 'Company Name';
    case 'grossWeightKg':
      return 'Gross Weight';
    case 'invoiceNumber':
      return 'Invoice Number';
    case 'itemDescription':
      return 'Item Description';
    case 'quantity':
      return 'Quantity';
  }
}

function StatusPill({ status }: { status: FieldDiscrepancy['status'] }) {
  const style =
    status === 'Match'
      ? { border: '1px solid rgba(122,170,138,0.55)', background: 'rgba(207,233,212,0.9)', color: '#0f2f52' }
      : status === 'Mismatch'
        ? { border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(253,230,138,0.95)', color: '#92400e' }
        : { border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(254,226,226,0.95)', color: '#991b1b' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, fontWeight: 950, fontSize: 13, ...style }}>
      {status}
    </span>
  );
}

type Props = {
  caseModel: CaseStore;
  onParseAgain: () => Promise<{ ok: boolean; message: string }> | Promise<any>;
  embeddedInWorkspace?: boolean;
};

export function CaseStepCompare(props: Props) {
  const { caseModel, embeddedInWorkspace } = props;
  const neo = useNeoUi();
  const results = caseModel.discrepancies;

  const ordered = CHECKED_FIELDS;

  return (
    <div
      className={[neo ? 'neo-surface' : '', embeddedInWorkspace && neo ? 'neo-step-embedded' : ''].filter(Boolean).join(' ') || undefined}
      style={{ display: 'grid', gap: embeddedInWorkspace && neo ? 10 : 14 }}
    >
      {embeddedInWorkspace && neo ? (
        results ? (
          <div className="cf-ui-card">
            <div style={{ color: '#334155', fontWeight: 900, fontSize: 12 }}>Showing `{results.length}` checked fields.</div>
          </div>
        ) : null
      ) : (
        <div className="cf-ui-card">
          <div className="cf-ui-muted" style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#163a63' }}>
            {neo ? 'Compare · declaration vs supporting' : 'CIS 4120 HW5 — Requirement 6'}
          </div>
          <h2 className="cf-ui-title">Compare &amp; classify</h2>
          <p className="cf-ui-muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Compare declaration fields to supporting documents; classify at least five checked fields as <code>Match</code>, <code>Mismatch</code>, or{' '}
            <code>Not Found</code>.
          </p>
          {results ? (
            <div style={{ marginTop: 10, color: '#334155', fontWeight: 900, fontSize: 12 }}>
              Showing `{results.length}` checked fields.
            </div>
          ) : null}
        </div>
      )}

      {results ? (
        <div className="cf-ui-card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 13, color: '#334155', borderBottom: '1px solid #cfd7e3', paddingBottom: 10 }}>Field</th>
                <th style={{ textAlign: 'left', fontSize: 13, color: '#334155', borderBottom: '1px solid #cfd7e3', paddingBottom: 10 }}>Declaration value</th>
                <th style={{ textAlign: 'left', fontSize: 13, color: '#334155', borderBottom: '1px solid #cfd7e3', paddingBottom: 10 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((k) => {
                const row = results.find((r) => r.fieldKey === k)!;
                return (
                  <tr key={k}>
                    <td style={{ padding: '12px 0', color: '#0f172a', fontWeight: 950 }}>{labelForField(k)}</td>
                    <td style={{ padding: '12px 0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', color: '#334155', fontWeight: 850 }}>
                      {row.declarationValue ?? '-'}
                    </td>
                    <td style={{ padding: '12px 0' }}>
                      <StatusPill status={row.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16, color: '#334155', fontWeight: 900 }}>
          {neo ? 'No comparison yet. Run Parse first, then return to this step.' : 'No discrepancies detected yet. Run Requirement 5 (parse) first.'}
        </div>
      )}
    </div>
  );
}

