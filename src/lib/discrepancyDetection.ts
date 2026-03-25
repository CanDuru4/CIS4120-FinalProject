import type { FieldKey, ParsedCaseFields, ParsedField, ParsedSupportingDocument } from './fieldParsing';
import { compareValues } from './tolerantMatching';

export type EvidenceItem = {
  documentLabel: string;
  extractedEvidenceText: string; // exact line/snippet used for evidence UI
  supportingValue: string;
  score: number;
};

export type FieldDiscrepancy = {
  fieldKey: FieldKey;
  declarationValue?: string;
  status: 'Match' | 'Mismatch' | 'Not Found';
  evidence: EvidenceItem[];
};

export const CHECKED_FIELDS: FieldKey[] = [
  'companyName',
  'grossWeightKg',
  'invoiceNumber',
  'itemDescription',
  'quantity',
];

function getFieldFromDoc(doc: ParsedSupportingDocument, key: FieldKey): ParsedField | undefined {
  return doc.parsedFields[key];
}

function collectEvidenceCandidates(
  declarationValue: string,
  fieldKey: FieldKey,
  docs: ParsedSupportingDocument[],
): Array<EvidenceItem & { isMatch: boolean }> {
  const out: Array<EvidenceItem & { isMatch: boolean }> = [];
  for (const doc of docs) {
    const parsed = getFieldFromDoc(doc, fieldKey);
    if (!parsed) continue;
    const res = compareValues(fieldKey, declarationValue, parsed.value);
    out.push({
      documentLabel: doc.label,
      extractedEvidenceText: parsed.evidenceText,
      supportingValue: parsed.value,
      score: res.score,
      isMatch: res.isMatch,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

export function detectDiscrepancies(parsed: ParsedCaseFields): FieldDiscrepancy[] {
  const decl = parsed.declarationFields;
  const supportingDocs = parsed.supportingDocuments;

  return CHECKED_FIELDS.map((fieldKey) => {
    const declarationField = decl[fieldKey];
    const declarationValue = declarationField?.value;

    if (!declarationValue) {
      return { fieldKey, declarationValue: undefined, status: 'Not Found', evidence: [] };
    }

    const candidates = collectEvidenceCandidates(declarationValue, fieldKey, supportingDocs);
    if (candidates.length > 0) {
      const anyMatch = candidates.some((c) => c.isMatch);
      const evidence = (anyMatch ? candidates.filter((c) => c.isMatch) : candidates).map(({ isMatch: _isMatch, ...ev }) => ev);
      return {
        fieldKey,
        declarationValue,
        status: anyMatch ? 'Match' : 'Mismatch',
        evidence,
      };
    }

    return {
      fieldKey,
      declarationValue,
      status: 'Not Found',
      evidence: [],
    };
  });
}

