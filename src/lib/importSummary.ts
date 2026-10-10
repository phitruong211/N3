import type { ImportIssue, ImportPreview } from './ankiImport.ts';

export type ImportIssueGroup = { reason: string; count: number; samples: ImportIssue[] };

export function summarizeImport(preview: Pick<ImportPreview, 'cards' | 'skipped' | 'issues' | 'duplicates'>, sampleLimit = 3) {
  const grouped = new Map<string, ImportIssue[]>();
  for (const issue of preview.issues ?? []) grouped.set(issue.reason, [...(grouped.get(issue.reason) ?? []), issue]);
  return {
    status: preview.cards.length ? (preview.skipped ? 'warning' : 'success') : 'error',
    valid: preview.cards.length,
    skipped: preview.skipped,
    duplicates: preview.duplicates ?? 0,
    samples: preview.cards.slice(0, sampleLimit),
    groups: [...grouped].map(([reason, issues]) => ({ reason, count: issues.length, samples: issues.slice(0, 3) })),
  } as const;
}
