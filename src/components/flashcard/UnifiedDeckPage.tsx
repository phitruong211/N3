import { useMemo, useState } from 'react';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import type { CardView } from '@/lib/cards';
import { defaultDeckTemplate, type DeckTemplateConfig } from '@/lib/ankiImport';
import { buildBuiltInDecks, buildSavedDeck, builtInLevels, deckSummary, type BuiltInDeckDefinition } from '@/lib/deckCatalog';
import { buildFreeStudyQueue, lessonOptions } from '@/lib/studySetup';
import { buildScheduledDeckQueue, type DeckScheduleSummary } from '@/lib/deckSchedule';
import { builtInDeckResumeKey, resolveResumeIndex } from '@/lib/studyResume';
import { StudySession } from './StudySession';
import { ImportedDecks } from './ImportedDecks';
import { DeckCard } from './DeckCard';
import { StudySetupSheet } from './StudySetupSheet';

export type DeckPageMode = 'free' | 'scheduled';

export function UnifiedDeckPage({ mode }: { mode: DeckPageMode }) {
  const { vocabulary, kanji, grammar, n5Decks, bookmarks, srsCards, settings } = useApp();
  const { getJSON, setJSON } = useLearningStorage();
  const [setupDeck, setSetupDeck] = useState<BuiltInDeckDefinition | null>(null);
  const [session, setSession] = useState<{ id: string; name: string; cards: CardView[]; template: DeckTemplateConfig; initialIndex: number; mode: 'flashcards' | 'anki' } | null>(null);

  const decks = useMemo(() => buildBuiltInDecks(vocabulary, kanji, grammar, n5Decks), [vocabulary, kanji, grammar, n5Decks]);
  const saved = useMemo(() => buildSavedDeck(decks, bookmarks), [decks, bookmarks]);
  const progressById = useMemo(() => new Map(srsCards.map(card => [`${card.deckType.toUpperCase()}:${card.cardId}`, card])), [srsCards]);

  function scheduleFor(deck: BuiltInDeckDefinition) {
    return buildScheduledDeckQueue(deck.cards, card => {
      const progress = progressById.get(`${card.type}:${card.id}`);
      return progress ? { state: progress.state, dueDate: progress.dueDate, firstReviewedAt: progress.firstReviewedAt, lastReviewedAt: progress.lastReviewedAt, repetitions: progress.reps, lastRating: progress.lastRating } : null;
    }, { dailyNewLimit: settings.srsDailyNewLimit });
  }

  function launchFree(deck: BuiltInDeckDefinition, lessonKey: string | null) {
    const cards = buildFreeStudyQueue(deck.cards, { mode: 'free', lessonKey });
    if (!cards.length) { setSetupDeck(null); return; }
    const resumeCardId = getJSON<string | null>(builtInDeckResumeKey(deck.id), null);
    setSession({ id: deck.id, name: deck.name, cards, template: defaultDeckTemplate(), initialIndex: resolveResumeIndex(cards, resumeCardId), mode: 'flashcards' });
    setSetupDeck(null);
  }

  function launchScheduled(deck: BuiltInDeckDefinition) {
    const scheduled = scheduleFor(deck);
    if (!scheduled.cards.length) return;
    setSession({ id: deck.id, name: deck.name, cards: scheduled.sessionCards, template: defaultDeckTemplate(), initialIndex: 0, mode: 'anki' });
  }

  function freeAction(deck: BuiltInDeckDefinition) {
    const lessons = lessonOptions(deck.cards);
    if (lessons.length) setSetupDeck(deck);
    else launchFree(deck, null);
  }

  function card(deck: BuiltInDeckDefinition, savedDeck = false) {
    const summary = deckSummary({ ...deck, source: savedDeck ? 'SAVED' : 'BUILT_IN' }, progressById);
    const badge = savedDeck ? { label: 'Đã lưu', tone: 'neutral' as const } : deck.kind === 'vocabulary' ? { label: 'Từ vựng', tone: 'vocabulary' as const } : deck.kind === 'kanji' ? { label: 'Kanji', tone: 'kanji' as const } : { label: 'Ngữ pháp', tone: 'grammar' as const };
    if (mode === 'free') {
      const hasLessons = lessonOptions(deck.cards).length > 0;
      return <DeckCard key={deck.id} summary={summary} badge={badge} hideProgress compact={!savedDeck}
        primaryLabel={deck.cards.length ? hasLessons ? 'Chọn bài →' : 'Bắt đầu học →' : 'Chưa có thẻ'}
        primaryDisabled={!deck.cards.length} onPrimary={() => freeAction(deck)}/>;
    }
    const scheduled = scheduleFor(deck);
    const due = scheduled.summary.remainingTodayCount;
    return <DeckCard key={deck.id} summary={summary} badge={badge} compact={!savedDeck} metrics={savedDeck ? scheduleMetrics(scheduled.summary) : undefined}
      meta={<><strong className="font-normal">{summary.totalCards}</strong> thẻ · {due > 0 ? <span className="text-[var(--color-accent)]">{due} cần ôn</span> : 'đã xong hôm nay'}</>}
      primaryLabel={scheduled.cards.length ? 'Ôn ngay →' : 'Đã hoàn thành hôm nay'}
      primaryDisabled={!scheduled.cards.length} onPrimary={() => launchScheduled(deck)}/>;
  }

  if (session) return <StudySession cards={session.cards} deckName={session.name} template={session.template} mode={session.mode} initialIndex={session.initialIndex}
    onPositionChange={session.mode === 'flashcards' ? cardId => setJSON(builtInDeckResumeKey(session.id), cardId) : undefined}
    onComplete={session.mode === 'flashcards' ? () => setJSON(builtInDeckResumeKey(session.id), null) : undefined}
    onExit={() => setSession(null)}/>;

  return <div className="study-page" data-reduced-motion={settings.reducedMotion || undefined}>
    <header>
      <h1 className="text-3xl font-semibold tracking-[-.035em]">{mode === 'free' ? 'Bộ thẻ' : 'Ôn ngắt quãng'}</h1>
    </header>

    <ImportedDecks mode={mode} leadingDeck={saved.cards.length ? card(saved, true) : undefined}/>

    <section aria-labelledby="built-in-decks" className="space-y-6">
      <h2 id="built-in-decks" className="sr-only">Bộ có sẵn</h2>
      {builtInLevels.map(level => {
        const levelDecks = decks.filter(deck => deck.level === level);
        if (!levelDecks.length) return null;
        return <section key={level} aria-labelledby={`deck-level-${level}`}>
          <h3 id={`deck-level-${level}`} className="today-group-title">Trình độ {level}</h3>
          <div className="deck-list">{levelDecks.map(deck => card(deck))}</div>
        </section>;
      })}
    </section>

    <StudySetupSheet open={Boolean(setupDeck)} deckName={setupDeck?.name ?? ''} lessons={setupDeck ? lessonOptions(setupDeck.cards) : []} onClose={() => setSetupDeck(null)} onStart={lessonKey => setupDeck && launchFree(setupDeck, lessonKey)}/>
  </div>;
}

function scheduleMetrics(summary: DeckScheduleSummary) {
  return [
    { label: 'Cần ôn', value: summary.dueCount, tone: 'var(--color-accent)' },
    { label: 'Chưa nhớ', value: summary.unresolvedCount },
    { label: 'Hôm nay', value: summary.studiedTodayCount },
    { label: 'Còn lại', value: summary.remainingTodayCount },
  ];
}
