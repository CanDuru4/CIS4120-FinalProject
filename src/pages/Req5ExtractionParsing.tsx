import React, { useEffect, useState } from 'react';
import '../styles/theme.css';
import {
  loadCaseStore,
  resetCaseStore,
  setParsedAndDiscrepancies,
  upsertStoredFile,
} from '../state/caseStore';
import { appendDraftQueueRow } from '../state/dashboardQueueStore';
import { getDeclarationText, getSupportingText } from '../lib/samplePdfs';
import { parseCaseFields, type ParsedFields } from '../lib/fieldParsing';
import { detectDiscrepancies } from '../lib/discrepancyDetection';
import type { SupportingSection } from '../lib/separateCombined';
import type { FieldKey } from '../lib/fieldParsing';

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

function FieldRow({ fieldKey, fields }: { fieldKey: FieldKey; fields: ParsedFields }) {
  const v = fields[fieldKey];
  return (
    <div style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 900, color: '#0f172a' }}>{labelForField(fieldKey)}</div>
      {v ? (
        <>
          <div style={{ marginTop: 8, fontWeight: 900, color: '#334155', fontSize: 13 }}>
            Extracted value: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{v.value}</span>
          </div>
          <div style={{ marginTop: 8, color: '#334155', fontWeight: 800, fontSize: 13 }}>
            Evidence snippet:
          </div>
          <pre
            style={{
              marginTop: 6,
              padding: 10,
              borderRadius: 14,
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              overflow: 'auto',
              fontSize: 12,
              color: '#0f172a',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
          >
            {v.evidenceText}
          </pre>
        </>
      ) : (
        <div style={{ marginTop: 10, color: '#991b1b', fontWeight: 900, fontSize: 13 }}>Not found in parsed text</div>
      )}
    </div>
  );
}

export default function Req5ExtractionParsing() {
  const [caseModel, setCaseModel] = useState(loadCaseStore());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCaseModel(loadCaseStore());
  }, []);

  function refresh() {
    setCaseModel(loadCaseStore());
  }

  async function loadDemoCase() {
    setLoading(true);
    setError(null);
    try {
      resetCaseStore();
      upsertStoredFile('declaration', 'declaration_demo.pdf', 'application/pdf');
      upsertStoredFile('supporting', 'supporting_1_demo.pdf', 'application/pdf');
      upsertStoredFile('supporting', 'supporting_2_demo.pdf', 'application/pdf');
      upsertStoredFile('supporting', 'supporting_3_demo.pdf', 'application/pdf');

      const declText = getDeclarationText();
      const ids = [1, 2, 3] as const;
      const supportingSections: SupportingSection[] = ids.map((id) => ({
        id,
        text: getSupportingText(id),
      }));

      const parsed = parseCaseFields(declText, supportingSections);
      const discrepancies = detectDiscrepancies(parsed);

      setParsedAndDiscrepancies({
        declarationFields: parsed.declarationFields,
        supportingDocuments: parsed.supportingDocuments,
        discrepancies,
      });
      appendDraftQueueRow(loadCaseStore());

      refresh();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Failed to load demo case');
    } finally {
      setLoading(false);
    }
  }

  const parsed = caseModel.parsed;

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Requirement 5: PDF text extraction + field parsing</h2>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 700 }}>
          Shows structured extraction for company name, gross weight, invoice number, item description, and quantity, with evidence snippets.
        </p>
        <div style={{ marginTop: 12 }}>
          <button
            onClick={loadDemoCase}
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
            {loading ? 'Extracting + parsing...' : 'Load demo case'}
          </button>
        </div>
        {error ? <div style={{ marginTop: 12, color: '#991b1b', fontWeight: 900 }}>{error}</div> : null}
      </div>

      {parsed ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Declaration field extraction</h3>
            <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
              <FieldRow fieldKey="companyName" fields={parsed.declarationFields} />
              <FieldRow fieldKey="grossWeightKg" fields={parsed.declarationFields} />
              <FieldRow fieldKey="invoiceNumber" fields={parsed.declarationFields} />
              <FieldRow fieldKey="itemDescription" fields={parsed.declarationFields} />
              <FieldRow fieldKey="quantity" fields={parsed.declarationFields} />
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Supporting-document parsed fields</h3>
            <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
              {parsed.supportingDocuments.map((doc) => (
                <div key={doc.sectionId} style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#f8fafc' }}>
                  <div style={{ fontWeight: 900, color: '#0f172a' }}>{doc.label}</div>
                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    <FieldRow fieldKey="companyName" fields={doc.parsedFields} />
                    <FieldRow fieldKey="grossWeightKg" fields={doc.parsedFields} />
                    <FieldRow fieldKey="invoiceNumber" fields={doc.parsedFields} />
                    <FieldRow fieldKey="itemDescription" fields={doc.parsedFields} />
                    <FieldRow fieldKey="quantity" fields={doc.parsedFields} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
          No parsed data found yet. Click “Load demo case” or run Requirement #3/#4 to populate the shared case model.
        </div>
      )}
    </div>
  );
}


