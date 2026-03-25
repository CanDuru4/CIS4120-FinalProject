/** Product-style titles for `/req/*` on port 5175 (lab / grading context). */
export const NEO_LAB_REQ_META: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Welcome', subtitle: 'Initial screen — lab demo' },
  2: { title: 'Design system', subtitle: 'Visual tokens and components — lab demo' },
  3: { title: 'Document upload', subtitle: 'Separate declaration and supporting PDFs' },
  4: { title: 'Combined PDF', subtitle: 'Split a single PDF into declaration and supporting sections' },
  5: { title: 'Parse declaration', subtitle: 'Extract structured fields from documents' },
  6: { title: 'Cross-check', subtitle: 'Declaration vs supporting — match status' },
  7: { title: 'Fuzzy matching', subtitle: 'Tolerant comparison rules' },
  8: { title: 'Evidence', subtitle: 'Supporting snippets linked to fields' },
  9: { title: 'Send validation', subtitle: 'Block or allow submission by completeness' },
  10: { title: 'Workflow', subtitle: 'Status transitions and comments — lab demo' },
  11: { title: 'Review board', subtitle: 'Role-filtered queue — lab demo' },
};
