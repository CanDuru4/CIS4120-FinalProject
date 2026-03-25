import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCaseStore } from '../state/caseStore';
import { useCaseFlowController } from '../caseflow/useCaseFlowController';
import { CaseStepParse } from '../caseflow/CaseStepParse';
import { CaseStepValidation } from '../caseflow/CaseStepValidation';
import { NeoUiProvider } from './NeoUiContext';
import { NeoButton } from './NeoButton';
import { NeoDeclarantPanel } from './NeoDeclarantPanel';
import { NeoCaseFileStrip } from './NeoCaseFileStrip';
import { NeoDocumentsPanel } from './NeoDocumentsPanel';

export default function NeoCaseFlowPage() {
  return (
    <NeoUiProvider>
      <NeoCaseFlowInner />
    </NeoUiProvider>
  );
}

function NeoCaseFlowInner() {
  const {
    caseModel,
    setCaseModel,
    uploadMode,
    sessionDeclarationFile,
    sessionSupportingFiles,
    sessionCombinedFile,
    setSessionFiles,
    handleLoadDemo,
    handleParse,
    handleReset,
    onLoadDemoFromUpload,
  } = useCaseFlowController({ variant: 'neo' });

  const refreshCase = () => setCaseModel(loadCaseStore());
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const onPreviewFileSelect = useCallback((id: string) => setPreviewFileId(id), []);

  useEffect(() => {
    setPreviewFileId(null);
  }, [caseModel.caseId]);

  return (
    <div className="neo-frame neo-frame--wide">
      <div className="neo-shell-card neo-cf">
        <header className="neo-cf-header">
          <div className="neo-cf-header__left">
            <Link to="/hub" className="neo-back">
              ←
            </Link>
            <span className="neo-cf-case-title">CASE · {caseModel.caseId}</span>
          </div>
          <div className="neo-cf-header__actions">
            <span className="neo-cf-badge">Workflow: {caseModel.workflowState}</span>
            <NeoButton variant="secondary" size="sm" onClick={handleLoadDemo}>
              Load demo case
            </NeoButton>
            <NeoButton variant="red" size="sm" onClick={handleReset}>
              Reset case
            </NeoButton>
            <Link to="/hub" style={{ textDecoration: 'none' }}>
              <NeoButton variant="secondary" size="sm">
                Hub
              </NeoButton>
            </Link>
            <div className="neo-profile" aria-hidden title="Profile" />
          </div>
        </header>

        <div className="neo-cf-workspace">
          <section className="neo-cf-main neo-cf-main--workspace neo-cf-main--customs">
            <div className="neo-surface neo-cf-workspace-surface">
              <div className="neo-cf-customs-split">
                <div className="neo-cf-customs-col neo-cf-customs-col--left">
                  {caseModel.parsed ? (
                    <CaseStepParse
                      caseModel={caseModel}
                      uploadMode={uploadMode}
                      sessionCombinedFile={sessionCombinedFile}
                      sessionDeclarationFile={sessionDeclarationFile}
                      sessionSupportingFiles={sessionSupportingFiles}
                      onParse={(modeNext, combinedFile, decl, supp) =>
                        handleParse({ mode: modeNext, combinedFile, declarationFile: decl, supportingFiles: supp })
                      }
                      onModelChange={refreshCase}
                      embeddedInWorkspace
                      showParsePanel={false}
                      showEditableFields
                      showEvidenceLinks
                    />
                  ) : (
                    <NeoDeclarantPanel caseModel={caseModel} />
                  )}

                  {caseModel.parsed ? (
                    <div style={{ marginTop: 18 }}>
                      <CaseStepValidation caseModel={caseModel} setCaseModel={setCaseModel} embeddedInWorkspace showDemoButtons={false} />
                    </div>
                  ) : null}
                </div>

                <div className="neo-cf-customs-col neo-cf-customs-col--right">
                  {caseModel.files.length > 0 ? (
                    <NeoCaseFileStrip
                      caseModel={caseModel}
                      selectedFileId={previewFileId}
                      onSelectedFileIdChange={onPreviewFileSelect}
                    />
                  ) : null}

                  <NeoDocumentsPanel
                    caseModel={caseModel}
                    uploadMode={uploadMode}
                    sessionCombinedFile={sessionCombinedFile}
                    sessionDeclarationFile={sessionDeclarationFile}
                    sessionSupportingFiles={sessionSupportingFiles}
                    onSetSessionFiles={setSessionFiles}
                    onLoadDemo={onLoadDemoFromUpload}
                    onUpdateCase={refreshCase}
                    previewFileId={previewFileId}
                  />

                  {caseModel.files.length > 0 ? (
                    <div style={{ marginTop: 18 }}>
                      <CaseStepParse
                        caseModel={caseModel}
                        uploadMode={uploadMode}
                        sessionCombinedFile={sessionCombinedFile}
                        sessionDeclarationFile={sessionDeclarationFile}
                        sessionSupportingFiles={sessionSupportingFiles}
                        onParse={(modeNext, combinedFile, decl, supp) =>
                          handleParse({ mode: modeNext, combinedFile, declarationFile: decl, supportingFiles: supp })
                        }
                        onModelChange={refreshCase}
                        embeddedInWorkspace
                        showEditableFields={false}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
