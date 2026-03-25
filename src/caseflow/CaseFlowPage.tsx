import React from 'react';
import '../styles/global.css';
import './caseflow.css';
import './caseflow-ui.css';
import { loadCaseStore } from '../state/caseStore';
import { useCaseFlowController } from './useCaseFlowController';

import { CaseStepUpload } from './CaseStepUpload';
import { CaseStepParse } from './CaseStepParse';
import { CaseStepCompare } from './CaseStepCompare';
import { CaseStepEvidence } from './CaseStepEvidence';
import { CaseStepValidation } from './CaseStepValidation';
import { CaseStepWorkflow } from './CaseStepWorkflow';
import { CaseStepHelloWorld } from './CaseStepHelloWorld';
import { CaseStepHelloStyles } from './CaseStepHelloStyles';
import { CaseStepTolerantMatching } from './CaseStepTolerantMatching';
import { CaseStepDashboard } from './CaseStepDashboard';

export default function CaseFlowPage() {
  const {
    STEPS,
    caseModel,
    setCaseModel,
    activeStep,
    setActiveStep,
    uploadMode,
    sessionDeclarationFile,
    sessionSupportingFiles,
    sessionCombinedFile,
    setSessionFiles,
    handleLoadDemo,
    handleParse,
    handleReset,
    onLoadDemoFromUpload,
  } = useCaseFlowController();

  return (
    <div className="cf-page">
      <header className="cf-header">
        <div className="cf-headerLeft">
          <div className="cf-title">HW5 Case Flow</div>
          <div className="cf-subtitle">
            CIS 4120 HW5 — requirements 1–11 in one flow (Req 3–4 share upload; Req 11 role dashboard opens cases into later steps)
          </div>
        </div>
        <div className="cf-headerRight">
          <div className="cf-caseBadge">
            Case: <span className="cf-caseId">{caseModel.caseId}</span>
          </div>
          <div className="cf-workflowBadge">
            Workflow: <span className="cf-workflowText">{caseModel.workflowState}</span>
          </div>
        </div>
      </header>

      <div className="cf-grid">
        <aside className="cf-steps">
          {STEPS.map((s, idx) => {
            const isActive = s.id === activeStep;
            const enabled =
              s.id === 'helloWorld' ||
              s.id === 'helloStyles' ||
              s.id === 'dashboard' ||
              s.id === 'upload' ||
              s.id === 'tolerantMatch' ||
              (s.id === 'parse' && !!caseModel.files.find((f) => f.role === 'declaration')) ||
              (s.id === 'compare' && !!caseModel.parsed) ||
              (s.id === 'evidence' && !!caseModel.discrepancies) ||
              (s.id === 'validate' && !!caseModel.discrepancies) ||
              (s.id === 'workflow' && caseModel.workflowState != null);

            return (
              <button
                key={s.id}
                className={`cf-step ${isActive ? 'active' : ''}`}
                disabled={!enabled}
                onClick={() => setActiveStep(s.id)}
              >
                <div className="cf-stepReq">{s.req}</div>
                <div className="cf-stepRow">
                  <div className="cf-stepIndex">{idx + 1}</div>
                  <div className="cf-stepTitle">{s.title}</div>
                </div>
                <div className="cf-stepHint">{s.hint}</div>
              </button>
            );
          })}
          <div className="cf-stepActions">
            <button className="cf-linkBtn" onClick={handleLoadDemo}>
              Load demo case
            </button>
            <button className="cf-linkBtn" onClick={handleReset}>
              Reset case
            </button>
          </div>
        </aside>

        <section className="cf-content">
          {activeStep === 'upload' ? (
            <CaseStepUpload
              caseModel={caseModel}
              uploadMode={uploadMode}
              sessionCombinedFile={sessionCombinedFile}
              sessionDeclarationFile={sessionDeclarationFile}
              sessionSupportingFiles={sessionSupportingFiles}
              onSetSessionFiles={setSessionFiles}
              onLoadDemo={onLoadDemoFromUpload}
              onUpdateCase={() => setCaseModel(loadCaseStore())}
            />
          ) : null}

          {activeStep === 'helloWorld' ? <CaseStepHelloWorld /> : null}
          {activeStep === 'helloStyles' ? <CaseStepHelloStyles /> : null}

          {activeStep === 'dashboard' ? <CaseStepDashboard /> : null}

          {activeStep === 'parse' ? (
            <CaseStepParse
              caseModel={caseModel}
              uploadMode={uploadMode}
              sessionCombinedFile={sessionCombinedFile}
              sessionDeclarationFile={sessionDeclarationFile}
              sessionSupportingFiles={sessionSupportingFiles}
              onParse={(modeNext, combinedFile, decl, supp) =>
                handleParse({ mode: modeNext, combinedFile, declarationFile: decl, supportingFiles: supp })
              }
            />
          ) : null}

          {activeStep === 'compare' ? <CaseStepCompare caseModel={caseModel} onParseAgain={() => handleParse()} /> : null}

          {activeStep === 'tolerantMatch' ? <CaseStepTolerantMatching /> : null}

          {activeStep === 'evidence' ? <CaseStepEvidence caseModel={caseModel} /> : null}

          {activeStep === 'validate' ? <CaseStepValidation caseModel={caseModel} setCaseModel={setCaseModel} /> : null}

          {activeStep === 'workflow' ? <CaseStepWorkflow caseModel={caseModel} setCaseModel={setCaseModel} /> : null}
        </section>
      </div>
    </div>
  );
}
