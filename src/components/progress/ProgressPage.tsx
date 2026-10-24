// ============================================================
// Progress — figures, review states and a week-by-week ink calendar
// ============================================================

import { useMemo } from 'react';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import { getStateDistribution, formatDate } from '@/lib/srs';
import { EmptyState, PageHeading } from '@/components/ui/StudyUI';
import type { SRSCard } from '@/types';
import './progress.css';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKS = 12;
const count = (value: number) => value.toLocaleString('vi-VN');
const accuracyOf = (card: SRSCard) => card.reps === 0 ? 0 : Math.max(0, card.reps - card.lapses) / card.reps;

export function ProgressPage() {
  const { calculateStreak, getStudyDays } = useLearningStorage();
  const { srsCards, vocabulary, kanji, grammar } = useApp();
  const distribution = useMemo(() => getStateDistribution(srsCards), [srsCards]);
  const streak = calculateStreak();
  const studyDays = getStudyDays();
  const library = vocabulary.length + kanji.length + grammar.length;

  const totalAccuracy = useMemo(() => {
    const total = srsCards.reduce((sum, card) => sum + card.reps, 0);
    const correct = srsCards.reduce((sum, card) => sum + Math.max(0, card.reps - card.lapses), 0);
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }, [srsCards]);

  const states: [string, number, string][] = [
    ['Mới', distribution.new, 'var(--color-new)'], ['Đang học', distribution.learning, 'var(--color-learning)'],
    ['Đang ôn', distribution.review, 'var(--color-review)'], ['Học lại', distribution.relearning, 'var(--color-forgotten)'],
  ];

  return (
    <div className="study-page">
      <PageHeading title="Tiến độ"/>

      <section className="progress-figures rise-group" aria-label="Tổng quan">
        <Figure value={String(streak.current)} unit="ngày" label="Học liên tiếp"/>
        <Figure value={String(totalAccuracy)} unit="%" label="Độ chính xác"/>
        <Figure value={count(srsCards.length)} unit="thẻ" label="Thẻ trong lịch ôn"/>
        <Figure value={count(studyDays.length)} unit="ngày" label="Ngày đã học"/>
      </section>

      <section className="progress-section" aria-labelledby="states-title">
        <h2 id="states-title">Trạng thái ôn tập</h2>
        <ul className="progress-bars">
          {states.map(([label, value, color]) => {
            const percent = library > 0 ? value / library * 100 : 0;
            return <li key={label} className="progress-bar-row" style={{ '--bar': color } as React.CSSProperties}>
              <span>{label}</span>
              <i role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={library} aria-valuenow={value}><b style={{ width: `${percent}%` }}/></i>
              <output>{count(value)}</output>
            </li>;
          })}
        </ul>
        <p className="progress-foot"><span>Chưa bắt đầu: {count(Math.max(0, library - srsCards.length))}</span><span>Tổng mục: {count(library)}</span></p>
      </section>

      <section className="progress-section" aria-labelledby="calendar-title">
        <h2 id="calendar-title">Lịch học {WEEKS} tuần</h2>
        {studyDays.some(day => day.cardsReviewed > 0)
          ? <InkCalendar studyDays={studyDays}/>
          : <EmptyState art="bamboo" title="Chưa có nhịp học nào" detail="Học vài thẻ hôm nay, lịch học sẽ hiện ở đây, mỗi ô một ngày."/>}
      </section>

      <WeakItems srsCards={srsCards} vocabulary={vocabulary}/>
    </div>
  );
}

function Figure({ value, unit, label }: { value: string; unit: string; label: string }) {
  return <div className="progress-figure"><strong>{value}<small>{unit}</small></strong><span className="study-eyebrow">{label}</span></div>;
}

/** Twelve weeks, one column per week (Monday to Sunday): the shape of the habit, not just a count. */
function InkCalendar({ studyDays }: { studyDays: { date: string; cardsReviewed: number }[] }) {
  const { cells, studied, longest } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7);
    const counts = new Map(studyDays.map(day => [day.date, day.cardsReviewed]));
    const label = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
    let run = 0, best = 0, active = 0;
    const result = Array.from({ length: WEEKS * 7 }, (_, index) => {
      const date = new Date(monday); date.setDate(monday.getDate() + index);
      const key = formatDate(date), future = date > today, reviewed = future ? 0 : counts.get(key) ?? 0;
      if (reviewed > 0) { active++; run++; best = Math.max(best, run); } else if (!future) run = 0;
      const level = reviewed >= 40 ? 4 : reviewed >= 20 ? 3 : reviewed >= 10 ? 2 : reviewed > 0 ? 1 : 0;
      return { key, future, today: date.getTime() === today.getTime(), level, reviewed, text: `${label.format(date)}: ${reviewed} thẻ` };
    });
    return { cells: result, studied: active, longest: best };
  }, [studyDays]);

  return <div>
    <div className="ink-calendar" role="img" aria-label={`${WEEKS} tuần gần đây: ${studied} ngày có học, chuỗi dài nhất ${longest} ngày`}>
      <div className="ink-calendar-days" aria-hidden="true">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
      <div className="ink-calendar-grid" aria-hidden="true">
        {cells.map(cell => <div key={cell.key} className="ink-cell" title={cell.future ? undefined : cell.text}
          style={{ '--level': cell.level } as React.CSSProperties} data-future={cell.future || undefined} data-today={cell.today || undefined}/>)}
      </div>
    </div>
    <div className="ink-legend" aria-hidden="true">
      <span>Ít</span>{[0, 1, 2, 3, 4].map(level => <i key={level} className="ink-cell" style={{ '--level': level } as React.CSSProperties}/>)}<span>Nhiều</span>
    </div>
    <ul className="sr-only">{cells.filter(cell => cell.reviewed > 0).map(cell => <li key={cell.key}>{cell.text}</li>)}</ul>
  </div>;
}

function WeakItems({ srsCards, vocabulary }: { srsCards: SRSCard[]; vocabulary: { id: string; kanji: string; hiragana: string; meaning: string }[] }) {
  const weak = useMemo(() => srsCards
    .filter(card => card.reps >= 2 && accuracyOf(card) < 0.6)
    .sort((a, b) => accuracyOf(a) - accuracyOf(b))
    .slice(0, 10)
    .map(card => {
      const vocab = vocabulary.find(item => item.id === card.cardId);
      return { cardId: card.cardId, kanji: vocab?.kanji || card.cardId, meaning: vocab?.meaning || '', accuracy: Math.round(accuracyOf(card) * 100) };
    }), [srsCards, vocabulary]);

  if (weak.length === 0) return null;
  return <section className="progress-section" aria-labelledby="weak-title">
    <h2 id="weak-title">Từ cần luyện thêm</h2>
    <ul className="weak-list">
      {weak.map(item => <li key={item.cardId}>
        <span className="font-jp" lang="ja">{item.kanji}</span>
        <span>{item.meaning}</span>
        <span style={{ color: item.accuracy < 40 ? 'var(--color-error)' : 'var(--color-warning)' }}>{item.accuracy}%</span>
      </li>)}
    </ul>
  </section>;
}
