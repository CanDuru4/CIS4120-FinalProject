import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CaseStore, StoredFile } from '../state/caseStore';
import { generateSampleCasePdfs } from '../lib/samplePdfs';
import { CaseStepUpload } from '../caseflow/CaseStepUpload';
import { NeoButton } from './NeoButton';

type Props = {
  caseModel: CaseStore;
  uploadMode: 'separate' | 'combined';
  sessionCombinedFile: File | null;
  sessionDeclarationFile: File | null;
  sessionSupportingFiles: File[];
  onSetSessionFiles: (
    mode: 'separate' | 'combined',
    combined: File | null,
    decl: File | null,
    supporting: File[],
  ) => void;
  onLoadDemo: () => void;
  onUpdateCase: () => void;
  /** Which case file row to preview (sync with Case files strip). */
  previewFileId: string | null;
};

function sortedCaseFiles(files: StoredFile[]) {
  return [...files].sort((a, b) =>
    a.role === b.role ? a.fileName.localeCompare(b.fileName) : a.role === 'declaration' ? -1 : 1,
  );
}

function supportingIndex(stored: StoredFile, sorted: StoredFile[]): number {
  if (stored.role !== 'supporting') return -1;
  return sorted.filter((f) => f.role === 'supporting').findIndex((f) => f.id === stored.id);
}

let demoPdfCache: Awaited<ReturnType<typeof generateSampleCasePdfs>> | null = null;
async function getDemoPdfs() {
  if (!demoPdfCache) demoPdfCache = await generateSampleCasePdfs();
  return demoPdfCache;
}

function allowDemoPdfFallback(caseModel: CaseStore, stored: StoredFile): boolean {
  if (caseModel.caseId.includes('DEMO')) return true;
  const n = stored.fileName.toLowerCase();
  return n.includes('_demo') || n.includes('demo.pdf');
}

async function resolvePdfBlob(
  stored: StoredFile,
  caseModel: CaseStore,
  uploadMode: 'separate' | 'combined',
  sessionCombinedFile: File | null,
  sessionDeclarationFile: File | null,
  sessionSupportingFiles: File[],
  sorted: StoredFile[],
): Promise<Blob | null> {
  if (uploadMode === 'combined' && sessionCombinedFile) {
    return sessionCombinedFile;
  }
  if (stored.role === 'declaration' && sessionDeclarationFile) {
    return sessionDeclarationFile;
  }
  if (stored.role === 'supporting') {
    const idx = supportingIndex(stored, sorted);
    const f = sessionSupportingFiles[idx];
    if (f) return f;
  }

  if (!allowDemoPdfFallback(caseModel, stored)) {
    return null;
  }

  const lower = stored.fileName.toLowerCase();
  const pdfs = await getDemoPdfs();

  if (uploadMode === 'combined' || lower.includes('::declaration') || lower.includes('::supporting')) {
    if (lower.includes('clean')) {
      return new Blob([new Uint8Array(pdfs.combinedClean)], { type: 'application/pdf' });
    }
    return new Blob([new Uint8Array(pdfs.combined)], { type: 'application/pdf' });
  }

  if (stored.role === 'declaration') {
    return new Blob([new Uint8Array(pdfs.declaration)], { type: 'application/pdf' });
  }

  const idx = supportingIndex(stored, sorted);
  const bytes = pdfs.supporting[idx];
  return bytes ? new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }) : null;
}

