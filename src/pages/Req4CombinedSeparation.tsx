import React, { useEffect, useState } from 'react';
import '../styles/theme.css';
import {
  loadCaseStore,
  resetCaseStore,
  upsertStoredFile,
  setParsedAndDiscrepancies,
} from '../state/caseStore';
import { appendDraftQueueRow } from '../state/dashboardQueueStore';
import { extractTextFromFile } from '../lib/pdfTextExtraction';
import { separateCombinedText } from '../lib/separateCombined';
import { parseCaseFields } from '../lib/fieldParsing';
import { detectDiscrepancies } from '../lib/discrepancyDetection';
import { getCombinedText } from '../lib/samplePdfs';
import type { SupportingSection } from '../lib/separateCombined';

function prettyMime(mimeType: string) {
  if (mimeType && mimeType !== '') return mimeType;
  return 'application/pdf';
}

export default function Req4CombinedSeparation() {
  const [caseModel, setCaseModel] = useState(loadCaseStore());
  const [combinedFile, setCombinedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splitPreview, setSplitPreview] = useState<{ declaration: string; supporting: SupportingSection[] } | null>(null);

  useEffect(() => {
    setCaseModel(loadCaseStore());
  }, []);

  function refresh() {
    setCaseModel(loadCaseStore());
  }

  async function analyzeCombined() {
    setLoading(true);
    setError(null);
    try {
      const file = combinedFile;
      if (!file) throw new Error('Please upload a combined PDF.');

      const extractedText = await extractTextFromFile(file);
      const split = separateCombinedText(extractedText);

      resetCaseStore();
      upsertStoredFile('declaration', `${file.name}::declaration`, prettyMime(file.type));
      split.supportingSections.forEach((s) => {
        upsertStoredFile('supporting', `${file.name}::supporting_${s.id}`, prettyMime(file.type));
      });
      refresh();

      const supportingSections: SupportingSection[] = split.supportingSections.map((s) => ({ id: s.id, text: s.text }));
      const parsed = parseCaseFields(split.declarationText, supportingSections);
      const discrepancies = detectDiscrepancies(parsed);

      setParsedAndDiscrepancies({
        declarationFields: parsed.declarationFields,
        supportingDocuments: parsed.supportingDocuments,
        discrepancies,
      });
      appendDraftQueueRow(loadCaseStore());

      setSplitPreview({ declaration: split.declarationText, supporting: supportingSections });
      refresh();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Failed to separate combined PDF');
    } finally {
      setLoading(false);
    }
  }

  async function loadDemoCombined() {
    setLoading(true);
    setError(null);
    try {
      const split = separateCombinedText(getCombinedText());

      resetCaseStore();
      upsertStoredFile('declaration', 'combined_demo.pdf::declaration', 'application/pdf');
      split.supportingSections.forEach((s) => upsertStoredFile('supporting', `combined_demo.pdf::supporting_${s.id}`, 'application/pdf'));
      refresh();

      const supportingSections: SupportingSection[] = split.supportingSections.map((s) => ({ id: s.id, text: s.text }));
      const parsed = parseCaseFields(split.declarationText, supportingSections);
      const discrepancies = detectDiscrepancies(parsed);

      setParsedAndDiscrepancies({
        declarationFields: parsed.declarationFields,
        supportingDocuments: parsed.supportingDocuments,
        discrepancies,
      });
      appendDraftQueueRow(loadCaseStore());

      setSplitPreview({ declaration: split.declarationText, supporting: supportingSections });
      refresh();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Failed to load demo combined case');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Requirement 4: Combined-PDF intake + separation</h2>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 700 }}>
          Upload a single combined PDF containing a declaration section followed by supporting sections. The prototype separates them using explicit markers and stores parsed fields for later review flow.
        </p>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'end' }}>
          <label style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 14, background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Combined PDF</div>
            <input type="file" accept="application/pdf" onChange={(e) => setCombinedFile(e.target.files?.[0] ?? null)} />
            {combinedFile ? <div style={{ marginTop: 8, color: '#334155', fontWeight: 800, fontSize: 13 }}>{combinedFile.name}</div> : null}
          </label>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            <button
              onClick={analyzeCombined}
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
              {loading ? 'Separating...' : 'Extract + separate'}
            </button>
            <button
              onClick={loadDemoCombined}
              disabled={loading}
              style={{
                border: '1px solid #d1dbe8',
                padding: '10px 14px',
                borderRadius: 12,
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 900,
                cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              Load demo combined
            </button>
          </div>
        </div>

        {error ? <div style={{ marginTop: 12, color: '#991b1b', fontWeight: 900 }}>{error}</div> : null}
      </div>

      {splitPreview ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
          <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Separated declaration section</h3>
            <pre style={{ marginTop: 10, padding: 12, borderRadius: 14, background: '#f8fafc', border: '1px solid #e5e7eb', overflow: 'auto', fontSize: 12, color: '#0f172a' }}>
              {splitPreview.declaration}
            </pre>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Separated supporting sections</h3>
            <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
              {splitPreview.supporting.map((s) => (
                <div key={s.id} style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12 }}>
                  <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Supporting section {s.id}</div>
                  <pre style={{ margin: 0, padding: 12, borderRadius: 14, background: '#f8fafc', border: '1px solid #e5e7eb', overflow: 'auto', fontSize: 12, color: '#0f172a' }}>
                    {s.text}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {caseModel.parsed ? (
        <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Parsed field preview (stored in case)</h3>
          <pre style={{ marginTop: 10, padding: 12, borderRadius: 14, background: '#f8fafc', border: '1px solid #e5e7eb', overflow: 'auto', fontSize: 12, color: '#0f172a' }}>
            {JSON.stringify(caseModel.parsed.declarationFields, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}


