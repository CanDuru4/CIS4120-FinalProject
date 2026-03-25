import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNeoUi } from '../neo/NeoUiContext';
import type { CaseStore } from '../state/caseStore';
import { loadCaseStore, setParsedAndDiscrepancies } from '../state/caseStore';
import type { SupportingSection } from '../lib/separateCombined';
import type { FieldKey, ParsedCaseFields, ParsedFields } from '../lib/fieldParsing';
import type { FieldDiscrepancy } from '../lib/discrepancyDetection';
import { CHECKED_FIELDS } from '../lib/discrepancyDetection';
import { detectDiscrepancies } from '../lib/discrepancyDetection';
import { submissionFieldLabel } from '../lib/submissionIssues';

type Props = {
  caseModel: CaseStore;
  uploadMode: 'separate' | 'combined';
  sessionCombinedFile: File | null;
  sessionDeclarationFile: File | null;
  sessionSupportingFiles: File[];
  onParse: (mode: 'separate' | 'combined', combined: File | null, decl: File | null, supporting: File[]) => Promise<{ ok: boolean; message: string }>;
  /** After editing declaration values (neo), parent reloads case from localStorage. */
  onModelChange?: () => void;
  /** Neo single-page workspace: slimmer intro (section title lives on parent). */
  embeddedInWorkspace?: boolean;
  /** Neo split layout: show only the parse controls on the right. */
  showParsePanel?: boolean;
  /** Neo split layout: show only editable fields (and evidence links) on the left. */
  showEditableFields?: boolean;
  /** Neo: show linked supporting-doc evidence under each field. */
  showEvidenceLinks?: boolean;
};

function storedParsedToCaseFields(parsed: NonNullable<CaseStore['parsed']>): ParsedCaseFields {
  return {
    declarationFields: { ...parsed.declarationFields },
    supportingDocuments: parsed.supportingDocuments.map((d) => ({
      sectionId: d.sectionId,
      label: d.label,
      parsedFields: d.parsedFields,
      rawText: '',
    })),
  };
}

function labelForKey(k: keyof ParsedFields) {
  switch (k) {
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
    default:
      return String(k);
  }
}

