import React, { useCallback, useState } from 'react';
import type { SupportingSection } from '../lib/separateCombined';
import { extractTextFromFile } from '../lib/pdfTextExtraction';
import { parseCaseFields } from '../lib/fieldParsing';
import { detectDiscrepancies } from '../lib/discrepancyDetection';
import { separateCombinedText } from '../lib/separateCombined';
import { getDeclarationText, getSupportingText } from '../lib/samplePdfs';
import {
  loadCaseStore,
  resetCaseStore,
  updateCaseStore,
  upsertStoredFile,
  setParsedAndDiscrepancies,
  type CaseStore,
} from '../state/caseStore';
import { appendDraftQueueRow } from '../state/dashboardQueueStore';

export type StepId =
  | 'helloWorld'
  | 'helloStyles'
  | 'dashboard'
  | 'upload'
  | 'parse'
  | 'compare'
  | 'tolerantMatch'
  | 'evidence'
  | 'validate'
  | 'workflow';

export const CASE_FLOW_STEPS: Array<{ id: StepId; title: string; req: string; hint: string }> = [
  {
    id: 'helloWorld',
    title: 'Hello world',
    req: 'Requirement 1',
    hint: 'React web app in a laptop browser; opening screen shows “Hello World”.',
  },
  {
    id: 'helloStyles',
    title: 'Hello styles',
    req: 'Requirement 2',
    hint: 'Style guide: colors, typography hierarchy, icons, badges, warning styles.',
  },
  {
    id: 'dashboard',
    title: 'Role dashboard',
    req: 'Requirement 11',
    hint: 'Two roles: different visible cases, statuses, and actions; Open case enters the flow at the right step.',
  },
  {
    id: 'upload',
    title: 'Upload & store',
    req: 'Requirements 3 & 4',
    hint: 'Req 3: separate declaration + ≥3 supporting PDFs with name, type, role. Req 4: one combined PDF (declaration first, then supporting sections).',
  },
  {
    id: 'parse',
    title: 'Parse fields',
    req: 'Requirement 5',
    hint: 'Extract company name, gross weight, invoice #, item description, quantity into structured data.',
  },
  {
    id: 'compare',
    title: 'Compare',
    req: 'Requirement 6',
    hint: 'Cross-document check: ≥5 fields as Match / Mismatch / Not Found.',
  },
  {
    id: 'tolerantMatch',
    title: 'Tolerant matching',
    req: 'Requirement 7',
    hint: 'Near-matches (punctuation/spacing) stay Match; genuinely different values stay Mismatch.',
  },
  {
    id: 'evidence',
    title: 'Evidence',
    req: 'Requirement 8',
    hint: 'Select a declaration field; see supporting doc name + extracted value/snippet used.',
  },
  {
    id: 'validate',
    title: 'Submit validation',
    req: 'Requirement 9',
    hint: '“Send Files” warns/blocks incomplete cases; lists what is missing; success after fixed.',
  },
  {
    id: 'workflow',
    title: 'Workflow & comments',
    req: 'Requirement 10',
    hint: 'Draft → Ready for Review (Lead) → Ready to Submit (CEO); Returned for Changes back to Analyst; comments persist.',
  },
];

/** Port 5175: customs journey only (Reqs 3–9), no hello/styles/dashboard/workflow steps. */
export const NEO_CUSTOMS_STEP_IDS: StepId[] = ['upload', 'parse', 'compare', 'tolerantMatch', 'evidence', 'validate'];

const NEO_CUSTOMS_STEP_COPY: Partial<Record<StepId, { req: string; hint: string }>> = {
  upload: {
    req: 'Upload',
    hint: 'Store declaration and supporting PDFs (separate or combined). Roles and file metadata are preserved.',
  },
  parse: {
    req: 'Parse',
    hint: 'Extract declaration fields and supporting values for cross-checking.',
  },
  compare: {
    req: 'Compare',
    hint: 'See Match, Mismatch, or Not Found for each tracked field.',
  },
  tolerantMatch: {
    req: 'Rules',
    hint: 'Minor formatting differences still count as aligned; real conflicts stay visible.',
  },
  evidence: {
    req: 'Evidence',
    hint: 'Supporting document names, values, and snippets for each field.',
  },
  validate: {
    req: 'Submit',
    hint: 'Send when documents, parsed data, and links are complete — or review blocking reasons.',
  },
};

export const NEO_CUSTOMS_STEPS = NEO_CUSTOMS_STEP_IDS.map((id) => {
  const base = CASE_FLOW_STEPS.find((s) => s.id === id)!;
  const o = NEO_CUSTOMS_STEP_COPY[id];
  return o ? { ...base, req: o.req, hint: o.hint } : base;
});

export type CaseFlowVariant = 'full' | 'neo';

function useStateSafeLoad(): [CaseStore, React.Dispatch<React.SetStateAction<CaseStore>>] {
  const [cm, setCm] = React.useState<CaseStore>(() => loadCaseStore());
  return [cm, setCm];
}

type ControllerOpts = { variant?: CaseFlowVariant };

