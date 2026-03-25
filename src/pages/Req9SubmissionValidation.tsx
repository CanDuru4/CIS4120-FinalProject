import React, { useEffect, useMemo, useState } from 'react';
import '../styles/theme.css';
import {
  loadCaseStore,
  resetCaseStore,
  setParsedAndDiscrepancies,
  type CaseStore,
  upsertStoredFile,
  updateCaseStore,
} from '../state/caseStore';
import { setDashboardQueueStatusForCase } from '../state/dashboardQueueStore';
import { getDeclarationText, getSupportingText } from '../lib/samplePdfs';
import { parseCaseFields } from '../lib/fieldParsing';
import { detectDiscrepancies } from '../lib/discrepancyDetection';
import type { SupportingSection } from '../lib/separateCombined';
import { computeSubmissionIssues } from '../lib/submissionIssues';
import '../caseflow/caseflow-ui.css';

export default function Req9SubmissionValidation() {
  const [caseModel, setCaseModel] = useState(loadCaseStore());
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [addExplanation, setAddExplanation] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [modalIssues, setModalIssues] = useState<string[]>([]);

  useEffect(() => {
    setCaseModel(loadCaseStore());
  }, []);

  function refresh() {
    setCaseModel(loadCaseStore());
  }

  const issues = useMemo(() => computeSubmissionIssues(caseModel), [caseModel]);

  async function loadIncompleteDemo() {
    setResultMsg(null);
    setLoading(true);
    try {
      resetCaseStore();
      upsertStoredFile('declaration', 'declaration_incomplete_demo.pdf', 'application/pdf');
      upsertStoredFile('supporting', 'supporting_1_incomplete_demo.pdf', 'application/pdf');
      refresh();
    } finally {
      setLoading(false);
    }
  }

  async function loadCompleteDemo() {
    setResultMsg(null);
    setLoading(true);
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
      refresh();
    } finally {
      setLoading(false);
    }
  }

  async function onSendFiles() {
    setResultMsg(null);
    setLoading(true);
    try {
      const current = loadCaseStore();
      const issuesNow = computeSubmissionIssues(current);
      const explanationNow = explanation.trim();
      if (issuesNow.length > 0 && explanationNow.length === 0) {
        setResultMsg('Submission blocked: issues were found and no explanation was provided.');
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
      setDashboardQueueStatusForCase(loadCaseStore().caseId, 'Ready for Review');
      refresh();
      setResultMsg('Submission successful: the case was sent.');
      setSendOpen(false);
      setAddExplanation(false);
      setExplanation('');
      setModalIssues([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Requirement 9: Submission warning + error prevention</h2>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 700 }}>
          “Send Files” validates completeness. If anything is missing, the UI blocks submission and tells the user exactly what’s required; once fixed, submission succeeds.
        </p>

        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={loadIncompleteDemo}
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
              fontWeight: 900,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            Load complete demo
          </button>
          <button
            onClick={() => {
              setResultMsg(null);
              setModalIssues(computeSubmissionIssues(loadCaseStore()));
              setSendOpen(true);
              setAddExplanation(false);
              setExplanation('');
            }}
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
            {caseModel.submission.submitted ? 'Sent ✅' : 'Send Files'}
          </button>
        </div>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Validation status</h3>
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {issues.length === 0 ? (
            <div style={{ fontWeight: 900, color: '#0f2f52' }}>All required items are present. The case can be submitted.</div>
          ) : (
            <div style={{ fontWeight: 900, color: '#991b1b' }}>
              Issues found:
              <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontWeight: 800 }}>
                {issues.map((m) => `- ${m}`).join('\n')}
              </div>
            </div>
          )}
          {resultMsg ? (
            <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12, padding: 12, borderRadius: 14, background: '#f8fafc', border: '1px solid #e5e7eb', color: '#0f172a' }}>
              {resultMsg}
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
                <button type="button" onClick={() => setSendOpen(false)} className="cf-ui-secondaryBtn" style={{ padding: '8px 10px', borderRadius: 12 }}>
                  ✕
                </button>
              </div>
              <div style={{ height: 1, background: '#e5e7eb', marginTop: 12, marginBottom: 12 }} />

              {modalIssues.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div
                    style={{
                      border: '1px solid rgba(245,158,11,0.35)',
                      background: 'rgba(253,230,138,0.55)',
                      borderRadius: 14,
                      padding: 12,
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
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
                    <button type="button" onClick={() => setSendOpen(false)} className="cf-ui-secondaryBtn">
                      Cancel
                    </button>
                    <button
                      type="button"
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
                    <button type="button" onClick={() => setSendOpen(false)} className="cf-ui-secondaryBtn">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={onSendFiles}
                      className="cf-ui-primaryBtn"
                      disabled={loading}
                      style={{ opacity: loading ? 0.7 : 1 }}
                    >
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


