import { useMemo, useState } from 'react';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import type { CardView } from '@/lib/cards';
import { defaultDeckTemplate, type DeckTemplateConfig } from '@/lib/ankiImport';
import { buildBuiltInDecks, buildSavedDeck, deckSummary, type BuiltInDeckDefinition } from '@/lib/deckCatalog';
import { buildFreeStudyQueue, lessonOptions, type StudySetup } from '@/lib/studySetup';
import { builtInDeckResumeKey, resolveResumeIndex } from '@/lib/studyResume';
import { StudySession } from './StudySession';
import { ImportedDecks } from './ImportedDecks';
import { DeckCard } from './DeckCard';
import { DeckGrid } from './DeckGrid';
import { StudySetupSheet } from './StudySetupSheet';

export function UnifiedDeckPage({ mode }: { mode: 'flashcards' | 'anki' }) {
  const { vocabulary, kanji, grammar, bookmarks, srsCards, settings } = useApp();
  const { getJSON, setJSON } = useLearningStorage();
  const [setupDeck, setSetupDeck] = useState<BuiltInDeckDefinition | null>(null);
  const [session, setSession] = useState<{ id: string; name: string; cards: CardView[]; template: DeckTemplateConfig; initialIndex: number; mode: 'flashcards' | 'anki' } | null>(null);

  const decks = useMemo(() => buildBuiltInDecks(vocabulary, kanji, grammar), [vocabulary, kanji, grammar]);
  const saved = useMemo(() => buildSavedDeck(decks, bookmarks), [decks, bookmarks]);
  const progressById = useMemo(() => new Map(srsCards.map(card => [`${card.deckType.toUpperCase()}:${card.cardId}`, card])), [srsCards]);
  const progress = (card: CardView) => progressById.get(`${card.type}:${card.id}`);

  function scheduledCards(cards: CardView[]) {
    return cards.filter(card => { const item = progress(card); return !item || item.state === 'new' || Date.parse(item.dueDate) <= Date.now(); })
      .sort((a, b) => { const left = progress(a), right = progress(b); return (left && left.state !== 'new' ? Date.parse(left.dueDate) : Infinity) - (right && right.state !== 'new' ? Date.parse(right.dueDate) : Infinity); });
  }

  function launch(deck: BuiltInDeckDefinition, setup: StudySetup) {
    const cards = setup.mode === 'free' ? buildFreeStudyQueue(deck.cards, setup) : scheduledCards(deck.cards);
    if (!cards.length) { setSetupDeck(null); return; }
    const resumeCardId = setup.mode === 'free' ? getJSON<string | null>(builtInDeckResumeKey(deck.id), null) : null;
    setSession({ id: deck.id, name: deck.name, cards, template: defaultDeckTemplate(), initialIndex: resolveResumeIndex(cards, resumeCardId), mode: setup.mode === 'free' ? 'flashcards' : 'anki' });
    setSetupDeck(null);
  }

  function card(deck: BuiltInDeckDefinition, savedDeck = false) {
    const summary = deckSummary({ ...deck, source: savedDeck ? 'SAVED' : 'BUILT_IN' }, progressById);
    const badge = savedDeck ? { label: 'Đã lưu', tone: 'neutral' as const } : deck.kind === 'vocabulary' ? { label: 'Từ vựng', tone: 'vocabulary' as const } : deck.kind === 'kanji' ? { label: 'Kanji', tone: 'kanji' as const } : { label: 'Ngữ pháp', tone: 'grammar' as const };
    const available = mode === 'anki' ? scheduledCards(deck.cards).length : deck.cards.length;
    return <DeckCard key={deck.id} summary={summary} badge={badge} primaryLabel={!deck.cards.length ? 'Chưa có thẻ' : available ? 'Chọn cách học →' : 'Chưa có thẻ đến hạn'} primaryDisabled={!available} onPrimary={() => setSetupDeck(deck)}/>;
  }

  if (session) return <StudySession cards={session.cards} deckName={session.name} template={session.template} mode={session.mode} initialIndex={session.initialIndex}
    onPositionChange={session.mode === 'flashcards' ? cardId => setJSON(builtInDeckResumeKey(session.id), cardId) : undefined}
    onComplete={session.mode === 'flashcards' ? () => setJSON(builtInDeckResumeKey(session.id), null) : undefined}
    onExit={() => setSession(null)}/>;

  return <div className="study-page">
    <header className="max-w-2xl"><p className="study-eyebrow">LUYỆN TẬP</p><h1 className="mt-1 text-3xl font-semibold">Bộ thẻ</h1><p className="study-copy mt-3">Chọn một bộ, sau đó chọn số thẻ và thứ tự học. Lịch ôn được tách riêng để bạn không vô tình thay đổi tiến trình.</p></header>

    <ImportedDecks mode={mode} leadingDeck={saved.cards.length ? card(saved, true) : undefined}/>

    <section aria-labelledby="built-in-decks"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="study-eyebrow">THƯ VIỆN</p><h2 id="built-in-decks" className="mt-1 text-xl font-semibold">Bộ có sẵn</h2></div><p className="text-xs text-[var(--color-text-tertiary)]">Nội dung chuẩn · chỉ đọc</p></div>
      <div className="space-y-7">{(['N4', 'N3', 'N2'] as const).map(level => {
        const levelDecks = decks.filter(deck => deck.level === level);
        if (!levelDecks.length) return null;
        return <section key={level} aria-labelledby={`deck-level-${level}`}><div className="mb-3 flex items-center gap-3"><h3 id={`deck-level-${level}`} className="text-sm font-semibold text-[var(--color-text-secondary)]">Trình độ {level}</h3><span className="h-px flex-1 bg-[var(--color-border)]"/></div><DeckGrid>{levelDecks.map(deck => card(deck))}</DeckGrid></section>;
      })}</div>
    </section>

    <StudySetupSheet open={Boolean(setupDeck)} deckName={setupDeck?.name ?? ''} totalCards={setupDeck?.cards.length ?? 0} canSchedule lessons={setupDeck ? lessonOptions(setupDeck.cards) : []} defaultMode={mode === 'anki' ? 'scheduled' : 'free'} defaultMinutes={settings.ankiSessionMinutes} onClose={() => setSetupDeck(null)} onStart={setup => setupDeck && launch(setupDeck, setup)}/>
  </div>;
}