function NeoEditableFieldCard({
  fieldKey,
  field,
  discrepancy,
  showEvidenceLinks,
  onApply,
}: {
  fieldKey: FieldKey;
  field: { value: string; evidenceText: string } | undefined;
  discrepancy?: FieldDiscrepancy | null;
  showEvidenceLinks?: boolean;
  onApply: (key: FieldKey, value: string) => void;
}) {
  const [draft, setDraft] = useState(field?.value ?? '');
  useEffect(() => {
    setDraft(field?.value ?? '');
  }, [field?.value, fieldKey]);

  const label = submissionFieldLabel(fieldKey);
  const status = discrepancy?.status ?? null;
  const pillClass = status === 'Match' ? 'cf-pill-match' : status === 'Mismatch' ? 'cf-pill-mismatch' : status ? 'cf-pill-notfound' : '';

  return (
    <div className="neo-parse-field neo-panel">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 950, color: '#0f172a' }}>{label}</div>
        {showEvidenceLinks && status ? <span className={`cf-pill ${pillClass}`}>{status}</span> : null}
      </div>
      <label className="neo-parse-field__label" htmlFor={`neo-parse-${fieldKey}`}>
        Beyanname value (editable)
      </label>
      <input
        id={`neo-parse-${fieldKey}`}
        className="neo-parse-field__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={field ? undefined : 'Not extracted — enter manually'}
      />
      <button type="button" className="neo-btn neo-btn--secondary neo-btn--sm" style={{ marginTop: 8 }} onClick={() => onApply(fieldKey, draft)}>
        Apply &amp; relink
      </button>
      {showEvidenceLinks ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: '#334155', fontWeight: 950, fontSize: 13 }}>Linked supporting evidence</div>
          {discrepancy ? (
            discrepancy.evidence.length === 0 ? (
              <div style={{ marginTop: 8, color: '#64748b', fontWeight: 700, fontSize: 12 }}>No supporting evidence linked for this value.</div>
            ) : (
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                {discrepancy.evidence.map((ev, idx) => (
                  <div key={`${ev.documentLabel}-${idx}`} style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#f8fafc' }}>
                    <div style={{ fontWeight: 950, color: '#0f172a' }}>{ev.documentLabel}</div>
                    <div style={{ marginTop: 6, color: '#334155', fontWeight: 900, fontSize: 13 }}>
                      Supporting value: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{ev.supportingValue}</span>
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 900, color: '#334155', fontSize: 12 }}>Evidence snippet</div>
                    <pre
                      style={{
                        marginTop: 6,
                        padding: 10,
                        borderRadius: 14,
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        overflow: 'auto',
                        fontSize: 12,
                        color: '#0f172a',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        whiteSpace: 'pre-wrap',
                        maxHeight: 110,
                      }}
                    >
                      {ev.extractedEvidenceText}
                    </pre>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div style={{ marginTop: 8, color: '#64748b', fontWeight: 700, fontSize: 12 }}>Run parse to link supporting evidence.</div>
          )}
        </div>
      ) : field?.evidenceText ? (
        <>
          <div style={{ marginTop: 10, color: '#334155', fontWeight: 850, fontSize: 13 }}>Declaration evidence snippet</div>
          <pre className="neo-parse-field__snippet">{field.evidenceText}</pre>
        </>
      ) : (
        <div style={{ marginTop: 10, color: '#64748b', fontWeight: 700, fontSize: 12 }}>No declaration snippet (manual or missing field).</div>
      )}
    </div>
  );
}

function FieldCard({ label, field }: { label: string; field: { value: string; evidenceText: string } | undefined }) {
  return (
    <div style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#ffffff' }}>
      <div style={{ fontWeight: 950, color: '#0f172a' }}>{label}</div>
      {field ? (
        <>
          <div style={{ marginTop: 8, fontWeight: 900, color: '#334155', fontSize: 13 }}>
            Value:{' '}
            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
              {field.value}
            </span>
          </div>
          <div style={{ marginTop: 10, color: '#334155', fontWeight: 850, fontSize: 13 }}>Evidence snippet</div>
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
              whiteSpace: 'pre-wrap',
            }}
          >
            {field.evidenceText}
          </pre>
        </>
      ) : (
        <div style={{ marginTop: 10, color: '#991b1b', fontWeight: 950, fontSize: 13 }}>Not found</div>
      )}
    </div>
  );
}

