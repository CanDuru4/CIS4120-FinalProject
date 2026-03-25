import React, { useId, useMemo, useState } from 'react';
import { useNeoUi } from '../neo/NeoUiContext';
import type { CaseStore } from '../state/caseStore';
import { loadCaseStore, resetCaseStore, setParsedAndDiscrepancies, upsertStoredFile, updateCaseStore } from '../state/caseStore';
import { setDashboardQueueStatusForCase } from '../state/dashboardQueueStore';
import { getDeclarationText, getSupportingText } from '../lib/samplePdfs';
import { parseCaseFields } from '../lib/fieldParsing';
import { detectDiscrepancies } from '../lib/discrepancyDetection';
import { computeSubmissionIssues, submissionFieldLabel } from '../lib/submissionIssues';
import type { FieldDiscrepancy } from '../lib/discrepancyDetection';
import '../styles/theme.css';
import type { SupportingSection } from '../lib/separateCombined';

type Props = {
  caseModel: CaseStore;
  setCaseModel: React.Dispatch<React.SetStateAction<CaseStore>>;
  embeddedInWorkspace?: boolean;
  /** When false, hides demo-load buttons inside the validation panel. */
  showDemoButtons?: boolean;
};

function CompleteDemoButtonLabel({ submitted }: { submitted: boolean }) {
  return submitted ? 'Sent ✅' : 'Send Files';
}

