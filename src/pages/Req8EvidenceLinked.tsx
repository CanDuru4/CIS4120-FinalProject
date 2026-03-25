import React, { useEffect, useMemo, useState } from 'react';
import '../styles/theme.css';
import { getDeclarationText, getSupportingText } from '../lib/samplePdfs';
import { parseCaseFields } from '../lib/fieldParsing';
import { CHECKED_FIELDS, detectDiscrepancies, type FieldDiscrepancy } from '../lib/discrepancyDetection';
import type { FieldKey } from '../lib/fieldParsing';
import { loadCaseStore } from '../state/caseStore';

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
    <div style={{ marginTop: 14, border: '1px solid #cfd7e3', borderRadius: 16, padding: 14, background: '#ffffff' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 900, color: '#0f172a', fontSize: 14 }}>{labelForField(row.fieldKey)}</div>
        <div style={{ fontWeight: 900, fontSize: 13, color: '#334155' }}>
          Declaration: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{row.declarationValue ?? '-'}</span>
        </div>
        <div style={{ fontWeight: 900 }}>
          Status:{' '}
          <span style={{ fontSize: 12, border: '1px solid #d1dbe8', background: '#eef2f7', padding: '6px 10px', borderRadius: 999 }}>
            {row.status}
          </span>
        </div>
      </div>

      {row.evidence.length === 0 ? (
        <div style={{ marginTop: 12, color: '#334155', fontWeight: 800, fontSize: 13 }}>
          No evidence snippet was available for this field (classified as `Not Found`).
        </div>
      ) : (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {row.evidence.map((ev, idx) => (
            <div key={`${ev.documentLabel}-${idx}`} style={{ border: '1px solid #d1dbe8', borderRadius: 14, padding: 12 }}>
              <div style={{ fontWeight: 900, color: '#0f172a', fontSize: 13 }}>{ev.documentLabel}</div>
              <div style={{ marginTop: 6, fontWeight: 900, fontSize: 12, color: '#334155' }}>
                Extracted supporting value:{' '}
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{ev.supportingValue}</span>
              </div>
              <div style={{ marginTop: 6, fontWeight: 800, fontSize: 12, color: '#334155' }}>
                Evidence snippet:
                <div style={{ marginTop: 6, padding: 10, background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                  {ev.extractedEvidenceText}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Req8EvidenceLinked() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FieldDiscrepancy[] | null>(null);
  const [selected, setSelected] = useState<FieldKey>('companyName');
  const [caseLoadedAt, setCaseLoadedAt] = useState(0);

  const ordered = useMemo(() => CHECKED_FIELDS, []);

  async function loadDemo() {
    setLoading(true);
    setError(null);
    try {
      const declText = getDeclarationText();
      const ids = [1, 2, 3] as const;
      const supportingSections = ids.map((id) => ({
        id,
        text: getSupportingText(id),
      }));
      const parsed = parseCaseFields(declText, supportingSections);
      const discrepancies = detectDiscrepancies(parsed);
      setRows(discrepancies);
      setSelected('companyName');
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Failed to load demo case');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const caseModel = loadCaseStore();
      if (caseModel.discrepancies && caseModel.discrepancies.length > 0) {
        setRows(caseModel.discrepancies);
        setCaseLoadedAt(caseModel.updatedAt);
      }
    } catch {
      // ignore
    }
  }, []);

  const selectedRow = rows?.find((r) => r.fieldKey === selected);

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1040, margin: '0 auto' }}>
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #cfd7e3',
          borderRadius: 18,
          padding: 16,
        }}
      >
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Requirement 8: Evidence-linked review interface</h2>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 700 }}>
          Select a declaration field to display the document name + exact extracted evidence snippet used for the comparison.
        </p>
        {rows && caseLoadedAt ? (
          <div style={{ marginTop: 10, color: '#334155', fontWeight: 900, fontSize: 13 }}>
            Showing evidence from your latest parsed case.
          </div>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={loadDemo}
            disabled={loading}
            style={{
              border: 'none',
              padding: '10px 14px',
              borderRadius: 12,
              background: '#163a63',
              color: '#fff',
              fontWeight: 900,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Parsing...' : 'Load demo case'}
          </button>
        </div>
        {error ? <div style={{ marginTop: 12, color: '#991b1b', fontWeight: 900 }}>{error}</div> : null}
      </div>

      {rows ? (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
          <div style={{ border: '1px solid #cfd7e3', borderRadius: 16, background: '#ffffff', padding: 12 }}>
            <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Declaration fields</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {ordered.map((k) => {
                const row = rows.find((r) => r.fieldKey === k)!;
                const isActive = selected === k;
                const pill =
                  row.status === 'Match'
                    ? { background: 'rgba(207,233,212,0.9)', border: '1px solid rgba(122,170,138,0.55)', color: '#0f2f52' }
                    : row.status === 'Mismatch'
                      ? { background: 'rgba(253,230,138,0.95)', border: '1px solid rgba(245,158,11,0.35)', color: '#92400e' }
                      : { background: 'rgba(254,226,226,0.95)', border: '1px solid rgba(220,38,38,0.25)', color: '#991b1b' };
                return (
                  <button
                    key={k}
                    onClick={() => setSelected(k)}
                    style={{
                      textAlign: 'left',
                      border: isActive ? '2px solid #163a63' : `1px solid #d1dbe8`,
                      background: isActive ? '#f7fafc' : '#ffffff',
                      borderRadius: 14,
                      padding: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 900, color: '#0f172a', fontSize: 13 }}>{labelForField(k)}</div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 900, fontSize: 12, borderRadius: 999, padding: '6px 10px', ...pill }}>
                        {row.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedRow ? <EvidencePanel row={selectedRow} /> : null}
        </div>
      ) : null}
    </div>
  );
}

