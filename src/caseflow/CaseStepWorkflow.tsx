import React, { useMemo, useState } from 'react';
import { useNeoUi } from '../neo/NeoUiContext';
import type { CaseStore, CaseWorkflowState } from '../state/caseStore';
import { loadCaseStore, resetCaseStore, updateCaseStore } from '../state/caseStore';
import { setDashboardQueueStatusForCase } from '../state/dashboardQueueStore';
import '../styles/theme.css';
import './caseflow-ui.css';

type Props = {
  caseModel: CaseStore;
  setCaseModel: React.Dispatch<React.SetStateAction<CaseStore>>;
};

function workflowClass(state: CaseWorkflowState) {
  switch (state) {
    case 'Draft':
      return 'cf-workflowDraft';
    case 'Returned for Changes':
      return 'cf-workflowReturned';
    case 'Ready for Review':
      return 'cf-workflowReview';
    case 'Ready to Submit':
      return 'cf-workflowCEO';
    default:
      return 'cf-workflowDraft';
  }
}

export function CaseStepWorkflow({ caseModel, setCaseModel }: Props) {
  const neo = useNeoUi();
  const [currentUser, setCurrentUser] = useState('Reviewer A');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const badgeClass = useMemo(() => workflowClass(caseModel.workflowState), [caseModel.workflowState]);

  const draftMode = caseModel.workflowState === 'Draft';
  const returnedMode = caseModel.workflowState === 'Returned for Changes';
  const reviewMode = caseModel.workflowState === 'Ready for Review';
  const submitMode = caseModel.workflowState === 'Ready to Submit';

  function refresh() {
    setCaseModel(loadCaseStore());
  }

  function reset() {
    resetCaseStore();
    setComment('');
    setError(null);
    refresh();
  }

  function submitTransition(targetState: CaseWorkflowState) {
    setError(null);
    if (!comment.trim()) {
      setError('Please enter a review comment before transitioning.');
      return;
    }

    updateCaseStore((prev) => {
      const newComment = {
        id: `c_${Math.random().toString(16).slice(2)}`,
        author: currentUser.trim() || 'Anonymous',
        workflowState: targetState,
        comment: comment.trim(),
        createdAt: Date.now(),
      };

      return {
        ...prev,
        workflowState: targetState,
        reviewerComments: prev.reviewerComments.concat([newComment]),
      };
    });

    setDashboardQueueStatusForCase(loadCaseStore().caseId, targetState);
    setComment('');
    refresh();
  }

  return (
    <div className={neo ? 'neo-surface' : undefined} style={{ display: 'grid', gap: 14 }}>
      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <div style={{ marginBottom: 6, fontSize: 12, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#163a63', fontWeight: 950 }}>
          CIS 4120 HW5 — Requirement 10
        </div>
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>Workflow state transitions &amp; review comments</h2>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 850, fontSize: 13 }}>
          Flow: <strong>Draft</strong> → <strong>Ready for Review</strong> (after Send Files) → Lead may <strong>Return</strong> to analyst or <strong>Release to CEO</strong>{' '}
          (<strong>Ready to Submit</strong>). Comments persist in localStorage.
        </p>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#f8fafc' }}>
            <div style={{ fontWeight: 950, color: '#0f172a', marginBottom: 8 }}>Current user</div>
            <input
              value={currentUser}
              onChange={(e) => setCurrentUser(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid #d1dbe8' }}
              placeholder="Reviewer name"
            />
            <div style={{ marginTop: 10, color: '#334155', fontWeight: 900, fontSize: 13 }}>Switch users by changing this input.</div>
          </div>

          <div style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#f8fafc' }}>
            <div style={{ fontWeight: 950, color: '#0f172a', marginBottom: 8 }}>Workflow state</div>
            <div className={badgeClass} style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 14px', borderRadius: 999, fontWeight: 950 }}>
              {caseModel.workflowState}
            </div>
            <div style={{ marginTop: 10, color: '#334155', fontWeight: 900, fontSize: 13 }}>Dashboard queue syncs when you transition here.</div>
          </div>
        </div>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        {draftMode ? (
          <>
            <div style={{ fontWeight: 950, color: '#0f172a' }}>Draft (Case Analyst)</div>
            <div style={{ marginTop: 6, color: '#334155', fontWeight: 900, fontSize: 13 }}>
              Continue upload, parse, and comparison. Use <strong>Send Files</strong> (Submit validation step) to move this case to the Lead queue as{' '}
              <strong>Ready for Review</strong>.
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                style={{ border: '1px solid #d1dbe8', padding: '10px 14px', borderRadius: 12, background: '#ffffff', color: '#0f172a', fontWeight: 950, cursor: 'pointer' }}
                onClick={reset}
              >
                Reset case
              </button>
            </div>
          </>
        ) : returnedMode ? (
          <>
            <div style={{ fontWeight: 950, color: '#0f172a' }}>Returned for Changes (Case Analyst)</div>
            <div style={{ marginTop: 6, color: '#334155', fontWeight: 900, fontSize: 13 }}>
              The Lead sent this case back. Fix the issues, then use <strong>Send Files</strong> again to return it to <strong>Ready for Review</strong>.
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                style={{ border: '1px solid #d1dbe8', padding: '10px 14px', borderRadius: 12, background: '#ffffff', color: '#0f172a', fontWeight: 950, cursor: 'pointer' }}
                onClick={reset}
              >
                Reset case
              </button>
            </div>
          </>
        ) : reviewMode ? (
          <>
            <div style={{ fontWeight: 950, color: '#0f172a' }}>Ready for Review (Lead Reviewer)</div>
            <div style={{ marginTop: 6, color: '#334155', fontWeight: 900, fontSize: 13 }}>
              Return the case to the Case Analyst, or release it to the CEO as <strong>Ready to Submit</strong>. A comment is required.
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              style={{ marginTop: 10, width: '100%', padding: 10, borderRadius: 12, border: '1px solid #d1dbe8' }}
              placeholder="Review notes…"
            />
            {error ? <div style={{ marginTop: 8, color: '#991b1b', fontWeight: 950 }}>{error}</div> : null}
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                style={{ border: 'none', padding: '10px 14px', borderRadius: 12, background: '#163a63', color: '#fff', fontWeight: 950, cursor: 'pointer' }}
                onClick={() => submitTransition('Returned for Changes')}
              >
                Return to Case Analyst
              </button>
              <button
                style={{ border: 'none', padding: '10px 14px', borderRadius: 12, background: '#0f2f52', color: '#fff', fontWeight: 950, cursor: 'pointer' }}
                onClick={() => submitTransition('Ready to Submit')}
              >
                Release to CEO
              </button>
              <button
                style={{ border: '1px solid #d1dbe8', padding: '10px 14px', borderRadius: 12, background: '#ffffff', color: '#0f172a', fontWeight: 950, cursor: 'pointer' }}
                onClick={reset}
              >
                Reset case
              </button>
            </div>
          </>
        ) : submitMode ? (
          <>
            <div style={{ fontWeight: 950, color: '#0f172a' }}>Ready to Submit (CEO)</div>
            <div style={{ marginTop: 6, color: '#334155', fontWeight: 900, fontSize: 13 }}>
              This case appears on the CEO dashboard. Executive submission is not implemented in this prototype.
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                style={{ border: '1px solid #d1dbe8', padding: '10px 14px', borderRadius: 12, background: '#ffffff', color: '#0f172a', fontWeight: 950, cursor: 'pointer' }}
                onClick={reset}
              >
                Reset case
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <h3 style={{ margin: 0, color: '#0f172a', fontSize: 14 }}>Stored reviewer comments</h3>
        <div style={{ marginTop: 8, color: '#334155', fontWeight: 900, fontSize: 13 }}>Persisted in localStorage.</div>
        {caseModel.reviewerComments.length === 0 ? (
          <div style={{ marginTop: 12, color: '#334155', fontWeight: 900 }}>No comments yet.</div>
        ) : (
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            {caseModel.reviewerComments
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((c) => (
                <div key={c.id} style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#f8fafc' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ fontWeight: 950, color: '#0f172a' }}>{c.author}</div>
                    <div style={{ fontWeight: 950, fontSize: 12, padding: '6px 10px', borderRadius: 999, border: '1px solid #d1dbe8', background: '#ffffff', color: '#334155' }}>
                      {c.workflowState}
                    </div>
                    <div style={{ marginLeft: 'auto', fontWeight: 950, fontSize: 12, color: '#334155' }}>{new Date(c.createdAt).toLocaleString()}</div>
                  </div>
                  <div style={{ marginTop: 10, color: '#0f172a', fontWeight: 900, whiteSpace: 'pre-wrap' }}>{c.comment}</div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
