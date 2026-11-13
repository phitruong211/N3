import { useMemo, type CSSProperties } from 'react';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import { formatDate, getDueCards } from '@/lib/srs';
import { useAuth } from '@/hooks/useAuth';
import { hasLegacyLearningData } from '@/lib/storage';
import { ArrowRight } from '@/components/ui/icons';
import InkRidges from '@/components/ui/ink-ridges';
import { daypart, weekStamps } from './todayData';
import './dashboard.css';

const MOTTOS = [
  { ja: '一歩ずつ、前へ。', vi: 'Từng bước một, tiến lên.' },
  { ja: '継続は力なり。', vi: 'Kiên trì chính là sức mạnh.' },
  { ja: '千里の道も一歩から。', vi: 'Đường ngàn dặm bắt đầu từ một bước.' },
  { ja: '七転び八起き。', vi: 'Ngã bảy lần, đứng dậy tám lần.' },
  { ja: '焦らず、休まず。', vi: 'Đừng vội, cũng đừng dừng.' },
  { ja: '今日の努力が、明日の力。', vi: 'Nỗ lực hôm nay là sức mạnh ngày mai.' },
  { ja: '好きこそ物の上手なれ。', vi: 'Có yêu thích mới giỏi.' },
];

export function Dashboard() {
  const { getStudyDays, calculateStreak } = useLearningStorage();
  const { srsCards, setCurrentPage, settings } = useApp();
  const { draft, user } = useAuth();
  const now = new Date();
  const todayKey = formatDate(now);
  const studyDays = useMemo(() => getStudyDays(), [getStudyDays]);
  const today = studyDays.find(day => day.date === todayKey);
  const day = useMemo(() => new Date(`${todayKey}T00:00:00`), [todayKey]);
  const week = useMemo(() => weekStamps(studyDays, day), [studyDays, day]);
  const legacyDataPresent = useMemo(() => hasLegacyLearningData(), []);
  const streak = calculateStreak().current;
  const due = useMemo(() => getDueCards(srsCards).length, [srsCards]);
  const reviewed = today?.cardsReviewed ?? 0;
  const goalProgress = settings.dailyGoal > 0 ? Math.min(100, Math.round(reviewed / settings.dailyGoal * 100)) : 0;
  const remaining = Math.max(0, settings.dailyGoal - reviewed);
  const goalComplete = settings.dailyGoal > 0 && reviewed >= settings.dailyGoal;
  const displayName = user?.displayName?.trim().split(/\s+/)[0];
  const { greeting } = daypart(now.getHours());
  const motto = MOTTOS[Math.floor(now.getTime() / 864e5) % MOTTOS.length];
  const dateLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  // What a spaced-repetition day holds, in order: due reviews, the rest of the daily goal (it counts every card studied), a quick check.
  // The first is the one button; the others are quiet links beside it, so nothing is said twice.
  const steps = [
    ...(due > 0 ? [{ page: 'srs' as const, label: `Ôn ${due} thẻ đến hạn` }] : []),
    ...(remaining > 0 ? [{ page: 'flashcards' as const, label: `Học thêm ${remaining} thẻ` }] : []),
    { page: 'quiz' as const, label: 'Trắc nghiệm nhanh' },
  ];
  const [next, ...later] = steps;

  return <div className="study-page dashboard-page">
    <InkRidges className="dash-ridges" horizon={0.34} sunPosition={[0.8, 0.72]} birdsEvery={20}>
    <section className="dash-hero" aria-labelledby="today-focus-title">
      <header>
        <p className="study-eyebrow capitalize">{dateLabel}</p>
        <h1 id="today-focus-title" className="dash-greeting">{greeting}{displayName ? `, ${displayName}` : ''}.</h1>
        <p className="dash-motto" lang="ja">{motto.ja}</p>
        <p className="dash-motto-vi">{motto.vi}</p>
      </header>
    </section>
    </InkRidges>

    {/* Under the picture, not on it: the art stays clean and the button is the first thing after it. */}
    <div className="dash-next">
      <button className="study-button study-button-primary dash-cta" onClick={() => setCurrentPage(next.page)}>{next.label} <ArrowRight size={16}/></button>
      {later.length > 0 && <p className="dash-then">rồi {later.map((step, index) => <span key={step.page}>{index > 0 && ' · '}
        <button className="dash-link hit" onClick={() => setCurrentPage(step.page)}>{step.label.toLowerCase()}</button></span>)}</p>}
    </div>

    {draft && <section className="dash-notice" aria-label="Bộ thẻ đang tạo dở">
      <p>Bộ thẻ đang tạo vẫn được lưu.</p>
      <button className="dash-link hit" onClick={() => setCurrentPage('flashcards')}>Tiếp tục <ArrowRight size={14}/></button>
    </section>}

    {/* One band: today's goal, the week in stamps, the streak. Everything else lives on the progress page. */}
    <section className="dash-band" aria-label="Mục tiêu và tuần này">
      <div className="dash-goal">
        <EnsoDial value={goalProgress} complete={goalComplete}/>
        <div>
          <p className="dash-count">{reviewed}<span>/ {settings.dailyGoal}</span></p>
          <p className="dash-sub">thẻ hôm nay</p>
        </div>
      </div>
      <ul className="dash-week">
        {week.map((d, index) => <li key={d.date} className={`dash-day ${d.studied ? 'is-studied' : ''} ${d.isToday ? 'is-today' : ''}`} style={{ '--i': index } as CSSProperties}
          aria-label={`${new Date(`${d.date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long' })}${d.isToday ? ', hôm nay' : ''}: ${d.studied ? 'đã học' : 'chưa học'}`}>
          <span className="dash-stamp" lang="ja" aria-hidden="true">{d.label}</span>
        </li>)}
      </ul>
      <div className="dash-streak">
        <p>{streak > 0 ? `Chuỗi ${streak} ngày` : 'Chưa có chuỗi ngày'}</p>
        <button onClick={() => setCurrentPage('progress')} className="dash-link hit">Xem tiến độ <ArrowRight size={14}/></button>
      </div>
    </section>

    {legacyDataPresent && <section className="dash-notice" role="note">
      <p><strong>Dữ liệu cũ vẫn an toàn.</strong></p>
      <button className="dash-link hit" onClick={() => setCurrentPage('settings')}>Kiểm tra <ArrowRight size={14}/></button>
    </section>}
  </div>;
}

/** A thin ink circle left open like an ensō, drawn to the goal percentage. */
function EnsoDial({ value, complete }: { value: number; complete: boolean }) {
  return <div className={`dash-enso ${complete ? 'is-complete' : ''}`} role="img" aria-label={`Đã hoàn thành ${value}% mục tiêu`}>
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle className="track" cx="50" cy="50" r="42" pathLength="100" strokeDasharray="94 100"/>
      <circle className="ink" cx="50" cy="50" r="42" pathLength="100" style={{ strokeDasharray: `${(value * .94).toFixed(1)} 100`, opacity: value > 0 ? 1 : 0 }}/>
    </svg>
    <strong aria-hidden="true">{value}%</strong>
  </div>;
}