export function useCaseFlowController(opts: ControllerOpts = {}) {
  const variant: CaseFlowVariant = opts.variant ?? 'full';
  const isNeo = variant === 'neo';

  const [caseModel, setCaseModel] = useStateSafeLoad();
  const [activeStep, setActiveStep] = useState<StepId>(() => (isNeo ? 'upload' : 'helloWorld'));
  const [sessionDeclarationFile, setSessionDeclarationFile] = useState<File | null>(null);
  const [sessionSupportingFiles, setSessionSupportingFiles] = useState<File[]>([]);
  const [sessionCombinedFile, setSessionCombinedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'separate' | 'combined'>('separate');

  const handleLoadDemo = useCallback(() => {
    setUploadMode('separate');
    setSessionCombinedFile(null);
    resetCaseStore();
    upsertStoredFile('declaration', 'declaration_demo.pdf', 'application/pdf');
    upsertStoredFile('supporting', 'supporting_1_demo.pdf', 'application/pdf');
    upsertStoredFile('supporting', 'supporting_2_demo.pdf', 'application/pdf');
    upsertStoredFile('supporting', 'supporting_3_demo.pdf', 'application/pdf');
    updateCaseStore((prev) => ({
      ...prev,
      caseId: `CUS-DEMO-${Date.now()}`,
      workflowState: 'Draft',
      submission: { submitted: false, submittedAt: null, overrideExplanation: null, issuesAtSubmit: null },
    }));
    setCaseModel(loadCaseStore());
    if (!isNeo) setActiveStep('parse');
  }, [isNeo]);

  const handleParse = useCallback(
    async (sessionFiles?: {
      declarationFile: File | null;
      supportingFiles: File[];
      combinedFile: File | null;
      mode: 'separate' | 'combined';
    }) => {
      const cm = loadCaseStore();
      const declStored = cm.files.find((f) => f.role === 'declaration');
      const supportingStored = cm.files.filter((f) => f.role === 'supporting');
      const mode = sessionFiles?.mode ?? uploadMode;
      if (mode === 'separate') {
        if (!declStored || supportingStored.length < 2) {
          return { ok: false, message: 'Please upload a declaration and at least two supporting PDFs.' };
        }
      } else {
        if (supportingStored.length < 2) {
          return { ok: false, message: 'Please upload a combined PDF (Step 1 will create the separated sections).' };
        }
      }

      const declLower = declStored?.fileName?.toLowerCase() ?? '';
      const supportingLower = supportingStored.map((f) => f.fileName.toLowerCase());

      const isSample =
        declLower.includes('declaration') &&
        supportingLower.some((n) => n.includes('supporting_1')) &&
        supportingLower.some((n) => n.includes('supporting_2'));

      let declText: string;
      let supportingSections: SupportingSection[];

      if (mode === 'combined') {
        const combinedFile = sessionFiles?.combinedFile ?? sessionCombinedFile;
        if (!combinedFile) {
          return { ok: false, message: 'Please select a combined PDF in Step 1 before parsing.' };
        }
        const extractedCombined = await extractTextFromFile(combinedFile);
        const split = separateCombinedText(extractedCombined);
        declText = split.declarationText;
        supportingSections = split.supportingSections.map((s) => ({ id: s.id, text: s.text }));
      } else if (isSample) {
        declText = getDeclarationText();
        const ids = [1, 2, 3] as const;
        supportingSections = ids.map((id) => ({
          id,
          text: getSupportingText(id),
        }));
      } else {
        if (!sessionFiles?.declarationFile || sessionFiles.supportingFiles.length < 2) {
          return {
            ok: false,
            message:
              'This prototype can reliably parse the sample PDFs. For user uploads, please stay in this session and upload the PDFs again before parsing.',
          };
        }

        const declExtracted = await extractTextFromFile(sessionFiles.declarationFile);
        const supportingExtracted = await Promise.all(
          sessionFiles.supportingFiles.slice(0, 3).map(async (f, idx) => ({
            id: idx + 1,
            text: await extractTextFromFile(f),
          })),
        );
        declText = declExtracted;
        supportingSections = supportingExtracted;
      }

      const parsed = parseCaseFields(declText, supportingSections);
      const discrepancies = detectDiscrepancies(parsed);

      setParsedAndDiscrepancies({
        declarationFields: parsed.declarationFields,
        supportingDocuments: parsed.supportingDocuments,
        discrepancies,
      });
      appendDraftQueueRow(loadCaseStore());

      setCaseModel(loadCaseStore());
      if (!isNeo) setActiveStep('compare');
      return { ok: true, message: 'Parsed and classified fields successfully.' };
    },
    [uploadMode, sessionCombinedFile, isNeo],
  );

  const handleReset = useCallback(() => {
    resetCaseStore();
    setCaseModel(loadCaseStore());
    setActiveStep(isNeo ? 'upload' : 'helloWorld');
  }, [isNeo]);

  const setSessionFiles = useCallback(
    (modeNext: 'separate' | 'combined', combinedFile: File | null, declFile: File | null, supportingFiles: File[]) => {
      setUploadMode(modeNext);
      setSessionCombinedFile(combinedFile);
      setSessionDeclarationFile(declFile);
      setSessionSupportingFiles(supportingFiles);
    },
    [],
  );

  const onLoadDemoFromUpload = useCallback(() => {
    setUploadMode('separate');
    setSessionDeclarationFile(null);
    setSessionSupportingFiles([]);
    setSessionCombinedFile(null);
    handleLoadDemo();
  }, [handleLoadDemo]);

  return {
    STEPS: isNeo ? NEO_CUSTOMS_STEPS : CASE_FLOW_STEPS,
    variant,
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
  };
}

export type CaseFlowController = ReturnType<typeof useCaseFlowController>;
