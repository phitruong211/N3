import { useMemo, type CSSProperties } from 'react';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import { formatDate, getDueCards } from '@/lib/srs';
import { useAuth } from '@/hooks/useAuth';
import { hasLegacyLearningData } from '@/lib/storage';
import { ArrowRight, NavDecks, NavQuiz, NavReview } from '@/components/ui/icons';
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

  return <div className="study-page dashboard-page">
    <InkRidges className="dash-ridges" horizon={0.5} sunPosition={[0.8, 0.72]} birdsEvery={20}>
    <section className="dash-hero" aria-labelledby="today-focus-title">
      <header>
        <p className="study-eyebrow capitalize">{dateLabel}</p>
        <h1 id="today-focus-title" className="dash-greeting">{greeting}{displayName ? `, ${displayName}` : ''}.</h1>
        <p className="dash-motto" lang="ja">{motto.ja}</p>
        <p className="dash-motto-vi">{motto.vi}</p>
      </header>
    </section>
    </InkRidges>

    {draft && <section className="dash-notice" aria-label="Bộ thẻ đang tạo dở">
      <p>Bộ thẻ đang tạo vẫn được lưu.</p>
      <button className="dash-link hit" onClick={() => setCurrentPage('flashcards')}>Tiếp tục <ArrowRight size={14}/></button>
    </section>}

    <div className="dash-row">
      <section className="dash-col" aria-label="Mục tiêu hôm nay">
        <p className="dash-label">Mục tiêu</p>
        <div className="dash-goal">
          <EnsoDial value={goalProgress} complete={goalComplete}/>
          <div>
            <p className="dash-count">{reviewed}<span>/ {settings.dailyGoal}</span></p>
            <p className="dash-sub">thẻ đã ôn hôm nay</p>
          </div>
        </div>
      </section>

      <section className="dash-col" aria-label="Tuần này">
        <p className="dash-label">Tuần này</p>
        <ul className="dash-week">
          {week.map((d, index) => <li key={d.date} className={`dash-day ${d.studied ? 'is-studied' : ''} ${d.isToday ? 'is-today' : ''}`} style={{ '--i': index } as CSSProperties}
            aria-label={`${new Date(`${d.date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long' })}${d.isToday ? ', hôm nay' : ''}: ${d.studied ? 'đã học' : 'chưa học'}`}>
            <span className="dash-stamp" lang="ja" aria-hidden="true">{d.label}</span>
          </li>)}
        </ul>
        <div className="dash-metrics">
          <MiniMetric value={`${streak} ngày`} label="Liên tiếp"/>
          <MiniMetric value={`${Math.round(today?.timeSpent ?? 0)} phút`} label="Hôm nay"/>
          <button onClick={() => setCurrentPage('progress')} className="dash-link hit">Xem tiến độ <ArrowRight size={14}/></button>
        </div>
      </section>
    </div>


    <section aria-labelledby="todo-title">
      <p id="todo-title" className="dash-label">Việc hôm nay</p>
      <div className="dash-todo">
        {[
          { page: 'srs' as const, Icon: NavReview, n: due, title: 'Ôn thẻ đến hạn', sub: due > 0 ? 'thẻ đang chờ' : 'Không còn thẻ nào chờ' },
          { page: 'flashcards' as const, Icon: NavDecks, n: remaining, title: 'Học thêm thẻ mới', sub: remaining > 0 ? 'thẻ để đạt mục tiêu' : 'Đã đạt mục tiêu hôm nay' },
          { page: 'quiz' as const, Icon: NavQuiz, n: 10, title: 'Làm trắc nghiệm', sub: 'câu hỏi kiểm tra nhanh' },
        ].map(({ page, Icon, n, title, sub }) => <button key={page} onClick={() => setCurrentPage(page)} className="dash-tile">
          <Icon size={26} strokeWidth={1.6} aria-hidden="true"/>
          <span className="dash-tile-num">{n}</span>
          <strong>{title}</strong>
          <small>{sub}</small>
        </button>)}
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

function MiniMetric({ value, label }: { value: string; label: string }) {
  return <div className="dash-metric"><strong>{value}</strong><span>{label}</span></div>;
}
