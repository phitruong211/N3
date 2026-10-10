import { useEffect, useState } from 'react';
import { AppDialog } from '@/components/ui/AppDialog';
import type { LessonOption, StudySetup } from '@/lib/studySetup';
import type { DeckScheduleSummary } from '@/lib/deckSchedule';

type Props = {
  open: boolean;
  deckName: string;
  totalCards: number;
  mode: 'free' | 'scheduled';
  lessons: LessonOption[];
  scheduleSummary?: DeckScheduleSummary;
  defaultMinutes: number;
  onClose: () => void;
  onStart: (setup: StudySetup) => void;
};

export function StudySetupSheet({ open, deckName, totalCards, mode, lessons, scheduleSummary, defaultMinutes, onClose, onStart }: Props) {
  const [limit, setLimit] = useState<10 | 20 | 50 | 'all'>(20);
  const [order, setOrder] = useState<'source' | 'shuffle'>('source');
  const [lesson, setLesson] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [newLimit, setNewLimit] = useState<0 | 10 | 20>(10);
  useEffect(() => { if (open) { setLesson(null); setMinutes(defaultMinutes); setNewLimit(10); } }, [open, mode, defaultMinutes]);
  const counts = [10, 20, 50, 'all'] as const;
  const scheduledCount = (scheduleSummary?.learningCount ?? 0) + (scheduleSummary?.dueCount ?? 0) + Math.min(scheduleSummary?.newCount ?? 0, newLimit);
  return <AppDialog open={open} title={`${mode === 'scheduled' ? 'Ôn ngắt quãng' : 'Học tự do'} · ${deckName}`} onClose={onClose} className="self-end !mb-0 !rounded-b-none sm:self-center sm:!mb-auto sm:!rounded-b-2xl">
    <div className="space-y-5">
      {mode === 'free' ? <>
        <p className="study-copy">Chọn số lượng và thứ tự cho phiên học này. Hoạt động này không thay đổi lịch ôn.</p>
        <fieldset><legend className="mb-2 text-sm font-semibold">Số thẻ</legend><div className="grid grid-cols-4 gap-2">{counts.map(value => <button key={value} disabled={value !== 'all' && value > totalCards} aria-pressed={limit === value} className={`study-button !px-2 ${limit === value ? 'study-button-primary' : ''}`} onClick={() => setLimit(value)}>{value === 'all' ? `Tất cả${totalCards > 200 ? ' (200)' : ''}` : value}</button>)}</div></fieldset>
        <fieldset><legend className="mb-2 text-sm font-semibold">Thứ tự</legend><div className="grid grid-cols-2 gap-2"><button className={`study-button ${order === 'source' ? 'study-button-primary' : ''}`} onClick={() => setOrder('source')}>Theo bộ thẻ</button><button className={`study-button ${order === 'shuffle' ? 'study-button-primary' : ''}`} onClick={() => setOrder('shuffle')}>Xáo trộn</button></div></fieldset>
        {lessons.length > 0 && <label className="block text-sm font-semibold">Bài học<select className="study-input mt-2" value={lesson ?? ''} onChange={event => setLesson(event.target.value || null)}><option value="">Tất cả bài</option>{lessons.map(item => <option key={item.key} value={item.key}>{item.label} · {item.count} thẻ</option>)}</select></label>}
      </> : <>
        <p className="study-copy">Lịch Anki ưu tiên thẻ đang học, sau đó thẻ đến hạn và cuối cùng là thẻ mới.</p>
        <div className="grid grid-cols-3 gap-2" aria-label="Thẻ sẵn sàng ôn">
          <ScheduleMetric label="Mới" value={scheduleSummary?.newCount ?? 0} tone="var(--color-new)"/>
          <ScheduleMetric label="Đang học" value={scheduleSummary?.learningCount ?? 0} tone="var(--color-learning)"/>
          <ScheduleMetric label="Đến hạn" value={scheduleSummary?.dueCount ?? 0} tone="var(--color-review)"/>
        </div>
        <fieldset><legend className="mb-2 text-sm font-semibold">Thêm thẻ mới vào phiên</legend><div className="grid grid-cols-3 gap-2">{([0, 10, 20] as const).map(value => <button key={value} aria-pressed={newLimit === value} className={`study-button ${newLimit === value ? 'study-button-primary' : ''}`} onClick={() => setNewLimit(value)}>{value}</button>)}</div></fieldset>
        <label className="block text-sm font-semibold">Giới hạn thời gian (phút)<input className="study-input mt-2" type="number" min={0} max={180} value={minutes} onChange={event => setMinutes(Math.max(0, Math.min(180, Number(event.target.value) || 0)))}/><span className="mt-1 block text-xs font-normal text-[var(--color-text-tertiary)]">0 là không giới hạn. Lịch ôn quyết định thứ tự.</span></label>
      </>}
      <button disabled={mode === 'scheduled' && scheduledCount === 0} className="study-button study-button-primary w-full" onClick={() => onStart(mode === 'scheduled' ? { mode: 'scheduled', sessionMinutes: minutes, newLimit } : { mode: 'free', limit, order, lessonKey: lesson })}>{mode === 'scheduled' ? `Bắt đầu ôn${scheduledCount ? ` · ${scheduledCount} thẻ` : ''}` : 'Bắt đầu học'}</button>
    </div>
  </AppDialog>;
}

function ScheduleMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-center"><strong className="block text-2xl" style={{ color: tone }}>{value}</strong><span className="text-[.68rem] font-semibold text-[var(--color-text-secondary)]">{label}</span></div>;
}
