import React, { useEffect, useMemo, useState } from 'react';
import '../styles/theme.css';
import { loadCaseStore, resetCaseStore, updateCaseStore } from '../state/caseStore';
import type { CaseWorkflowState } from '../state/caseStore';
import { setDashboardQueueStatusForCase } from '../state/dashboardQueueStore';

function stateBadge(state: CaseWorkflowState) {
  if (state === 'Draft') return { border: '1px solid #d1dbe8', background: '#eef2f7', color: '#0f172a' };
  if (state === 'Returned for Changes') return { border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(253,230,138,0.95)', color: '#92400e' };
  if (state === 'Ready for Review') return { border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(219,234,254,0.95)', color: '#1e3a5f' };
  if (state === 'Ready to Submit') return { border: '1px solid rgba(139,92,246,0.35)', background: 'rgba(237,233,254,0.95)', color: '#4c1d95' };
  return { border: '1px solid #d1dbe8', background: '#eef2f7', color: '#0f172a' };
}

export default function Req10WorkflowComments() {
  const [caseModel, setCaseModel] = useState(loadCaseStore());
  const [currentUser, setCurrentUser] = useState('Reviewer A');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCaseModel(loadCaseStore());
  }, []);

  function refresh() {
    setCaseModel(loadCaseStore());
  }

  const badgeStyle = useMemo(() => stateBadge(caseModel.workflowState), [caseModel.workflowState]);

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

  const draftMode = caseModel.workflowState === 'Draft';
  const returnedMode = caseModel.workflowState === 'Returned for Changes';
  const reviewMode = caseModel.workflowState === 'Ready for Review';
  const submitMode = caseModel.workflowState === 'Ready to Submit';

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Requirement 10: Workflow state transitions + review comments</h2>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#334155', fontWeight: 700 }}>
          Same flow as port 5174: Draft → Ready for Review (after Send Files) → Lead returns or releases to CEO (Ready to Submit). Comments persist in localStorage and
          sync the role dashboard queue.
        </p>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Current user</div>
            <input
              value={currentUser}
              onChange={(e) => setCurrentUser(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid #d1dbe8' }}
              placeholder="Reviewer name"
            />
          </div>

          <div style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Workflow state</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 14px', borderRadius: 999, fontWeight: 900, ...badgeStyle }}>
              {caseModel.workflowState}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          {draftMode ? (
            <div style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#ffffff' }}>
              <div style={{ fontWeight: 900, color: '#0f172a' }}>Draft</div>
              <div style={{ marginTop: 8, color: '#334155', fontWeight: 800, fontSize: 13 }}>
                Use Send Files (Req 9) to send the case to the Lead queue as Ready for Review.
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={reset}
                  style={{ border: '1px solid #d1dbe8', padding: '10px 14px', borderRadius: 12, background: '#ffffff', color: '#0f172a', fontWeight: 900, cursor: 'pointer' }}
                >
                  Reset case
                </button>
              </div>
            </div>
          ) : returnedMode ? (
            <div style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#ffffff' }}>
              <div style={{ fontWeight: 900, color: '#0f172a' }}>Returned for Changes</div>
              <div style={{ marginTop: 8, color: '#334155', fontWeight: 800, fontSize: 13 }}>
                Fix the case and use Send Files again to return it to Ready for Review.
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={reset}
                  style={{ border: '1px solid #d1dbe8', padding: '10px 14px', borderRadius: 12, background: '#ffffff', color: '#0f172a', fontWeight: 900, cursor: 'pointer' }}
                >
                  Reset case
                </button>
              </div>
            </div>
          ) : reviewMode ? (
            <div style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#ffffff' }}>
              <div style={{ fontWeight: 900, color: '#0f172a' }}>Ready for Review (Lead)</div>
              <div style={{ marginTop: 8, color: '#334155', fontWeight: 800, fontSize: 13 }}>Return to analyst or release to CEO. Comment required.</div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                style={{ marginTop: 10, width: '100%', padding: 10, borderRadius: 12, border: '1px solid #d1dbe8' }}
                placeholder="Review notes…"
              />
              {error ? <div style={{ marginTop: 8, color: '#991b1b', fontWeight: 900 }}>{error}</div> : null}
              <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => submitTransition('Returned for Changes')}
                  style={{ border: 'none', padding: '10px 14px', borderRadius: 12, background: '#163a63', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
                >
                  Return to Case Analyst
                </button>
                <button
                  onClick={() => submitTransition('Ready to Submit')}
                  style={{ border: 'none', padding: '10px 14px', borderRadius: 12, background: '#0f2f52', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
                >
                  Release to CEO
                </button>
                <button
                  onClick={reset}
                  style={{ border: '1px solid #d1dbe8', padding: '10px 14px', borderRadius: 12, background: '#ffffff', color: '#0f172a', fontWeight: 900, cursor: 'pointer' }}
                >
                  Reset case
                </button>
              </div>
            </div>
          ) : submitMode ? (
            <div style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#ffffff' }}>
              <div style={{ fontWeight: 900, color: '#0f172a' }}>Ready to Submit (CEO)</div>
              <div style={{ marginTop: 8, color: '#334155', fontWeight: 800, fontSize: 13 }}>Shown on CEO dashboard; executive submit not implemented.</div>
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={reset}
                  style={{ border: '1px solid #d1dbe8', padding: '10px 14px', borderRadius: 12, background: '#ffffff', color: '#0f172a', fontWeight: 900, cursor: 'pointer' }}
                >
                  Reset case
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #cfd7e3', borderRadius: 18, padding: 16 }}>
        <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Stored reviewer comments</h3>
        {caseModel.reviewerComments.length === 0 ? (
          <div style={{ marginTop: 12, color: '#334155', fontWeight: 800 }}>No comments yet.</div>
        ) : (
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            {caseModel.reviewerComments
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((c) => (
                <div key={c.id} style={{ border: '1px solid #d1dbe8', borderRadius: 16, padding: 12, background: '#f8fafc' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ fontWeight: 900, color: '#0f172a' }}>{c.author}</div>
                    <div style={{ fontWeight: 900, fontSize: 12, padding: '6px 10px', borderRadius: 999, border: '1px solid #d1dbe8', background: '#ffffff', color: '#334155' }}>
                      {c.workflowState}
                    </div>
                    <div style={{ marginLeft: 'auto', fontWeight: 900, fontSize: 12, color: '#334155' }}>{new Date(c.createdAt).toLocaleString()}</div>
                  </div>
                  <div style={{ marginTop: 10, color: '#0f172a', fontWeight: 800, whiteSpace: 'pre-wrap' }}>{c.comment}</div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
