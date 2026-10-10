import { useMemo, useState } from 'react';
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
import { DeckGrid } from './DeckGrid';
import { StudySetupSheet } from './StudySetupSheet';

export type DeckPageMode = 'free' | 'scheduled';

export function UnifiedDeckPage({ mode }: { mode: DeckPageMode }) {
  const { vocabulary, kanji, grammar, bookmarks, srsCards, settings } = useApp();
  const { getJSON, setJSON } = useLearningStorage();
  const [setupDeck, setSetupDeck] = useState<BuiltInDeckDefinition | null>(null);
  const [session, setSession] = useState<{ id: string; name: string; cards: CardView[]; template: DeckTemplateConfig; initialIndex: number; mode: 'flashcards' | 'anki' } | null>(null);

  const decks = useMemo(() => buildBuiltInDecks(vocabulary, kanji, grammar), [vocabulary, kanji, grammar]);
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
    const cards = scheduleFor(deck).cards;
    if (!cards.length) return;
    setSession({ id: deck.id, name: deck.name, cards, template: defaultDeckTemplate(), initialIndex: 0, mode: 'anki' });
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
      return <DeckCard key={deck.id} summary={summary} badge={badge} hideProgress
        primaryLabel={deck.cards.length ? hasLessons ? 'Chọn bài →' : 'Bắt đầu học →' : 'Chưa có thẻ'}
        primaryDisabled={!deck.cards.length} onPrimary={() => freeAction(deck)}/>;
    }
    const scheduled = scheduleFor(deck);
    return <DeckCard key={deck.id} summary={summary} badge={badge} metrics={scheduleMetrics(scheduled.summary)}
      primaryLabel={scheduled.cards.length ? 'Ôn ngay →' : 'Đã hoàn thành hôm nay'}
      primaryDisabled={!scheduled.cards.length} onPrimary={() => launchScheduled(deck)}/>;
  }

  if (session) return <StudySession cards={session.cards} deckName={session.name} template={session.template} mode={session.mode} initialIndex={session.initialIndex}
    onPositionChange={session.mode === 'flashcards' ? cardId => setJSON(builtInDeckResumeKey(session.id), cardId) : undefined}
    onComplete={session.mode === 'flashcards' ? () => setJSON(builtInDeckResumeKey(session.id), null) : undefined}
    onExit={() => setSession(null)}/>;

  return <div className="study-page">
    <header className="max-w-2xl">
      <p className="study-eyebrow">{mode === 'free' ? 'HỌC THEO Ý BẠN' : 'LỊCH ÔN HÔM NAY'}</p>
      <h1 className="mt-1 text-3xl font-semibold">{mode === 'free' ? 'Bộ thẻ' : 'Ôn ngắt quãng'}</h1>
      <p className="study-copy mt-3">{mode === 'free'
        ? 'Chọn bộ và bài muốn học. Phiên học tự do không thay đổi lịch ôn.'
        : `Hệ thống tự chọn thẻ đang học, thẻ đến hạn và tối đa ${settings.srsDailyNewLimit.toLocaleString('vi-VN')} thẻ mới mỗi ngày.`}</p>
    </header>

    <ImportedDecks mode={mode} leadingDeck={saved.cards.length ? card(saved, true) : undefined}/>

    <section aria-labelledby="built-in-decks"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="study-eyebrow">THƯ VIỆN</p><h2 id="built-in-decks" className="mt-1 text-xl font-semibold">Bộ có sẵn</h2></div><p className="text-xs text-[var(--color-text-tertiary)]">Nội dung chuẩn · chỉ đọc</p></div>
      <div className="space-y-7">{(['N4', 'N3', 'N2'] as const).map(level => {
        const levelDecks = decks.filter(deck => deck.level === level);
        if (!levelDecks.length) return null;
        return <section key={level} aria-labelledby={`deck-level-${level}`}><div className="mb-3 flex items-center gap-3"><h3 id={`deck-level-${level}`} className="text-sm font-semibold text-[var(--color-text-secondary)]">Trình độ {level}</h3><span className="h-px flex-1 bg-[var(--color-border)]"/></div><DeckGrid>{levelDecks.map(deck => card(deck))}</DeckGrid></section>;
      })}</div>
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
