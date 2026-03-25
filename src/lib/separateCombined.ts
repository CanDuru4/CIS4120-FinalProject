export type SupportingSection = {
  id: number;
  text: string;
};

export type SplitCombinedResult = {
  declarationText: string;
  supportingSections: SupportingSection[];
};

function normalizeCombinedText(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n');
}

function extractBetween(text: string, startMarker: string, endMarker: string) {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return null;
  const endIdx = text.indexOf(endMarker, startIdx + startMarker.length);
  if (endIdx === -1) return null;
  return text.slice(startIdx + startMarker.length, endIdx);
}

export function separateCombinedText(extractedText: string): SplitCombinedResult {
  const text = normalizeCombinedText(extractedText);

  const declarationChunk = extractBetween(
    text,
    '===DECLARATION_START===',
    '===DECLARATION_END===',
  );

  // Find all supporting sections that match ===SUPPORTING_START_<n>=== ... ===SUPPORTING_END_<n>===
  const startRegex = /===SUPPORTING_START_(\d+)===/g;
  const starts: Array<{ id: number; index: number }> = [];
  for (;;) {
    const match = startRegex.exec(text);
    if (!match) break;
    starts.push({ id: Number(match[1]), index: match.index });
  }

  const supportingSections: SupportingSection[] = [];
  for (const s of starts) {
    const endMarker = `===SUPPORTING_END_${s.id}===`;
    const endIdx = text.indexOf(endMarker, s.index + 1);
    if (endIdx === -1) continue;

    const raw = text.slice(s.index + (`===SUPPORTING_START_${s.id}===`.length), endIdx);
    supportingSections.push({ id: s.id, text: raw.trim() });
  }

  return {
    declarationText: (declarationChunk ?? text).trim(),
    supportingSections,
  };
}

