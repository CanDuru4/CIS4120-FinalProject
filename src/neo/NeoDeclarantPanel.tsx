import React from 'react';
import type { CaseStore } from '../state/caseStore';

type Row = { label: string; value: string };

function rowsFromCase(caseModel: CaseStore): Row[] {
  const p = caseModel.parsed?.declarationFields;
  const val = (s: string | undefined) => (s && s.trim() ? s : '—');
  const otherBits = [p?.companyName?.value, p?.invoiceNumber?.value, p?.quantity?.value].filter(Boolean).join(' · ');
  return [
    { label: 'HS Code', value: '—' },
    { label: 'Origin Country', value: '—' },
    { label: 'Destination Country', value: '—' },
    { label: 'Invoice Amount', value: '—' },
    { label: 'Net Weight', value: '—' },
    { label: 'Gross Weight', value: val(p?.grossWeightKg?.value) },
    { label: 'Exit Customs', value: '—' },
    { label: 'IBAN', value: '—' },
    { label: 'Others', value: otherBits ? otherBits : val(p?.itemDescription?.value) },
  ];
}

export function NeoDeclarantPanel({ caseModel }: { caseModel: CaseStore }) {
  const rows = rowsFromCase(caseModel);

  return (
    <section className="neo-customs-panel neo-customs-panel--declarant" aria-labelledby="neo-declarant-heading">
      <h2 id="neo-declarant-heading" className="neo-customs-panel-title">
        Declarant
      </h2>
      <div className="neo-customs-rule" />
      <ul className="neo-declarant-list">
        {rows.map((row) => (
          <li key={row.label} className="neo-declarant-row">
            <span className="neo-declarant-label">{row.label}</span>
            <span className="neo-declarant-value">{row.value}</span>
            <button type="button" className="neo-declarant-edit" aria-label={`Edit ${row.label}`} disabled title="Edit (prototype)">
              ✎
            </button>
          </li>
        ))}
      </ul>
      <p className="neo-declarant-footnote">Values fill in after you parse (Req 5 / Parse step). Edit icons match the reference layout.</p>
    </section>
  );
}
