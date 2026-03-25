import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.resolve(__dirname, '..', 'sample_pdfs');

const PAGE_W = 612;
const PAGE_H = 792;

function normalizeLines(lines) {
  return lines.map((l) => String(l).replace(/\s+/g, ' ').trim());
}

async function createTextPdf(lines) {
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

const DECLARATION = {
  companyName: 'Example Goods LLC',
  grossWeightKg: '1234.56 kg',
  invoiceNumber: 'INV-1002',
  itemDescription: 'Widget A (50 kg bags)',
  quantity: '42',
};

const SUPPORTING_1 = {
  companyNameNear: 'Example Goods, LLC',
  grossWeightNear: '1234.6 kg',
  invoiceNumberMismatch: 'INV-1003',
};

const SUPPORTING_2 = {
  itemDescriptionNear: 'Widget A - 50kg bags',
};

const SUPPORTING_3 = {
  note: 'Note: Supporting document 3 omits quantity intentionally for prototype validation.',
};

function declarationLines(v) {
  return [
    'DECLARATION DOCUMENT',
    `Company Name: ${v.companyName}`,
    `Gross Weight: ${v.grossWeightKg}`,
    `Invoice Number: ${v.invoiceNumber}`,
    `Item Description: ${v.itemDescription}`,
    `Quantity: ${v.quantity}`,
  ];
}

function supporting1Lines() {
  return [
    'SUPPORTING DOCUMENT 1',
    `Company Name: ${SUPPORTING_1.companyNameNear}`,
    `Gross Weight: ${SUPPORTING_1.grossWeightNear}`,
    `Invoice Number: ${SUPPORTING_1.invoiceNumberMismatch}`,
  ];
}

function supporting2Lines() {
  return [
    'SUPPORTING DOCUMENT 2',
    `Item Description: ${SUPPORTING_2.itemDescriptionNear}`,
  ];
}

function supporting3Lines() {
  return ['SUPPORTING DOCUMENT 3', SUPPORTING_3.note];
}

function supportingClean1Lines(v) {
  return [
    'SUPPORTING DOCUMENT 1 (CLEAN)',
    `Company Name: ${v.companyName}`,
    `Gross Weight: ${v.grossWeightKg}`,
    `Invoice Number: ${v.invoiceNumber}`,
  ];
}

function supportingClean2Lines(v) {
  return ['SUPPORTING DOCUMENT 2 (CLEAN)', `Item Description: ${v.itemDescription}`];
}

function supportingClean3Lines(v) {
  return ['SUPPORTING DOCUMENT 3 (CLEAN)', `Quantity: ${v.quantity}`];
}

function combinedLines() {
  return [
    '===DECLARATION_START===',
    ...declarationLines(DECLARATION),
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
}

function combinedCleanLines() {
  return [
    '===DECLARATION_START===',
    ...declarationLines(DECLARATION),
    '===DECLARATION_END===',
    '===SUPPORTING_START_1===',
    ...supportingClean1Lines(DECLARATION),
    '===SUPPORTING_END_1===',
    '===SUPPORTING_START_2===',
    ...supportingClean2Lines(DECLARATION),
    '===SUPPORTING_END_2===',
    '===SUPPORTING_START_3===',
    ...supportingClean3Lines(DECLARATION),
    '===SUPPORTING_END_3===',
  ];
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function write(outPath, bytes) {
  await fs.writeFile(outPath, bytes);
}

async function main() {
  await ensureDir(outDir);

  const declarationBytes = await createTextPdf(declarationLines(DECLARATION));
  const supporting1Bytes = await createTextPdf(supporting1Lines());
  const supporting2Bytes = await createTextPdf(supporting2Lines());
  const supporting3Bytes = await createTextPdf(supporting3Lines());
  const combinedBytes = await createTextPdf(combinedLines());
  const combinedCleanBytes = await createTextPdf(combinedCleanLines());

  await write(path.join(outDir, 'declaration.pdf'), declarationBytes);
  await write(path.join(outDir, 'supporting_1.pdf'), supporting1Bytes);
  await write(path.join(outDir, 'supporting_2.pdf'), supporting2Bytes);
  await write(path.join(outDir, 'supporting_3.pdf'), supporting3Bytes);
  await write(path.join(outDir, 'combined.pdf'), combinedBytes);
  await write(path.join(outDir, 'combined_clean.pdf'), combinedCleanBytes);

  // Also provide a copy with the names your UI uses in demo mode.
  await write(path.join(outDir, 'declaration_demo.pdf'), declarationBytes);
  await write(path.join(outDir, 'supporting_1_demo.pdf'), supporting1Bytes);
  await write(path.join(outDir, 'supporting_2_demo.pdf'), supporting2Bytes);
  await write(path.join(outDir, 'supporting_3_demo.pdf'), supporting3Bytes);
  await write(path.join(outDir, 'combined_clean_demo.pdf'), combinedCleanBytes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

