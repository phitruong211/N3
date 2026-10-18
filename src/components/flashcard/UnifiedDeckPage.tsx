import { useCallback, useMemo, useState } from 'react';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import type { CardView } from '@/lib/cards';
import { defaultDeckTemplate, type DeckTemplateConfig } from '@/lib/ankiImport';
import { buildBuiltInDecks, buildSavedDeck, deckSummary, type BuiltInDeckDefinition } from '@/lib/deckCatalog';
import { buildFreeStudyQueue, lessonOptions } from '@/lib/studySetup';
import { buildScheduledDeckQueue, type DeckScheduleSummary } from '@/lib/deckSchedule';
import { builtInDeckResumeKey, resolveResumeIndex } from '@/lib/studyResume';
import { StudySession } from './StudySession';
import { ImportedDecks } from './ImportedDecks';
import { DeckCard } from './DeckCard';
import { LevelDecks, type LevelRow } from './LevelDecks';
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

  const progressFor = useCallback((card: CardView) => {
    const progress = progressById.get(`${card.type}:${card.id}`);
    return progress ? { state: progress.state, dueDate: progress.dueDate, firstReviewedAt: progress.firstReviewedAt, lastReviewedAt: progress.lastReviewedAt, repetitions: progress.reps, lastRating: progress.lastRating } : null;
  }, [progressById]);
  // One pass per deck per change, shared by every level row, instead of once per card per render.
  const schedules = useMemo(() => new Map(decks.map(deck => [deck.id, buildScheduledDeckQueue(deck.cards, progressFor, { dailyNewLimit: settings.srsDailyNewLimit })])), [decks, progressFor, settings.srsDailyNewLimit]);
  const lessonDecks = useMemo(() => new Set(decks.filter(deck => lessonOptions(deck.cards).length > 0).map(deck => deck.id)), [decks]);

  function scheduleFor(deck: BuiltInDeckDefinition) {
    return schedules.get(deck.id) ?? buildScheduledDeckQueue(deck.cards, progressFor, { dailyNewLimit: settings.srsDailyNewLimit });
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

  function savedCard(deck: BuiltInDeckDefinition) {
    const summary = deckSummary({ ...deck, source: 'SAVED' }, progressById);
    const badge = { label: 'Đã lưu', tone: 'neutral' as const };
    if (mode === 'free') {
      const hasLessons = lessonOptions(deck.cards).length > 0;
      return <DeckCard key={deck.id} summary={summary} badge={badge} hideProgress
        primaryLabel={deck.cards.length ? hasLessons ? 'Chọn bài →' : 'Bắt đầu học →' : 'Chưa có thẻ'}
        primaryDisabled={!deck.cards.length} onPrimary={() => freeAction(deck)}/>;
    }
    const scheduled = scheduleFor(deck);
    return <DeckCard key={deck.id} summary={summary} badge={badge} metrics={scheduleMetrics(scheduled.summary)}
      primaryLabel={scheduled.cards.length ? 'Ôn ngay →' : 'Đã hoàn thành hôm nay'}
      primaryDisabled={!scheduled.cards.length} onPrimary={() => launchScheduled(deck)}/>;
  }

  const levelRows: LevelRow[] = decks.map(deck => {
    const schedule = scheduleFor(deck);
    return {
      id: deck.id, level: deck.level, kind: deck.kind, totalCards: deck.cards.length,
      learnedCount: schedule.summary.learnedCount, dueCount: schedule.summary.remainingTodayCount,
      startable: mode === 'free' ? deck.cards.length > 0 : schedule.cards.length > 0,
      actionLabel: lessonDecks.has(deck.id) ? 'Chọn bài' : 'Bắt đầu',
      onOpen: () => mode === 'free' ? freeAction(deck) : launchScheduled(deck),
    };
  });

  if (session) return <StudySession cards={session.cards} deckName={session.name} template={session.template} mode={session.mode} initialIndex={session.initialIndex}
    onPositionChange={session.mode === 'flashcards' ? cardId => setJSON(builtInDeckResumeKey(session.id), cardId) : undefined}
    onComplete={session.mode === 'flashcards' ? () => setJSON(builtInDeckResumeKey(session.id), null) : undefined}
    onExit={() => setSession(null)}/>;

  return <div className="study-page" data-reduced-motion={settings.reducedMotion || undefined}>
    <header>
      <h1 className="text-3xl font-semibold tracking-[-.035em]">{mode === 'free' ? 'Bộ thẻ' : 'Ôn ngắt quãng'}</h1>
    </header>

    <ImportedDecks mode={mode} leadingDeck={saved.cards.length ? savedCard(saved) : undefined}/>

    <LevelDecks mode={mode} rows={levelRows} storage={{ getJSON, setJSON }}/>

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
