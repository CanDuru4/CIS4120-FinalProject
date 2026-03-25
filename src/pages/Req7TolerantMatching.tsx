import React from 'react';
import '../styles/theme.css';
import { compareValues } from '../lib/tolerantMatching';
import type { FieldKey } from '../lib/fieldParsing';

function ResultBadge({ fieldKey, a, b }: { fieldKey: FieldKey; a: string; b: string }) {
  const res = compareValues(fieldKey, a, b);
  const isMatch = res.isMatch;
  return (
    <div
      style={{
        border: '1px solid #d1dbe8',
        borderRadius: 16,
        padding: 14,
        background: '#ffffff',
      }}
    >
      <div style={{ fontWeight: 900, color: '#0f172a' }}>{fieldKey}</div>
      <div style={{ marginTop: 10, fontSize: 13, color: '#334155', fontWeight: 800 }}>
        Declaration: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{a}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: '#334155', fontWeight: 800 }}>
        Supporting: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{b}</span>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
        <div className="badge">{isMatch ? 'Match' : 'Mismatch'}</div>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#334155' }}>score: {res.score.toFixed(3)}</div>
      </div>
    </div>
  );
}

export default function Req7TolerantMatching({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: hideTitle ? undefined : 1040, margin: hideTitle ? 0 : '0 auto' }}>
      {hideTitle ? null : (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #cfd7e3',
            borderRadius: 18,
            padding: 16,
          }}
        >
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Requirement 7: Tolerant textual matching</h2>
          <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 700 }}>
            Minor wording/punctuation/spacing differences should still classify as `Match`, while genuinely different values should classify as `Mismatch`.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <ResultBadge fieldKey="companyName" a="Example Goods LLC" b="Example Goods, LLC" />
        <ResultBadge fieldKey="itemDescription" a="Widget A (50 kg bags)" b="Widget A - 50kg bags" />
        <ResultBadge fieldKey="invoiceNumber" a="INV-1002" b="INV-9999" />
      </div>
    </div>
  );
}