export function CaseStepParse(props: Props) {
  const {
    caseModel,
    uploadMode,
    sessionCombinedFile,
    sessionDeclarationFile,
    sessionSupportingFiles,
    onParse,
    onModelChange,
    embeddedInWorkspace,
    showParsePanel = true,
    showEditableFields = true,
    showEvidenceLinks = false,
  } = props;
  const neo = useNeoUi();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const parsed = caseModel.parsed;
  const discrepancies = caseModel.discrepancies;

  const applyDeclarationEdit = useCallback(
    (fieldKey: FieldKey, value: string) => {
      const cm = loadCaseStore();
      if (!cm.parsed) return;
      const base = storedParsedToCaseFields(cm.parsed);
      const v = value.trim();
      const prev = base.declarationFields[fieldKey];
      if (!v && !prev) {
        onModelChange?.();
        return;
      }
      base.declarationFields[fieldKey] = prev
        ? { ...prev, value: v }
        : v
          ? { value: v, evidenceText: '(edited)' }
          : undefined;
      const discrepancies = detectDiscrepancies(base);
      setParsedAndDiscrepancies({
        declarationFields: base.declarationFields,
        supportingDocuments: base.supportingDocuments,
        discrepancies,
      });
      onModelChange?.();
    },
    [onModelChange],
  );

  const declarationCards = useMemo(() => {
    if (!parsed) return null;
    const decl = parsed.declarationFields;
    if (neo) {
      return (
        <>
          {CHECKED_FIELDS.map((fk) => (
            <NeoEditableFieldCard
              key={fk}
              fieldKey={fk}
              field={decl[fk]}
              discrepancy={discrepancies?.find((r) => r.fieldKey === fk) ?? null}
              showEvidenceLinks={showEvidenceLinks}
              onApply={applyDeclarationEdit}
            />
          ))}
        </>
      );
    }
    return (
      <>
        <FieldCard label="Company Name" field={decl.companyName} />
        <FieldCard label="Gross Weight" field={decl.grossWeightKg} />
        <FieldCard label="Invoice Number" field={decl.invoiceNumber} />
        <FieldCard label="Item Description" field={decl.itemDescription} />
        <FieldCard label="Quantity" field={decl.quantity} />
      </>
    );
  }, [parsed, neo, applyDeclarationEdit, discrepancies, showEvidenceLinks]);

  async function doParse() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await onParse(uploadMode, sessionCombinedFile, sessionDeclarationFile, sessionSupportingFiles);
      setMsg(res.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={[neo ? 'neo-surface' : '', embeddedInWorkspace && neo ? 'neo-step-embedded' : ''].filter(Boolean).join(' ') || undefined}
      style={{ display: 'grid', gap: embeddedInWorkspace && neo ? 10 : 14 }}
    >
      {showParsePanel ? (
        <div className="cf-ui-card">
          {embeddedInWorkspace && neo ? (
            <p className="cf-ui-muted" style={{ margin: 0, fontSize: 13 }}>
              Run extraction on files stored on this case. After parse, edit fields below and use Apply to relink.
            </p>
          ) : (
            <>
              <div className="cf-ui-muted" style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#163a63' }}>
                {neo ? 'Parse · declaration fields' : 'CIS 4120 HW5 — Requirement 5'}
              </div>
              <h2 className="cf-ui-title">Parse fields</h2>
              <p className="cf-ui-muted" style={{ marginTop: 8, marginBottom: 0 }}>
                From a realistic declaration and at least two supporting PDFs, extract company name, gross weight, invoice number, item description, and quantity into
                structured data the UI can render.
                {neo && parsed ? ' In this layout you can edit values and click Apply to re-run cross-document linking.' : null}
              </p>
            </>
          )}
          <div style={{ marginTop: 10, color: '#334155', fontWeight: 900, fontSize: 12 }}>
            Mode: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{uploadMode}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={doParse}
              disabled={loading}
              className="cf-ui-primaryBtn"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Parsing...' : 'Parse + classify'}
            </button>
          </div>
          {msg ? (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 14,
                background: '#f8fafc',
                border: '1px solid #e5e7eb',
                color: '#0f172a',
                fontWeight: 900,
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg}
            </div>
          ) : null}
        </div>
      ) : null}

      {showEditableFields ? (
        parsed ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="cf-ui-cardTight">
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: 14 }}>
                {neo ? 'Declaration fields (extracted — edit & relink below)' : 'Declaration extracted fields'}
              </h3>
              <div
                style={{
                  marginTop: 12,
                  display: 'grid',
                  gap: neo ? 10 : 12,
                  gridTemplateColumns: neo ? 'repeat(auto-fit, minmax(160px, 1fr))' : 'repeat(auto-fit, minmax(280px, 1fr))',
                }}
              >
                {declarationCards}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16, color: '#334155', fontWeight: 900 }}>
            {neo
              ? 'No parsed data yet. Upload and store files on the Upload step, then run “Parse + classify”.'
              : 'No parsed data yet. Complete Requirements 3–4 (upload and store), then click “Parse + classify”.'}
          </div>
        )
      ) : null}
    </div>
  );
}

