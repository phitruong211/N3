export type FreeStudySummary = { viewed: number; total: number; minutes: number };

export function summarizeFreeStudy(viewedCardIds: Set<string>, total: number, minutes: number): FreeStudySummary {
  return { viewed: viewedCardIds.size, total, minutes };
}
