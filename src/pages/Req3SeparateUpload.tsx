import React, { useEffect, useState } from 'react';
import '../styles/theme.css';
import {
  loadCaseStore,
  resetCaseStore,
  upsertStoredFile,
  updateCaseStore,
  setParsedAndDiscrepancies,
} from '../state/caseStore';
import { appendDraftQueueRow } from '../state/dashboardQueueStore';
import { extractTextFromFile } from '../lib/pdfTextExtraction';
import type { StoredFile } from '../state/caseStore';
import { parseCaseFields } from '../lib/fieldParsing';
import { detectDiscrepancies } from '../lib/discrepancyDetection';
import type { SupportingSection } from '../lib/separateCombined';
import { getDeclarationText, getSupportingText } from '../lib/samplePdfs';

function prettyMime(mimeType: string) {
  if (mimeType && mimeType !== '') return mimeType;
  return 'application/pdf';
}

function roleBadge(role: StoredFile['role']) {
  const style =
    role === 'declaration'
      ? { border: '1px solid #163a63', background: '#e7f0ff', color: '#0f2f52' }
      : { border: '1px solid #d1dbe8', background: '#eef2f7', color: '#0f172a' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, fontWeight: 900, fontSize: 13, ...style }}>
      {role}
    </span>
  );
}

export default function Req3SeparateUpload() {
  const [caseModel, setCaseModel] = useState(loadCaseStore());
  const [declarationFile, setDeclarationFile] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCaseModel(loadCaseStore());
  }, []);

  function refresh() {
    setCaseModel(loadCaseStore());
  }

  function onPickDeclaration(files: FileList | null) {
    const f = files?.[0] ?? null;
    setDeclarationFile(f);
  }

  function onPickSupporting(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    setSupportingFiles(list);
  }

  function storeSelectedFilesToCase() {
    resetCaseStore();
    if (declarationFile) upsertStoredFile('declaration', declarationFile.name, prettyMime(declarationFile.type));
    for (const f of supportingFiles) upsertStoredFile('supporting', f.name, prettyMime(f.type));
    updateCaseStore((prev) => ({
      ...prev,
      caseId: `CUS-${Date.now()}`,
      workflowState: 'Draft',
      submission: { submitted: false, submittedAt: null, overrideExplanation: null, issuesAtSubmit: null },
    }));
    refresh();
  }

  async function analyzeAndStoreParsed() {
    setLoading(true);
    setError(null);
    try {
      if (!declarationFile) throw new Error('Please upload a declaration PDF.');
      if (supportingFiles.length < 3) throw new Error('Please upload at least three supporting PDFs.');

      const declText = await extractTextFromFile(declarationFile);
      const supportingSections: SupportingSection[] = await Promise.all(
        supportingFiles.slice(0, 3).map(async (f, idx) => ({
          id: idx + 1,
          text: await extractTextFromFile(f),
        })),
      );

      const parsed = parseCaseFields(declText, supportingSections);
      const discrepancies = detectDiscrepancies(parsed);

      setParsedAndDiscrepancies({
        declarationFields: parsed.declarationFields,
        supportingDocuments: parsed.supportingDocuments,
        discrepancies,
      });
      updateCaseStore((prev) => ({
        ...prev,
        workflowState: prev.workflowState ?? 'Draft',
      }));
      appendDraftQueueRow(loadCaseStore());

      refresh();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Failed to extract + parse');
    } finally {
      setLoading(false);
    }
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

      // Use known deterministic text for our generated sample PDFs (avoids PDF.js worker issues).
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

  const filesSorted = [...caseModel.files].sort((a, b) => (a.role === b.role ? a.fileName.localeCompare(b.fileName) : a.role === 'declaration' ? -1 : 1));

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Requirement 3: Separate-document upload</h2>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 700 }}>
          Upload one declaration PDF and at least three supporting PDFs. The UI stores each file’s name, MIME type, and role in a case model.
        </p>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 14, background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Declaration PDF</div>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => onPickDeclaration(e.target.files)}
            />
            {declarationFile ? <div style={{ marginTop: 8, color: '#334155', fontWeight: 800, fontSize: 13 }}>{declarationFile.name}</div> : null}
          </label>

          <label style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 14, background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Supporting PDFs (pick 3+)</div>
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => onPickSupporting(e.target.files)}
            />
            <div style={{ marginTop: 8, color: '#334155', fontWeight: 800, fontSize: 13 }}>
              Selected: {supportingFiles.length}
            </div>
          </label>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={storeSelectedFilesToCase}
            style={{
              border: '1px solid #d1dbe8',
              padding: '10px 14px',
              borderRadius: 12,
              background: '#ffffff',
              color: '#0f172a',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Store files in case
          </button>
          <button
            onClick={analyzeAndStoreParsed}
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
            {loading ? 'Extracting + parsing...' : 'Extract + parse fields'}
          </button>
          <button
            onClick={loadDemoCase}
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
            Load demo case
          </button>
        </div>

        {error ? <div style={{ marginTop: 12, color: '#991b1b', fontWeight: 900 }}>{error}</div> : null}
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Case contents (file name/type/role)</h3>
        {filesSorted.length === 0 ? (
          <div style={{ marginTop: 10, color: '#334155', fontWeight: 800 }}>No files stored yet.</div>
        ) : (
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {filesSorted.map((f) => (
              <div key={f.id} style={{ display: 'flex', gap: 12, alignItems: 'center', border: '1px solid #d1dbe8', borderRadius: 16, padding: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, color: '#0f172a' }}>{f.fileName}</div>
                  <div style={{ marginTop: 4, fontWeight: 800, color: '#334155', fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                    {f.mimeType}
                  </div>
                </div>
                {roleBadge(f.role)}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, color: '#334155', fontWeight: 800, fontSize: 13 }}>
          Requirement evidence: the table above preserves each uploaded file’s name, type, and role.
        </div>
      </div>

      {caseModel.parsed ? (
        <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Parsed field preview</h3>
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            {(
              [
                ['companyName', 'Company Name'],
                ['grossWeightKg', 'Gross Weight'],
                ['invoiceNumber', 'Invoice Number'],
                ['itemDescription', 'Item Description'],
                ['quantity', 'Quantity'],
              ] as Array<[keyof typeof caseModel.parsed.declarationFields, string]>
            ).map(([key, label]) => {
              const field = caseModel.parsed?.declarationFields[key];
              return (
                <div key={String(key)} style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#ffffff' }}>
                  <div style={{ fontWeight: 900, color: '#0f172a' }}>{label}</div>
                  {field ? (
                    <>
                      <div style={{ marginTop: 8, fontWeight: 900, color: '#334155', fontSize: 13 }}>
                        Value:{' '}
                        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{field.value}</span>
                      </div>
                      <div style={{ marginTop: 10, color: '#334155', fontWeight: 800, fontSize: 13 }}>Evidence snippet</div>
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
                        {field.evidenceText}
                      </pre>
                    </>
                  ) : (
                    <div style={{ marginTop: 10, color: '#991b1b', fontWeight: 900, fontSize: 13 }}>Not found in parsed text</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}