function NeoPdfPreview({
  caseModel,
  uploadMode,
  sessionCombinedFile,
  sessionDeclarationFile,
  sessionSupportingFiles,
  activeStoredFile,
  onSwitchToUpload,
}: {
  caseModel: CaseStore;
  uploadMode: 'separate' | 'combined';
  sessionCombinedFile: File | null;
  sessionDeclarationFile: File | null;
  sessionSupportingFiles: File[];
  activeStoredFile: StoredFile;
  onSwitchToUpload: () => void;
}) {
  const sorted = useMemo(() => sortedCaseFiles(caseModel.files), [caseModel.files]);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    revoke();
    setUrl(null);
    setErr(null);
    setLoading(true);

    (async () => {
      try {
        const blob = await resolvePdfBlob(
          activeStoredFile,
          caseModel,
          uploadMode,
          sessionCombinedFile,
          sessionDeclarationFile,
          sessionSupportingFiles,
          sorted,
        );
        if (cancelled) return;
        if (!blob) {
          setErr('No PDF bytes in this session for this file. Open Upload documents and store files again, or use Load demo case.');
          setLoading(false);
          return;
        }
        const next = URL.createObjectURL(blob);
        urlRef.current = next;
        setUrl(next);
      } catch {
        if (!cancelled) setErr('Could not build a PDF preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      revoke();
    };
  }, [
    activeStoredFile.id,
    activeStoredFile.fileName,
    activeStoredFile.role,
    caseModel.caseId,
    uploadMode,
    sessionCombinedFile,
    sessionDeclarationFile,
    sessionSupportingFiles,
    sorted,
    revoke,
  ]);

  return (
    <div className="neo-panel neo-doc-pdf">
      <div className="neo-doc-pdf__bar">
        <div className="neo-photo-upload__eyebrow" style={{ marginBottom: 0 }}>
          Documents · preview
        </div>
        <NeoButton variant="secondary" size="sm" type="button" onClick={onSwitchToUpload}>
          Upload documents
        </NeoButton>
      </div>
      <p className="neo-doc-pdf__filename" title={activeStoredFile.fileName}>
        {activeStoredFile.fileName}
      </p>
      {loading ? (
        <div className="neo-doc-pdf__placeholder">Loading PDF…</div>
      ) : err ? (
        <div className="neo-doc-pdf__placeholder neo-doc-pdf__placeholder--err">{err}</div>
      ) : url ? (
        <object className="neo-doc-pdf__frame" data={url} type="application/pdf" title={activeStoredFile.fileName}>
          <div className="neo-doc-pdf__placeholder">
            PDF preview is not available in this browser.{' '}
            <a href={url} download={activeStoredFile.fileName.replace(/::.+$/, '.pdf')}>
              Download PDF
            </a>
          </div>
        </object>
      ) : null}
    </div>
  );
}

/**
 * Port 5175: after files exist, default to embedded PDF preview; toggle back to upload UI.
 */
export function NeoDocumentsPanel({
  caseModel,
  uploadMode,
  sessionCombinedFile,
  sessionDeclarationFile,
  sessionSupportingFiles,
  onSetSessionFiles,
  onLoadDemo,
  onUpdateCase,
  previewFileId,
}: Props) {
  const [uiMode, setUiMode] = useState<'upload' | 'pdf'>(() => (caseModel.files.length > 0 ? 'pdf' : 'upload'));
  const prevFileCount = useRef(caseModel.files.length);

  useEffect(() => {
    if (caseModel.files.length === 0) {
      setUiMode('upload');
    } else if (prevFileCount.current === 0 && caseModel.files.length > 0) {
      setUiMode('pdf');
    }
    prevFileCount.current = caseModel.files.length;
  }, [caseModel.files.length]);

  const sorted = useMemo(() => sortedCaseFiles(caseModel.files), [caseModel.files]);
  const activeStored =
    (previewFileId && sorted.find((f) => f.id === previewFileId)) || sorted[0] || null;

  if (caseModel.files.length === 0) {
    return (
      <CaseStepUpload
        caseModel={caseModel}
        uploadMode={uploadMode}
        sessionCombinedFile={sessionCombinedFile}
        sessionDeclarationFile={sessionDeclarationFile}
        sessionSupportingFiles={sessionSupportingFiles}
        onSetSessionFiles={onSetSessionFiles}
        onLoadDemo={onLoadDemo}
        onUpdateCase={onUpdateCase}
        photoLayout
        showCaseContents={false}
        showLoadDemoButton={false}
        neoCompactUploadHero
      />
    );
  }

  if (uiMode === 'upload') {
    return (
      <div className="neo-doc-panel-stack">
        <div className="neo-doc-pdf__bar neo-doc-pdf__bar--upload">
          <span className="neo-doc-pdf__switch-hint">Replace files or change separate / combined mode</span>
          <NeoButton variant="secondary" size="sm" type="button" onClick={() => setUiMode('pdf')}>
            View PDF
          </NeoButton>
        </div>
        <CaseStepUpload
          caseModel={caseModel}
          uploadMode={uploadMode}
          sessionCombinedFile={sessionCombinedFile}
          sessionDeclarationFile={sessionDeclarationFile}
          sessionSupportingFiles={sessionSupportingFiles}
          onSetSessionFiles={onSetSessionFiles}
          onLoadDemo={onLoadDemo}
          onUpdateCase={onUpdateCase}
          photoLayout
          showCaseContents={false}
          showLoadDemoButton={false}
          neoCompactUploadHero={false}
        />
      </div>
    );
  }

  if (!activeStored) {
    return null;
  }

  return (
    <NeoPdfPreview
      caseModel={caseModel}
      uploadMode={uploadMode}
      sessionCombinedFile={sessionCombinedFile}
      sessionDeclarationFile={sessionDeclarationFile}
      sessionSupportingFiles={sessionSupportingFiles}
      activeStoredFile={activeStored}
      onSwitchToUpload={() => setUiMode('upload')}
    />
  );
}
