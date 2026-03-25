import type { FieldDiscrepancy } from '../lib/discrepancyDetection';
import type { FieldKey, ParsedFields, ParsedSupportingDocument } from '../lib/fieldParsing';

export type StoredFile = {
  id: string;
  role: 'declaration' | 'supporting';
  fileName: string;
  mimeType: string;
};

export type StoredSupportingDoc = {
  sectionId: number;
  label: string;
  parsedFields: ParsedFields;
};

export type StoredParsedCase = {
  declarationFields: ParsedFields;
  supportingDocuments: StoredSupportingDoc[];
};

export type CaseWorkflowState =
  | 'Draft'
  | 'Returned for Changes'
  | 'Ready for Review'
  | 'Ready to Submit';

export type ReviewerComment = {
  id: string;
  author: string;
  workflowState: CaseWorkflowState;
  comment: string;
  createdAt: number;
};

export type CaseStore = {
  caseId: string;
  files: StoredFile[];

  parsed: StoredParsedCase | null;
  discrepancies: FieldDiscrepancy[] | null;

  workflowState: CaseWorkflowState;
  reviewerComments: ReviewerComment[];

  submission: {
    submitted: boolean;
    submittedAt: number | null;
    overrideExplanation?: string | null;
    issuesAtSubmit?: string[] | null;
  };

  updatedAt: number;
};

const STORAGE_KEY = 'hw5_prototype_case_store_v1';

function now() {
  return Date.now();
}

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function createEmptyCaseStore(): CaseStore {
  return {
    caseId: 'case_demo_1',
    files: [],
    parsed: null,
    discrepancies: null,
    workflowState: 'Draft',
    reviewerComments: [],
    submission: { submitted: false, submittedAt: null, overrideExplanation: null, issuesAtSubmit: null },
    updatedAt: now(),
  };
}

function migrateWorkflowState(raw: CaseStore): CaseStore {
  const w = raw.workflowState as string;
  if (w === 'Ready for Final Review') {
    return { ...raw, workflowState: 'Ready for Review' };
  }
  return raw;
}

export function loadCaseStore(): CaseStore {
  if (typeof window === 'undefined') return createEmptyCaseStore();
  const parsed = safeJsonParse<CaseStore>(window.localStorage.getItem(STORAGE_KEY));
  if (!parsed) return createEmptyCaseStore();
  return migrateWorkflowState(parsed);
}

export function saveCaseStore(next: CaseStore) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function resetCaseStore() {
  const empty = createEmptyCaseStore();
  saveCaseStore(empty);
  return empty;
}

export function updateCaseStore(updater: (prev: CaseStore) => CaseStore) {
  const prev = loadCaseStore();
  const next = updater(prev);
  next.updatedAt = now();
  saveCaseStore(next);
  return next;
}

export function upsertStoredFile(role: StoredFile['role'], fileName: string, mimeType: string) {
  const id = `${role}_${fileName}_${Math.random().toString(16).slice(2)}`;
  updateCaseStore((prev) => {
    const nextFiles = prev.files.concat([{ id, role, fileName, mimeType }]);
    return { ...prev, files: nextFiles };
  });
}

export function setParsedAndDiscrepancies({
  declarationFields,
  supportingDocuments,
  discrepancies,
}: {
  declarationFields: ParsedFields;
  supportingDocuments: ParsedSupportingDocument[];
  discrepancies: FieldDiscrepancy[];
}) {
  updateCaseStore((prev) => {
    const storedSupporting: StoredSupportingDoc[] = supportingDocuments.map((d) => ({
      sectionId: d.sectionId,
      label: d.label,
      parsedFields: d.parsedFields,
    }));

    return {
      ...prev,
      parsed: {
        declarationFields,
        supportingDocuments: storedSupporting,
      },
      discrepancies,
    };
  });
}