function NeoValidationMatchFieldCards({ discrepancies }: { discrepancies: FieldDiscrepancy[] | null }) {
  if (!discrepancies?.length) {
    return (
      <p className="neo-val-r7-empty">
        Run <strong>Extract &amp; parse</strong> to see each field’s declaration value, supporting value, and tolerant match score (Requirement 7).
      </p>
    );
  }

  return (
    <div className="neo-val-r7-grid" role="list">
      {discrepancies.map((d) => {
        const primary = d.evidence[0];
        const decl = d.declarationValue ?? '—';
        const supp = primary?.supportingValue ?? '—';
        const docLabel = primary?.documentLabel;
        const scoreText = primary ? primary.score.toFixed(3) : '—';
        const pillClass =
          d.status === 'Match' ? 'neo-val-r7-pill neo-val-r7-pill--match' : d.status === 'Mismatch' ? 'neo-val-r7-pill neo-val-r7-pill--mismatch' : 'neo-val-r7-pill neo-val-r7-pill--nf';
        return (
          <div key={d.fieldKey} className="neo-val-r7-card" role="listitem">
            <div className="neo-val-r7-card__key">{d.fieldKey}</div>
            <div className="neo-val-r7-card__label">{submissionFieldLabel(d.fieldKey)}</div>
            <div className="neo-val-r7-row">
              <span className="neo-val-r7-k">Declaration:</span>
              <span className="neo-val-r7-mono">{decl}</span>
            </div>
            <div className="neo-val-r7-row">
              <span className="neo-val-r7-k">Supporting:</span>
              <span className="neo-val-r7-mono">{supp}</span>
            </div>
            {docLabel ? <div className="neo-val-r7-doc">{docLabel}</div> : null}
            <div className="neo-val-r7-footer">
              <span className={pillClass}>{d.status}</span>
              <span className="neo-val-r7-score">
                score: <span className="neo-val-r7-mono">{scoreText}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CaseStepValidation({ caseModel, setCaseModel, embeddedInWorkspace, showDemoButtons = true }: Props) {
  const neo = useNeoUi();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [addExplanation, setAddExplanation] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [modalIssues, setModalIssues] = useState<string[]>([]);
  const [neoR7Expanded, setNeoR7Expanded] = useState(false);
  const neoR7PanelId = useId();

  const issues = useMemo(() => computeSubmissionIssues(caseModel), [caseModel]);

  async function loadIncompleteDemo() {
    setLoading(true);
    setMsg(null);
    try {
      resetCaseStore();
      upsertStoredFile('declaration', 'declaration_incomplete_demo.pdf', 'application/pdf');
      upsertStoredFile('supporting', 'supporting_1_incomplete_demo.pdf', 'application/pdf');
      setCaseModel(loadCaseStore());
      setMsg('Incomplete demo loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCompleteDemo() {
    setLoading(true);
    setMsg(null);
    try {
      resetCaseStore();
      upsertStoredFile('declaration', 'declaration_demo.pdf', 'application/pdf');
      upsertStoredFile('supporting', 'supporting_1_demo.pdf', 'application/pdf');
      upsertStoredFile('supporting', 'supporting_2_demo.pdf', 'application/pdf');
      upsertStoredFile('supporting', 'supporting_3_demo.pdf', 'application/pdf');

      const declText = getDeclarationText();
      const ids = [1, 2, 3] as const;
      const supportingSections: SupportingSection[] = ids.map((id) => ({ id, text: getSupportingText(id) }));
      const parsed = parseCaseFields(declText, supportingSections);
      const discrepancies = detectDiscrepancies(parsed);

      setParsedAndDiscrepancies({
        declarationFields: parsed.declarationFields,
        supportingDocuments: parsed.supportingDocuments,
        discrepancies,
      });

      setCaseModel(loadCaseStore());
      setMsg('Complete demo loaded and parsed.');
    } finally {
      setLoading(false);
    }
  }

  async function onSendFiles() {
    setLoading(true);
    setMsg(null);
    try {
      const current = loadCaseStore();
      const issuesNow = computeSubmissionIssues(current);
      const explanationNow = explanation.trim();

      if (issuesNow.length > 0 && explanationNow.length === 0) {
        setMsg('Submission blocked: issues were found and no explanation was provided.');
        return;
      }

      updateCaseStore((prev) => ({
        ...prev,
        workflowState: 'Ready for Review',
        submission: {
          ...prev.submission,
          submitted: true,
          submittedAt: Date.now(),
          overrideExplanation: issuesNow.length > 0 ? explanationNow : null,
          issuesAtSubmit: issuesNow.length > 0 ? issuesNow : null,
        },
      }));
      const sent = loadCaseStore();
      setDashboardQueueStatusForCase(sent.caseId, 'Ready for Review');
      setCaseModel(loadCaseStore());
      setMsg('Submission successful: the case was sent.');
      setSendOpen(false);
      setAddExplanation(false);
      setExplanation('');
      setModalIssues([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={[neo ? 'neo-surface' : '', embeddedInWorkspace && neo ? 'neo-step-embedded' : ''].filter(Boolean).join(' ') || undefined}
      style={{ display: 'grid', gap: embeddedInWorkspace && neo ? 10 : 14 }}
    >
      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        {embeddedInWorkspace && neo ? (
          <p style={{ margin: 0, color: '#334155', fontWeight: 700, fontSize: 13 }}>
            Send runs the same checks as the course prototype: incomplete linking or mismatches block submission until resolved (or explained in the modal).
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#163a63', fontWeight: 950 }}>
              {neo ? 'Submit · validation' : 'CIS 4120 HW5 — Requirement 9'}
            </div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>Submission warning &amp; error prevention</h2>
            <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 850, fontSize: 13 }}>
              “Send Files” warns or blocks when required information or document linking is missing, lists what is missing, and allows a clean send once the case is complete.
            </p>
          </>
        )}

        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {showDemoButtons ? (
            <>
              <button
                onClick={loadIncompleteDemo}
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
                Load incomplete demo
              </button>
              <button
                onClick={loadCompleteDemo}
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
                Load complete demo
              </button>
            </>
          ) : null}
          <button
            onClick={() => {
              const latest = loadCaseStore();
              setMsg(null);
              setModalIssues(computeSubmissionIssues(latest));
              setSendOpen(true);
              setAddExplanation(false);
              setExplanation('');
            }}
            disabled={loading}
            style={{ border: 'none', padding: '10px 14px', borderRadius: 12, background: '#163a63', color: '#fff', fontWeight: 950, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            <CompleteDemoButtonLabel submitted={caseModel.submission.submitted} />
          </button>
        </div>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <h3 style={{ margin: 0, color: '#0f172a', fontSize: 14 }}>Validation status</h3>
        <div style={{ marginTop: 12 }}>
          {issues.length === 0 ? (
            <div style={{ fontWeight: 950, color: '#0f2f52' }}>All required items are present. The case can be submitted.</div>
          ) : (
            <div style={{ fontWeight: 950, color: '#991b1b' }}>
              Issues found:
              <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontWeight: 900 }}>
                {issues.map((m) => `- ${m}`).join('\n')}
              </div>
            </div>
          )}
          {neo ? (
            <div className="neo-val-r7-wrap">
              <button
                type="button"
                className="neo-val-r7-toggle"
                aria-expanded={neoR7Expanded}
                aria-controls={neoR7PanelId}
                onClick={() => setNeoR7Expanded((o) => !o)}
              >
                <span className={`neo-val-r7-toggle__chev ${neoR7Expanded ? 'neo-val-r7-toggle__chev--open' : ''}`} aria-hidden>
                  ▸
                </span>
                <span className="neo-val-r7-toggle__main">
                  <span className="neo-val-r7-eyebrow neo-val-r7-eyebrow--toggle">Requirement 7 — tolerant matching</span>
                  <span className="neo-val-r7-toggle__hint">
                    {neoR7Expanded ? 'Hide field-level declaration vs supporting & scores' : 'Show field-level declaration vs supporting & scores'}
                  </span>
                </span>
              </button>
              <div
                id={neoR7PanelId}
                role="region"
                aria-label="Requirement 7 tolerant matching details"
                hidden={!neoR7Expanded}
                className="neo-val-r7-panel"
              >
                <NeoValidationMatchFieldCards discrepancies={caseModel.discrepancies} />
              </div>
            </div>
          ) : null}
          {msg ? (
            <div
              style={{
                marginTop: 12,
                whiteSpace: 'pre-wrap',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 12,
                padding: 12,
                borderRadius: 14,
                background: '#f8fafc',
                border: '1px solid #e5e7eb',
                color: '#0f172a',
                fontWeight: 900,
              }}
            >
              {msg}
            </div>
          ) : null}
        </div>
      </div>

      {sendOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 50,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSendOpen(false);
          }}
        >
          <div style={{ width: 'min(720px, 100%)' }}>
            <div className="cf-ui-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <h2 className="cf-ui-title" style={{ fontSize: 20 }}>
                  Send files
                </h2>
                <button
                  onClick={() => setSendOpen(false)}
                  className="cf-ui-secondaryBtn"
                  style={{ padding: '8px 10px', borderRadius: 12 }}
                >
                  ✕
                </button>
              </div>
              <div style={{ height: 1, background: '#e5e7eb', marginTop: 12, marginBottom: 12 }} />

              {modalIssues.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(253,230,138,0.55)', borderRadius: 14, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="cf-pill cf-pill-mismatch">Warning</span>
                    <div style={{ fontSize: 16, fontWeight: 950, color: '#0f172a' }}>Issues found before sending</div>
                  </div>

                  <div style={{ border: '1px solid #d1dbe8', borderRadius: 14, padding: 12, background: '#f8fafc' }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {modalIssues.map((it) => (
                        <div key={it} style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 900, color: '#0f172a' }}>
                          <span className="cf-pill cf-pill-notfound" style={{ padding: '4px 8px', fontSize: 12 }}>
                            !
                          </span>
                          <span>{it}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ height: 1, background: '#e5e7eb' }} />

                  <div style={{ fontWeight: 950, color: '#0f172a', fontSize: 16 }}>Send attached files along with these exceptions?</div>

                  <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 900, color: '#0f172a' }}>
                    <input type="checkbox" checked={addExplanation} onChange={(e) => setAddExplanation(e.target.checked)} />
                    Add explanation
                  </label>

                  {addExplanation ? (
                    <textarea
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      placeholder="Explain why you are submitting despite the issues…"
                      rows={3}
                      style={{ width: '100%', border: '1px solid #d1dbe8', borderRadius: 12, padding: 10, fontWeight: 700 }}
                    />
                  ) : null}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                    <button onClick={() => setSendOpen(false)} className="cf-ui-secondaryBtn">
                      Cancel
                    </button>
                    <button
                      onClick={onSendFiles}
                      className="cf-ui-primaryBtn"
                      disabled={loading || !addExplanation || explanation.trim().length === 0}
                      style={{ opacity: loading || !addExplanation || explanation.trim().length === 0 ? 0.6 : 1 }}
                    >
                      Send Files
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="cf-pill cf-pill-match">OK</span>
                    <div style={{ fontWeight: 950, color: '#0f2f52' }}>No issues found. Ready to send.</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={() => setSendOpen(false)} className="cf-ui-secondaryBtn">
                      Cancel
                    </button>
                    <button onClick={onSendFiles} className="cf-ui-primaryBtn" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
                      Send Files
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

