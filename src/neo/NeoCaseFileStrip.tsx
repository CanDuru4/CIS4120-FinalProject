import React, { useEffect, useMemo, useState } from 'react';
import type { CaseStore } from '../state/caseStore';

type Props = {
  caseModel: CaseStore;
  /** When set with onSelectedFileIdChange, selection is controlled (e.g. sync with PDF preview). */
  selectedFileId?: string | null;
  onSelectedFileIdChange?: (id: string) => void;
};

export function NeoCaseFileStrip({ caseModel, selectedFileId, onSelectedFileIdChange }: Props) {
  const [internalId, setInternalId] = useState<string | null>(null);
  const controlled = selectedFileId !== undefined && onSelectedFileIdChange !== undefined;

  const sorted = useMemo(() => {
    return [...caseModel.files].sort((a, b) =>
      a.role === b.role ? a.fileName.localeCompare(b.fileName) : a.role === 'declaration' ? -1 : 1,
    );
  }, [caseModel.files]);

  useEffect(() => {
    if (!controlled) setInternalId(null);
  }, [controlled, caseModel.caseId, caseModel.files.length]);

  const supportingMeta = caseModel.parsed?.supportingDocuments ?? [];

  if (sorted.length === 0) return null;

  const effectiveActive = controlled
    ? selectedFileId && sorted.some((f) => f.id === selectedFileId)
      ? selectedFileId
      : sorted[0].id
    : internalId && sorted.some((f) => f.id === internalId)
      ? internalId
      : sorted[0].id;

  function selectFile(id: string) {
    if (controlled) onSelectedFileIdChange!(id);
    else setInternalId(id);
  }

  const selected = sorted.find((f) => f.id === effectiveActive) ?? sorted[0];
  const suppIndex = selected.role === 'supporting' ? sorted.filter((f) => f.role === 'supporting').indexOf(selected) : -1;
  const sectionLabel =
    selected.role === 'declaration'
      ? 'Declaration (beyanname)'
      : suppIndex >= 0 && supportingMeta[suppIndex]
        ? supportingMeta[suppIndex].label
        : suppIndex >= 0
          ? `Supporting file ${suppIndex + 1}`
          : 'Supporting';

  return (
    <div className="neo-case-file-strip">
      <div className="neo-case-file-strip__label">Case files</div>
      <div className="neo-case-file-strip__tabs" role="tablist" aria-label="Switch between uploaded files">
        {sorted.map((f) => {
          const isSel = f.id === effectiveActive;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={isSel}
              className={`neo-case-file-tab ${isSel ? 'neo-case-file-tab--active' : ''}`}
              onClick={() => selectFile(f.id)}
            >
              <span className={`neo-case-file-tab__role neo-case-file-tab__role--${f.role}`}>{f.role}</span>
              <span className="neo-case-file-tab__name">{f.fileName}</span>
            </button>
          );
        })}
      </div>
      <div className="neo-case-file-strip__detail" role="tabpanel">
        <div className="neo-case-file-strip__meta">
          <span className="neo-case-file-strip__mime">{selected.mimeType}</span>
          <span className="neo-case-file-strip__section">{sectionLabel}</span>
        </div>
        <p className="neo-case-file-strip__hint">Prototype: metadata only — use Parse and Evidence steps for extracted values.</p>
      </div>
    </div>
  );
}
