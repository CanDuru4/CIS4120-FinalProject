import type { SupportingSection } from './separateCombined';

export type FieldKey =
  | 'companyName'
  | 'grossWeightKg'
  | 'invoiceNumber'
  | 'itemDescription'
  | 'quantity';

export type ParsedField = {
  value: string;
  evidenceText: string; // exact matched snippet for evidence UI
};

export type ParsedFields = Partial<Record<FieldKey, ParsedField>>;

export type ParsedSupportingDocument = {
  sectionId: number;
  label: string;
  parsedFields: ParsedFields;
  rawText: string;
};

export type ParsedCaseFields = {
  declarationFields: ParsedFields;
  supportingDocuments: ParsedSupportingDocument[];
};

function parseSingleField(text: string, fieldRegex: RegExp): ParsedField | undefined {
  const match = fieldRegex.exec(text);
  if (!match) return undefined;
  const evidenceText = match[0].trim();
  const value = (match[1] ?? '').trim();
  if (!value) return undefined;
  return { value, evidenceText };
}

function parseFieldsFromText(text: string): ParsedFields {
  // Use multiline-friendly regexes to find “Label: value” lines.
  const companyName = parseSingleField(text, /Company Name:\s*(.+)/i);
  const grossWeightKg = parseSingleField(text, /Gross Weight:\s*([0-9.,]+)\s*kg/i);
  const invoiceNumber = parseSingleField(text, /Invoice Number:\s*(.+)/i);
  const itemDescription = parseSingleField(text, /Item Description:\s*(.+)/i);
  const quantity = parseSingleField(text, /Quantity:\s*(.+)/i);

  return {
    companyName,
    grossWeightKg: grossWeightKg ? { ...grossWeightKg, value: grossWeightKg.value + ' kg' } : undefined,
    invoiceNumber,
    itemDescription,
    quantity,
  };
}

export function parseCaseFields(declarationText: string, supportingSections: SupportingSection[]): ParsedCaseFields {
  const declarationFields = parseFieldsFromText(declarationText);

  const supportingDocuments: ParsedSupportingDocument[] = supportingSections.map((s) => {
    // We label sections by their marker id to make evidence UI stable.
    const label = `Supporting Document ${s.id}`;
    return {
      sectionId: s.id,
      label,
      parsedFields: parseFieldsFromText(s.text),
      rawText: s.text,
    };
  });

  return { declarationFields, supportingDocuments };
}

