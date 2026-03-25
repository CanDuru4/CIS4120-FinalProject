import React, { useMemo, useState } from 'react';
import type { CaseStore } from '../state/caseStore';
import { loadCaseStore, resetCaseStore, updateCaseStore, upsertStoredFile } from '../state/caseStore';
import type { StoredFile } from '../state/caseStore';

import { getDeclarationText, getSupportingText } from '../lib/samplePdfs';
import { useNeoUi } from '../neo/NeoUiContext';
import '../styles/theme.css';

type Props = {
  caseModel: CaseStore;
  uploadMode: 'separate' | 'combined';
  sessionCombinedFile: File | null;
  sessionDeclarationFile: File | null;
  sessionSupportingFiles: File[];
  onSetSessionFiles: (mode: 'separate' | 'combined', combined: File | null, decl: File | null, supporting: File[]) => void;
  onLoadDemo: () => void;
  onUpdateCase: () => void;
  /** Neo case-flow only: customs mockup layout (cloud hero, tighter copy). */
  photoLayout?: boolean;
  /** When false, hides the “Case contents” panel (parent may render elsewhere). */
  showCaseContents?: boolean;
  /** When false, hides the “Load demo case” button inside the upload panel. */
  showLoadDemoButton?: boolean;
  /**
   * When true (neo + photoLayout), shows a simplified “File Upload” hero
   * when the case has no stored files yet.
   */
  neoCompactUploadHero?: boolean;
};

function roleBadge(role: StoredFile['role']) {
  const style =
    role === 'declaration'
      ? { border: '1px solid #163a63', background: '#e7f0ff', color: '#0f2f52' }
      : { border: '1px solid #d1dbe8', background: '#eef2f7', color: '#0f172a' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, fontWeight: 950, fontSize: 13, ...style }}>
      {role}
    </span>
  );
}

