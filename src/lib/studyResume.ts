export const builtInDeckResumeKey = (deckId: string) =>
  `built_in_deck_resume_${deckId}`;

export function resolveResumeIndex(
  cards: readonly { id: string }[],
  cardId: string | null | undefined,
): number {
  if (!cardId) return 0;
  const index = cards.findIndex((card) => card.id === cardId);
  return index >= 0 ? index : 0;
}
