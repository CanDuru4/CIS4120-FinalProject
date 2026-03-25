import type { CaseStore } from '../state/caseStore';

export function submissionFieldLabel(key: string): string {
  switch (key) {
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
      return key;
  }
}

/** Same rules as port 5174 / Req 9: structural gaps + each Mismatch / Not Found field. */
export function computeSubmissionIssues(caseModel: CaseStore): string[] {
  const issues: string[] = [];
  const declCount = caseModel.files.filter((f) => f.role === 'declaration').length;
  const supportingCount = caseModel.files.filter((f) => f.role === 'supporting').length;

  if (declCount < 1 || supportingCount < 2) issues.push('Required documents are missing');
  if (!caseModel.parsed) issues.push('Declarant data is missing');
  if (!caseModel.discrepancies) {
    issues.push('Linking is missing — run Parse + classify so declaration fields are linked to supporting documents.');
  }
  if (caseModel.discrepancies) {
    for (const ex of caseModel.discrepancies.filter((d) => d.status !== 'Match')) {
      issues.push(`${submissionFieldLabel(ex.fieldKey)} — ${ex.status}`);
    }
  }

  return issues;
}