export function CaseStepUpload(props: Props) {
  const {
    caseModel,
    uploadMode,
    sessionCombinedFile,
    sessionDeclarationFile,
    sessionSupportingFiles,
    onSetSessionFiles,
    onLoadDemo,
    onUpdateCase,
    photoLayout = false,
    showCaseContents = true,
    showLoadDemoButton = true,
    neoCompactUploadHero = false,
  } = props;
  const neo = useNeoUi();
  const photo = Boolean(neo && photoLayout);
  const showCompactHero = Boolean(photo && neoCompactUploadHero && caseModel.files.length === 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filesSorted = useMemo(() => {
    return [...caseModel.files].sort((a, b) => (a.role === b.role ? a.fileName.localeCompare(b.fileName) : a.role === 'declaration' ? -1 : 1));
  }, [caseModel.files]);

  function onPickDeclaration(files: FileList | null) {
    onSetSessionFiles(uploadMode, sessionCombinedFile, files?.[0] ?? null, sessionSupportingFiles);
  }

  function onPickSupporting(files: FileList | null) {
    if (!files) return;
    onSetSessionFiles(uploadMode, sessionCombinedFile, sessionDeclarationFile, Array.from(files));
  }

  function onPickCombined(files: FileList | null) {
    onSetSessionFiles('combined', files?.[0] ?? null, null, []);
  }

  function onPickMultipleAsSeparate(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    onSetSessionFiles('separate', null, arr[0] ?? null, arr.slice(1));
  }

  async function storeFiles() {
    setLoading(true);
    setError(null);
    try {
      resetCaseStore();
      if (uploadMode === 'combined') {
        if (!sessionCombinedFile) throw new Error('Please upload a combined PDF.');
        const baseName = sessionCombinedFile.name;
        const mt = sessionCombinedFile.type || 'application/pdf';
        // Store pseudo-separated entries so the rest of the workflow can proceed.
        upsertStoredFile('declaration', `${baseName}::declaration`, mt);
        upsertStoredFile('supporting', `${baseName}::supporting_1`, mt);
        upsertStoredFile('supporting', `${baseName}::supporting_2`, mt);
        upsertStoredFile('supporting', `${baseName}::supporting_3`, mt);
      } else {
        if (!sessionDeclarationFile) throw new Error('Please upload a declaration PDF.');
        if (sessionSupportingFiles.length < 2) throw new Error(`Please upload at least 2 supporting PDFs. Currently have ${sessionSupportingFiles.length}.`);
        upsertStoredFile('declaration', sessionDeclarationFile.name, sessionDeclarationFile.type || 'application/pdf');
        for (const f of sessionSupportingFiles) upsertStoredFile('supporting', f.name, f.type || 'application/pdf');
      }
      updateCaseStore((prev) => ({
        ...prev,
        caseId: `CUS-${Date.now()}`,
        workflowState: 'Draft',
        submission: { submitted: false, submittedAt: null, overrideExplanation: null, issuesAtSubmit: null },
      }));
      onUpdateCase();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Failed to store files');
    } finally {
      setLoading(false);
    }
  }

  async function storeFilesFromSeparateInputs(decl: File | null, supporting: File[]) {
    setLoading(true);
    setError(null);
    try {
      resetCaseStore();
      if (!decl) throw new Error('Please upload a declaration PDF.');
      if (supporting.length < 2) throw new Error(`Please upload at least 2 supporting PDFs. Currently have ${supporting.length}.`);

      upsertStoredFile('declaration', decl.name, decl.type || 'application/pdf');
      for (const f of supporting) upsertStoredFile('supporting', f.name, f.type || 'application/pdf');

      updateCaseStore((prev) => ({
        ...prev,
        caseId: `CUS-${Date.now()}`,
        workflowState: 'Draft',
        submission: { submitted: false, submittedAt: null, overrideExplanation: null, issuesAtSubmit: null },
      }));

      onUpdateCase();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Failed to store files');
    } finally {
      setLoading(false);
    }
  }

  async function storeFilesFromCombinedInput(combined: File) {
    setLoading(true);
    setError(null);
    try {
      resetCaseStore();

      const baseName = combined.name;
      const mt = combined.type || 'application/pdf';
      // Store pseudo-separated entries so the rest of the workflow can proceed.
      upsertStoredFile('declaration', `${baseName}::declaration`, mt);
      upsertStoredFile('supporting', `${baseName}::supporting_1`, mt);
      upsertStoredFile('supporting', `${baseName}::supporting_2`, mt);
      upsertStoredFile('supporting', `${baseName}::supporting_3`, mt);

      updateCaseStore((prev) => ({
        ...prev,
        caseId: `CUS-${Date.now()}`,
        workflowState: 'Draft',
        submission: { submitted: false, submittedAt: null, overrideExplanation: null, issuesAtSubmit: null },
      }));

      onUpdateCase();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Failed to store files');
    } finally {
      setLoading(false);
    }
  }

  // Not used by parsing for sample PDFs, but it helps you sanity-check that the prototype data exists.
  const quickSampleHint = useMemo(() => {
    return {
      declCompany: getDeclarationText().match(/Company Name:\s*(.*)/)?.[1] ?? '',
    };
  }, []);

  return (
    <div className={neo ? `neo-surface${photo ? ' neo-photo-upload' : ''}` : undefined} style={{ display: 'grid', gap: 14 }}>
      <div
        className={neo ? 'neo-panel' : undefined}
        style={
          neo
            ? { padding: photo ? 18 : 16 }
            : { background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }
        }
      >
        {showCompactHero ? (
          <>
            <div style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#163a63', fontWeight: 950 }}>
              File Upload
            </div>
            <div className="neo-photo-upload__cloud" aria-hidden>
              <span className="neo-photo-upload__cloud-icon">☁</span>
              <p className="neo-photo-upload__cloud-text">Drag and drop files here or click below.</p>
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, color: '#0f172a', fontSize: 12 }}>
                <input
                  type="radio"
                  name="neo-compact-upload-mode"
                  checked={uploadMode === 'separate'}
                  onChange={() => onSetSessionFiles('separate', null, sessionDeclarationFile, sessionSupportingFiles)}
                />
                Multiple PDFs
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, color: '#0f172a', fontSize: 12 }}>
                <input
                  type="radio"
                  name="neo-compact-upload-mode"
                  checked={uploadMode === 'combined'}
                  onChange={() => onSetSessionFiles('combined', sessionCombinedFile, null, [])}
                />
                One combined PDF
              </label>
            </div>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 18px',
                borderRadius: 12,
                background: '#1d4ed8',
                color: '#fff',
                fontWeight: 950,
                cursor: 'pointer',
                boxShadow: '0 10px 26px rgba(37, 99, 235, 0.25)',
              }}
            >
              <input
                type="file"
                accept="application/pdf"
                multiple={uploadMode === 'separate'}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  if (uploadMode === 'combined') {
                    const f = files[0];
                    onSetSessionFiles('combined', f, null, []);
                    storeFilesFromCombinedInput(f);
                  } else {
                    onPickMultipleAsSeparate(files);
                    const arr = Array.from(files);
                    storeFilesFromSeparateInputs(arr[0] ?? null, arr.slice(1));
                  }
                }}
              />
              Upload Files
            </label>
          </>
        ) : photo ? (
          <>
            <div className="neo-photo-upload__eyebrow">Documents · upload &amp; store</div>
            <div className="neo-photo-upload__cloud" aria-hidden>
              <span className="neo-photo-upload__cloud-icon">☁</span>
              <p className="neo-photo-upload__cloud-text">Drag and drop to upload files, or use the pickers below.</p>
            </div>
            <p className="neo-photo-upload__hint">
              <strong>Separate:</strong> one declaration + at least two supporting PDFs. <strong>Combined:</strong> one PDF with declaration first and at least two supporting
              sections.
            </p>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#163a63', fontWeight: 950 }}>
              CIS 4120 HW5 — Requirements 3 &amp; 4
            </div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>Upload &amp; store files</h2>
            <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 800, fontSize: 13 }}>
              <strong>Req 3:</strong> one declaration + at least two supporting PDFs; preserve each file’s name, MIME type, and role in the case.{' '}
              <strong>Req 4:</strong> one combined PDF with declaration first and at least two supporting sections (separated for the rest of the flow).
            </p>
          </>
        )}

        {!showCompactHero ? (
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 950, color: '#0f172a' }}>
            <input
              type="radio"
              name="uploadMode"
              checked={uploadMode === 'separate'}
              onChange={() => onSetSessionFiles('separate', null, sessionDeclarationFile, sessionSupportingFiles)}
            />
            Separate PDFs
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 950, color: '#0f172a' }}>
            <input
              type="radio"
              name="uploadMode"
              checked={uploadMode === 'combined'}
              onChange={() => onSetSessionFiles('combined', sessionCombinedFile, null, [])}
            />
            One combined PDF
          </label>
          </div>
        ) : null}

        {!showCompactHero ? (
          <div
          className={neo ? 'neo-dropzone' : undefined}
          style={{
            marginTop: photo ? 12 : 14,
            display: 'grid',
            gridTemplateColumns: photo ? '1fr' : '1fr 1fr',
            gap: 14,
          }}
          >
          {uploadMode === 'combined' ? (
            <label style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 14, background: '#f8fafc' }}>
              <div style={{ fontWeight: 950, color: '#0f172a', marginBottom: 8 }}>Combined PDF</div>
              <input type="file" accept="application/pdf" onChange={(e) => onPickCombined(e.target.files)} />
              {sessionCombinedFile ? (
                <div style={{ marginTop: 8, color: '#334155', fontWeight: 900, fontSize: 13 }}>{sessionCombinedFile.name}</div>
              ) : null}
            </label>
          ) : (
            <label style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 14, background: '#f8fafc' }}>
              <div style={{ fontWeight: 950, color: '#0f172a', marginBottom: 8 }}>Declaration PDF</div>
              <input type="file" accept="application/pdf" onChange={(e) => onPickDeclaration(e.target.files)} />
              {sessionDeclarationFile ? (
                <div style={{ marginTop: 8, color: '#334155', fontWeight: 900, fontSize: 13 }}>{sessionDeclarationFile.name}</div>
              ) : null}
            </label>
          )}

          {uploadMode === 'combined' ? (
            <div style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 14, background: '#f8fafc' }}>
              <div style={{ fontWeight: 950, color: '#0f172a', marginBottom: 8 }}>Supporting PDFs</div>
              <div style={{ color: '#334155', fontWeight: 900, fontSize: 13 }}>
                In combined mode, supporting documents are derived from the combined PDF after separation.
              </div>
            </div>
          ) : (
            <label style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 14, background: '#f8fafc' }}>
              <div style={{ fontWeight: 950, color: '#0f172a', marginBottom: 8 }}>Supporting PDFs</div>
              <input type="file" accept="application/pdf" multiple onChange={(e) => onPickSupporting(e.target.files)} />
              <div style={{ marginTop: 8, color: '#334155', fontWeight: 900, fontSize: 13 }}>
                Selected: {sessionSupportingFiles.length}
              </div>
            </label>
          )}
          </div>
        ) : null}

        {!showCompactHero ? (
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={storeFiles}
            disabled={loading}
            style={{
              border: 'none',
              padding: '10px 14px',
              borderRadius: 12,
              background: '#163a63',
              color: '#fff',
              fontWeight: 950,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Storing...' : 'Store files in case'}
          </button>

          {showLoadDemoButton ? (
            <button
              onClick={onLoadDemo}
              disabled={loading}
              style={{
                border: '1px solid #d1dbe8',
                padding: '10px 14px',
                borderRadius: 12,
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 950,
                cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              Load demo case
            </button>
          ) : null}
          </div>
        ) : null}

        {error ? <div style={{ marginTop: 10, color: '#991b1b', fontWeight: 950 }}>{error}</div> : null}
        {!showCompactHero ? (
          !photo ? (
            <div style={{ marginTop: 10, color: '#334155', fontWeight: 850, fontSize: 12 }}>
              Demo company (sanity check): {quickSampleHint.declCompany || '(loading...)'}
            </div>
          ) : (
            <div className="neo-photo-upload__demo-line">Demo company: {quickSampleHint.declCompany || '…'}</div>
          )
        ) : null}
      </div>

      {showCaseContents ? (
        <div
          className={neo ? 'neo-panel' : undefined}
          style={
            neo
              ? { padding: 16 }
              : { background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }
          }
        >
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: photo ? 15 : 14 }}>Case contents (stored metadata)</h3>
          {filesSorted.length === 0 ? (
            <div style={{ marginTop: 10, color: '#334155', fontWeight: 900 }}>No files stored yet.</div>
          ) : (
            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {filesSorted.map((f) => (
                <div key={f.id} style={{ display: 'flex', gap: 12, alignItems: 'center', border: '1px solid #d1dbe8', borderRadius: 16, padding: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 950, color: '#0f172a' }}>{f.fileName}</div>
                    <div style={{ marginTop: 4, fontWeight: 900, color: '#334155', fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                      {f.mimeType}
                    </div>
                  </div>
                  {roleBadge(f.role)}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

