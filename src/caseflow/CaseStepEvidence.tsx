import React, { useEffect, useMemo, useState } from 'react';
import { useNeoUi } from '../neo/NeoUiContext';
import type { CaseStore } from '../state/caseStore';
import type { FieldKey, ParsedFields } from '../lib/fieldParsing';
import type { FieldDiscrepancy } from '../lib/discrepancyDetection';
import { CHECKED_FIELDS } from '../lib/discrepancyDetection';
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

function EvidencePanel({ row }: { row: FieldDiscrepancy }) {
  return (
    <div className="cf-ui-card">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 950, color: '#0f172a', fontSize: 16 }}>{labelForField(row.fieldKey)}</div>
        <span className={`cf-pill ${row.status === 'Match' ? 'cf-pill-match' : row.status === 'Mismatch' ? 'cf-pill-mismatch' : 'cf-pill-notfound'}`}>
          {row.status}
        </span>
      </div>

      <div style={{ marginTop: 12, color: '#334155', fontWeight: 900, fontSize: 13 }}>
        Declaration value:{' '}
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{row.declarationValue ?? '-'}</span>
      </div>

      {row.evidence.length === 0 ? (
        <div style={{ marginTop: 12, color: '#334155', fontWeight: 900, fontSize: 13 }}>
          No evidence snippet available (classified as `Not Found`).
        </div>
      ) : (
        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          {row.evidence.map((ev, idx) => (
            <div key={`${ev.documentLabel}-${idx}`} style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#f8fafc' }}>
              <div style={{ fontWeight: 950, color: '#0f172a' }}>{ev.documentLabel}</div>
              <div style={{ marginTop: 6, color: '#334155', fontWeight: 900, fontSize: 13 }}>
                Supporting value: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{ev.supportingValue}</span>
              </div>
              <div style={{ marginTop: 8, fontWeight: 900, color: '#334155', fontSize: 12 }}>Evidence snippet</div>
              <pre
                style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 14,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  overflow: 'auto',
                  fontSize: 12,
                  color: '#0f172a',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {ev.extractedEvidenceText}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = { caseModel: CaseStore; embeddedInWorkspace?: boolean };

export function CaseStepEvidence({ caseModel, embeddedInWorkspace }: Props) {
  const neo = useNeoUi();
  const rows = caseModel.discrepancies;
  const [selected, setSelected] = useState<FieldKey>('companyName');

  useEffect(() => {
    if (!rows || rows.length === 0) return;
    const preferred = rows.find((r) => r.status !== 'Match') ?? rows[0];
    setSelected(preferred.fieldKey);
  }, [rows]);

  const ordered = useMemo(() => CHECKED_FIELDS, []);

  const selectedRow = rows?.find((r) => r.fieldKey === selected) ?? null;

  return (
    <div
      className={[neo ? 'neo-surface' : '', embeddedInWorkspace && neo ? 'neo-step-embedded' : ''].filter(Boolean).join(' ') || undefined}
      style={{ display: 'grid', gap: embeddedInWorkspace && neo ? 10 : 14 }}
    >
      {embeddedInWorkspace && neo ? null : (
        <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
          <div style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#163a63', fontWeight: 950 }}>
            {neo ? 'Evidence · supporting links' : 'CIS 4120 HW5 — Requirement 8'}
          </div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>Evidence-linked review</h2>
          <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 850, fontSize: 13 }}>
            Select a declaration field; the UI shows linked evidence from the relevant supporting document(s), including document name and the extracted value or text
            snippet used for the comparison.
          </p>
        </div>
      )}

      {rows ? (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
          <div style={{ border: '1px solid #cfd7e3', borderRadius: 18, background: '#ffffff', padding: 12 }}>
            <div style={{ fontWeight: 950, color: '#0f172a', marginBottom: 8 }}>Fields</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {ordered.map((k) => {
                const row = rows.find((r) => r.fieldKey === k)!;
                const isActive = selected === k;
                const pillClass = row.status === 'Match' ? 'cf-pill-match' : row.status === 'Mismatch' ? 'cf-pill-mismatch' : 'cf-pill-notfound';
                return (
                  <button
                    key={k}
                    onClick={() => setSelected(k)}
                    style={{
                      textAlign: 'left',
                      border: isActive ? '2px solid #163a63' : '1px solid #d1dbe8',
                      background: isActive ? '#f7fafc' : '#ffffff',
                      borderRadius: 16,
                      padding: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 950, color: '#0f172a', fontSize: 13 }}>{labelForField(k)}</div>
                    <div style={{ marginTop: 8 }}>
                      <span className={`cf-pill ${pillClass}`}>{row.status}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedRow ? <EvidencePanel row={selectedRow} /> : null}
        </div>
      ) : (
        <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16, color: '#334155', fontWeight: 900 }}>
          {neo
            ? 'No evidence yet. Complete Parse and Compare so fields are linked to supporting documents.'
            : 'No evidence available yet. Complete Requirements 5–6 (parse, then compare) first.'}
        </div>
      )}
    </div>
  );
}

