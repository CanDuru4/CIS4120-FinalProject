import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type GeneratedCasePdfs = {
  declaration: Uint8Array;
  supporting: Uint8Array[]; // exactly 3 for the prototype demo
  combined: Uint8Array;
  /** Combined PDF where declaration + all supporting sections align (all fields Match). */
  combinedClean: Uint8Array;
};

export type DemoFieldValues = {
  companyName: string;
  grossWeightKg: string;
  invoiceNumber: string;
  itemDescription: string;
  quantity: string;
};

export const DEMO_DECLARATION: DemoFieldValues = {
  companyName: 'Example Goods LLC',
  grossWeightKg: '1234.56 kg',
  invoiceNumber: 'INV-1002',
  itemDescription: 'Widget A (50 kg bags)',
  quantity: '42',
};

// Supporting values are chosen to satisfy:
// - at least 2 near-matches (company name and item description)
// - invoice number mismatch
// - quantity not found (omit from supporting docs)
export const DEMO_SUPPORTING_1 = {
  companyNameNear: 'Example Goods, LLC', // punctuation variant near-match
  grossWeightNear: '1234.6 kg', // minor decimal variation
  invoiceNumberMismatch: 'INV-1003',
};

export const DEMO_SUPPORTING_2 = {
  itemDescriptionNear: 'Widget A - 50kg bags', // punctuation/spacing variant near-match
};

export const DEMO_SUPPORTING_3 = {
  // Intentionally empty for the “quantity not found” requirement.
};

const PAGE_W = 612;
const PAGE_H = 792;

function normalizeLines(lines: string[]) {
  return lines.map((l) => l.replace(/\s+/g, ' ').trim());
}

async function createTextPdf(lines: string[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 72;
  const lineHeight = 16;

  for (const line of normalizeLines(lines)) {
    if (y < 72) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 72;
    }
    page.drawText(line, {
      x: 48,
      y,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
  }

  return await pdfDoc.save();
}

function declarationLines(values: DemoFieldValues) {
  return [
    'DECLARATION DOCUMENT',
    `Company Name: ${values.companyName}`,
    `Gross Weight: ${values.grossWeightKg}`,
    `Invoice Number: ${values.invoiceNumber}`,
    `Item Description: ${values.itemDescription}`,
    `Quantity: ${values.quantity}`,
  ];
}

function supporting1Lines() {
  return [
    'SUPPORTING DOCUMENT 1',
    `Company Name: ${DEMO_SUPPORTING_1.companyNameNear}`,
    `Gross Weight: ${DEMO_SUPPORTING_1.grossWeightNear}`,
    `Invoice Number: ${DEMO_SUPPORTING_1.invoiceNumberMismatch}`,
  ];
}

function supporting2Lines() {
  return [
    'SUPPORTING DOCUMENT 2',
    `Item Description: ${DEMO_SUPPORTING_2.itemDescriptionNear}`,
  ];
}

function supporting3Lines() {
  return [
    'SUPPORTING DOCUMENT 3',
    'Note: Supporting document 3 omits quantity intentionally for prototype validation.',
  ];
}

/** Supporting sections that exactly match declaration values (for “no errors” combined demo). */
function supportingClean1Lines(values: DemoFieldValues) {
  return [
    'SUPPORTING DOCUMENT 1 (CLEAN)',
    `Company Name: ${values.companyName}`,
    `Gross Weight: ${values.grossWeightKg}`,
    `Invoice Number: ${values.invoiceNumber}`,
  ];
}

function supportingClean2Lines(values: DemoFieldValues) {
  return ['SUPPORTING DOCUMENT 2 (CLEAN)', `Item Description: ${values.itemDescription}`];
}

function supportingClean3Lines(values: DemoFieldValues) {
  return ['SUPPORTING DOCUMENT 3 (CLEAN)', `Quantity: ${values.quantity}`];
}

export function getDeclarationText(): string {
  return declarationLines(DEMO_DECLARATION).join('\n');
}

export function getSupportingText(sectionId: 1 | 2 | 3): string {
  if (sectionId === 1) return supporting1Lines().join('\n');
  if (sectionId === 2) return supporting2Lines().join('\n');
  return supporting3Lines().join('\n');
}

export function getCombinedText(): string {
  return [
    '===DECLARATION_START===',
    ...declarationLines(DEMO_DECLARATION),
    '===DECLARATION_END===',
    '===SUPPORTING_START_1===',
    ...supporting1Lines(),
    '===SUPPORTING_END_1===',
    '===SUPPORTING_START_2===',
    ...supporting2Lines(),
    '===SUPPORTING_END_2===',
    '===SUPPORTING_START_3===',
    ...supporting3Lines(),
    '===SUPPORTING_END_3===',
  ].join('\n');
}

/** Combined PDF text: same markers as `getCombinedText`, but supporting values match declaration (no Mismatch / Not Found). */
export function getCombinedCleanText(): string {
  const v = DEMO_DECLARATION;
  return [
    '===DECLARATION_START===',
    ...declarationLines(v),
    '===DECLARATION_END===',
    '===SUPPORTING_START_1===',
    ...supportingClean1Lines(v),
    '===SUPPORTING_END_1===',
    '===SUPPORTING_START_2===',
    ...supportingClean2Lines(v),
    '===SUPPORTING_END_2===',
    '===SUPPORTING_START_3===',
    ...supportingClean3Lines(v),
    '===SUPPORTING_END_3===',
  ].join('\n');
}

export async function generateSampleCasePdfs(): Promise<GeneratedCasePdfs> {
  const declaration = await createTextPdf(declarationLines(DEMO_DECLARATION));
  const supporting1 = await createTextPdf(supporting1Lines());
  const supporting2 = await createTextPdf(supporting2Lines());
  const supporting3 = await createTextPdf(supporting3Lines());

  const combinedLines = [
    '===DECLARATION_START===',
    ...declarationLines(DEMO_DECLARATION),
    '===DECLARATION_END===',
    '===SUPPORTING_START_1===',
    ...supporting1Lines(),
    '===SUPPORTING_END_1===',
    '===SUPPORTING_START_2===',
    ...supporting2Lines(),
    '===SUPPORTING_END_2===',
    '===SUPPORTING_START_3===',
    ...supporting3Lines(),
    '===SUPPORTING_END_3===',
  ];

  const combined = await createTextPdf(combinedLines);

  const combinedCleanLines = [
    '===DECLARATION_START===',
    ...declarationLines(DEMO_DECLARATION),
    '===DECLARATION_END===',
    '===SUPPORTING_START_1===',
    ...supportingClean1Lines(DEMO_DECLARATION),
    '===SUPPORTING_END_1===',
    '===SUPPORTING_START_2===',
    ...supportingClean2Lines(DEMO_DECLARATION),
    '===SUPPORTING_END_2===',
    '===SUPPORTING_START_3===',
    ...supportingClean3Lines(DEMO_DECLARATION),
    '===SUPPORTING_END_3===',
  ];
  const combinedClean = await createTextPdf(combinedCleanLines);

  return {
    declaration,
    supporting: [supporting1, supporting2, supporting3],
    combined,
    combinedClean,
  };
}

