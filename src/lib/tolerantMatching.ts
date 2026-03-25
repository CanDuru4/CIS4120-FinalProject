import type { FieldKey } from './fieldParsing';

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function stripPunctuation(s: string) {
  // Keep alphanumerics + whitespace.
  return s.replace(/[^a-zA-Z0-9\s]/g, ' ');
}

function removeCommonCompanySuffixes(tokens: string[]) {
  const banned = new Set([
    'llc',
    'inc',
    'ltd',
    'co',
    'company',
    'corporation',
    'corp',
    'l.p.',
    'ltd.',
  ]);
  return tokens.filter((t) => !banned.has(t));
}

function normalizeForCompany(s: string) {
  const lower = s.toLowerCase();
  const noPunct = stripPunctuation(lower);
  const tokens = normalizeWhitespace(noPunct).split(' ').filter(Boolean);
  const trimmed = removeCommonCompanySuffixes(tokens);
  return trimmed.join(' ');
}

function normalizeForText(s: string) {
  const lower = s.toLowerCase();
  const noPunct = stripPunctuation(lower);
  return normalizeWhitespace(noPunct);
}

function trigrams(s: string) {
  const str = normalizeWhitespace(s);
  const padded = `  ${str}  `;
  const res: string[] = [];
  for (let i = 0; i < padded.length - 2; i++) {
    res.push(padded.slice(i, i + 3));
  }
  return res;
}

function trigramSimilarity(a: string, b: string) {
  const aa = trigrams(a);
  const bb = trigrams(b);
  const aSet = new Map<string, number>();
  for (const t of aa) aSet.set(t, (aSet.get(t) ?? 0) + 1);
  const bSet = new Map<string, number>();
  for (const t of bb) bSet.set(t, (bSet.get(t) ?? 0) + 1);

  let intersection = 0;
  for (const [token, countA] of aSet.entries()) {
    const countB = bSet.get(token) ?? 0;
    intersection += Math.min(countA, countB);
  }
  const union = aa.length + bb.length - intersection;
  if (union <= 0) return 0;
  return intersection / union;
}

function parseFirstNumber(s: string): number | null {
  const m = s.match(/([0-9]+(?:[.,][0-9]+)?)/);
  if (!m) return null;
  const normalized = m[1].replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

export type ValueMatchResult = {
  isMatch: boolean;
  score: number; // 0..1
};

export function compareValues(fieldKey: FieldKey, declarationValue: string, supportingValue: string): ValueMatchResult {
  const d = declarationValue.trim();
  const s = supportingValue.trim();

  if (fieldKey === 'grossWeightKg') {
    const dn = parseFirstNumber(d);
    const sn = parseFirstNumber(s);
    if (dn == null || sn == null) return { isMatch: false, score: 0 };
    const rel = Math.abs(dn - sn) / Math.max(Math.abs(dn), Math.abs(sn));
    // Prototype tolerance: 1% relative difference.
    const isMatch = rel <= 0.01;
    // Convert rel into a score that degrades smoothly.
    const score = Math.max(0, 1 - rel * 5);
    return { isMatch, score };
  }

  if (fieldKey === 'quantity') {
    const dn = parseFirstNumber(d);
    const sn = parseFirstNumber(s);
    if (dn == null || sn == null) return { isMatch: false, score: 0 };
    const isMatch = Math.round(dn) === Math.round(sn);
    return { isMatch, score: isMatch ? 1 : 0 };
  }

  if (fieldKey === 'companyName') {
    const dn = normalizeForCompany(d);
    const sn = normalizeForCompany(s);
    if (!dn || !sn) return { isMatch: false, score: 0 };
    const score = trigramSimilarity(dn, sn);
    // Prototype threshold tuned for punctuation/spacing variants.
    return { isMatch: score >= 0.72, score };
  }

  if (fieldKey === 'itemDescription') {
    const dn = normalizeForText(d);
    const sn = normalizeForText(s);
    if (!dn || !sn) return { isMatch: false, score: 0 };
    const score = trigramSimilarity(dn, sn);
    return { isMatch: score >= 0.68, score };
  }

  if (fieldKey === 'invoiceNumber') {
    const dn = normalizeForText(d).replace(/\s+/g, '');
    const sn = normalizeForText(s).replace(/\s+/g, '');
    if (!dn || !sn) return { isMatch: false, score: 0 };
    if (dn === sn) return { isMatch: true, score: 1 };
    // Invoice numbers should be tolerant only to formatting changes (spacing/punctuation),
    // not to digit-level differences.
    const score = trigramSimilarity(dn, sn);
    return { isMatch: score >= 0.95, score };
  }

  return { isMatch: false, score: 0 };
}

// Small helper for the “tolerant matching” prototype page.
export function isNearMatchDemoExample(): boolean {
  const nearCompanyD = 'Example Goods LLC';
  const nearCompanyS = 'Example Goods, LLC';
  return compareValues('companyName', nearCompanyD, nearCompanyS).isMatch;
}

