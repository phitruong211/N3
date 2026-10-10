import { useMemo, useState } from 'react';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import type { CardView } from '@/lib/cards';
import { defaultDeckTemplate, type DeckTemplateConfig } from '@/lib/ankiImport';
import { buildBuiltInDecks, buildSavedDeck, deckSummary, type BuiltInDeckDefinition } from '@/lib/deckCatalog';
import { buildFreeStudyQueue, lessonOptions, type StudySetup } from '@/lib/studySetup';
import { buildScheduledDeckQueue, type DeckScheduleSummary } from '@/lib/deckSchedule';
import { builtInDeckResumeKey, resolveResumeIndex } from '@/lib/studyResume';
import { StudySession } from './StudySession';
import { ImportedDecks } from './ImportedDecks';
import { DeckCard } from './DeckCard';
import { DeckGrid } from './DeckGrid';
import { StudySetupSheet } from './StudySetupSheet';

export function UnifiedDeckPage() {
  const { vocabulary, kanji, grammar, bookmarks, srsCards, settings } = useApp();
  const { getJSON, setJSON } = useLearningStorage();
  const [setup, setSetup] = useState<{ deck: BuiltInDeckDefinition; mode: 'free' | 'scheduled'; summary?: DeckScheduleSummary } | null>(null);
  const [session, setSession] = useState<{ id: string; name: string; cards: CardView[]; template: DeckTemplateConfig; initialIndex: number; mode: 'flashcards' | 'anki'; sessionMinutes?: number } | null>(null);

  const decks = useMemo(() => buildBuiltInDecks(vocabulary, kanji, grammar), [vocabulary, kanji, grammar]);
  const saved = useMemo(() => buildSavedDeck(decks, bookmarks), [decks, bookmarks]);
  const progressById = useMemo(() => new Map(srsCards.map(card => [`${card.deckType.toUpperCase()}:${card.cardId}`, card])), [srsCards]);
  const progress = (card: CardView) => progressById.get(`${card.type}:${card.id}`);

  function scheduleFor(deck: BuiltInDeckDefinition, newLimit: 0 | 10 | 20) {
    return buildScheduledDeckQueue(deck.cards, card => progress(card), { newLimit });
  }

  function launch(deck: BuiltInDeckDefinition, selection: StudySetup) {
    const cards = selection.mode === 'free' ? buildFreeStudyQueue(deck.cards, selection) : scheduleFor(deck, selection.newLimit).cards;
    if (!cards.length) { setSetup(null); return; }
    const resumeCardId = selection.mode === 'free' ? getJSON<string | null>(builtInDeckResumeKey(deck.id), null) : null;
    setSession({ id: deck.id, name: deck.name, cards, template: defaultDeckTemplate(), initialIndex: resolveResumeIndex(cards, resumeCardId), mode: selection.mode === 'free' ? 'flashcards' : 'anki', sessionMinutes: selection.mode === 'scheduled' ? selection.sessionMinutes : undefined });
    setSetup(null);
  }

  function card(deck: BuiltInDeckDefinition, savedDeck = false) {
    const summary = deckSummary({ ...deck, source: savedDeck ? 'SAVED' : 'BUILT_IN' }, progressById);
    const badge = savedDeck ? { label: 'Đã lưu', tone: 'neutral' as const } : deck.kind === 'vocabulary' ? { label: 'Từ vựng', tone: 'vocabulary' as const } : deck.kind === 'kanji' ? { label: 'Kanji', tone: 'kanji' as const } : { label: 'Ngữ pháp', tone: 'grammar' as const };
    const scheduled = scheduleFor(deck, 10);
    return <DeckCard key={deck.id} summary={summary} badge={badge}
      primaryLabel={deck.cards.length ? 'Học tự do →' : 'Chưa có thẻ'} primaryDisabled={!deck.cards.length} onPrimary={() => setSetup({ deck, mode: 'free' })}
      secondaryLabel="Ôn ngắt quãng" secondaryDisabled={!scheduled.cards.length} onSecondary={() => setSetup({ deck, mode: 'scheduled', summary: scheduled.summary })}/>;
  }

  if (session) return <StudySession cards={session.cards} deckName={session.name} template={session.template} mode={session.mode} initialIndex={session.initialIndex}
    sessionMinutes={session.sessionMinutes}
    onPositionChange={session.mode === 'flashcards' ? cardId => setJSON(builtInDeckResumeKey(session.id), cardId) : undefined}
    onComplete={session.mode === 'flashcards' ? () => setJSON(builtInDeckResumeKey(session.id), null) : undefined}
    onExit={() => setSession(null)}/>;

  return <div className="study-page">
    <header className="max-w-2xl"><p className="study-eyebrow">LUYỆN TẬP</p><h1 className="mt-1 text-3xl font-semibold">Bộ thẻ</h1><p className="study-copy mt-3">Mỗi bộ có hai chế độ riêng: học tự do để luyện theo ý bạn, hoặc ôn ngắt quãng để cập nhật lịch Anki.</p></header>

    <ImportedDecks leadingDeck={saved.cards.length ? card(saved, true) : undefined}/>

    <section aria-labelledby="built-in-decks"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="study-eyebrow">THƯ VIỆN</p><h2 id="built-in-decks" className="mt-1 text-xl font-semibold">Bộ có sẵn</h2></div><p className="text-xs text-[var(--color-text-tertiary)]">Nội dung chuẩn · chỉ đọc</p></div>
      <div className="space-y-7">{(['N4', 'N3', 'N2'] as const).map(level => {
        const levelDecks = decks.filter(deck => deck.level === level);
        if (!levelDecks.length) return null;
        return <section key={level} aria-labelledby={`deck-level-${level}`}><div className="mb-3 flex items-center gap-3"><h3 id={`deck-level-${level}`} className="text-sm font-semibold text-[var(--color-text-secondary)]">Trình độ {level}</h3><span className="h-px flex-1 bg-[var(--color-border)]"/></div><DeckGrid>{levelDecks.map(deck => card(deck))}</DeckGrid></section>;
      })}</div>
    </section>

    <StudySetupSheet open={Boolean(setup)} deckName={setup?.deck.name ?? ''} totalCards={setup?.deck.cards.length ?? 0} mode={setup?.mode ?? 'free'} lessons={setup ? lessonOptions(setup.deck.cards) : []} scheduleSummary={setup?.summary} defaultMinutes={settings.ankiSessionMinutes} onClose={() => setSetup(null)} onStart={selection => setup && launch(setup.deck, selection)}/>
  </div>;
}
