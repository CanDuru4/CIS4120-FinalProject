import React, { useEffect, useMemo, useState } from 'react';
import { getDeclarationText, getSupportingText } from '../lib/samplePdfs';
import { parseCaseFields } from '../lib/fieldParsing';
import { CHECKED_FIELDS, detectDiscrepancies, type FieldDiscrepancy } from '../lib/discrepancyDetection';
import type { FieldKey } from '../lib/fieldParsing';
import '../styles/theme.css';
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

function StatusPill({ status }: { status: FieldDiscrepancy['status'] }) {
  const style =
    status === 'Match'
      ? { border: '1px solid rgba(122,170,138,0.55)', background: 'rgba(207,233,212,0.9)', color: '#0f2f52' }
      : status === 'Mismatch'
        ? { border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(253,230,138,0.95)', color: '#92400e' }
        : { border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(254,226,226,0.95)', color: '#991b1b' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, fontWeight: 900, fontSize: 13, ...style }}>
      {status}
    </span>
  );
}

export default function Req6DiscrepancyDetection() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FieldDiscrepancy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caseLoadedAt, setCaseLoadedAt] = useState(0);

  const fieldsInOrder = useMemo(() => CHECKED_FIELDS, []);

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
      setResults(discrepancies);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Failed to load demo case');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const caseModel = loadCaseStore();
      // If user already parsed/uploaded on Req3/4/5, show immediately.
      if (caseModel.discrepancies && caseModel.discrepancies.length > 0) {
        setResults(caseModel.discrepancies);
        setCaseLoadedAt(caseModel.updatedAt);
      } else {
        setResults(null);
      }
    } catch {
      setResults(null);
    }
  }, []);

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
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Requirement 6: Cross-document discrepancy detection</h2>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 700 }}>
          The demo classifies 5 checked fields as `Match`, `Mismatch`, or `Not Found` and renders them in the UI.
        </p>
        {results && caseLoadedAt ? (
          <div style={{ marginTop: 10, color: '#334155', fontWeight: 900, fontSize: 13 }}>
            Showing results from your latest parsed case.
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

      {results ? (
        <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 13, color: '#334155', borderBottom: '1px solid #cfd7e3', paddingBottom: 10 }}>
                  Field
                </th>
                <th style={{ textAlign: 'left', fontSize: 13, color: '#334155', borderBottom: '1px solid #cfd7e3', paddingBottom: 10 }}>
                  Declaration value
                </th>
                <th style={{ textAlign: 'left', fontSize: 13, color: '#334155', borderBottom: '1px solid #cfd7e3', paddingBottom: 10 }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {fieldsInOrder.map((k) => {
                const row = results.find((r) => r.fieldKey === k)!;
                return (
                  <tr key={k}>
                    <td style={{ padding: '12px 0', color: '#0f172a', fontWeight: 900 }}>{labelForField(k)}</td>
                    <td style={{ padding: '12px 0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', color: '#334155', fontWeight: 800 }}>
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

          <div style={{ marginTop: 12, color: '#334155', fontWeight: 800, fontSize: 13 }}>
            Evidence for each classification is shown in Requirement #8.
          </div>
        </div>
      ) : null}
    </div>
  );
}


