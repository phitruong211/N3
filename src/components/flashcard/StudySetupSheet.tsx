import { useEffect, useState } from 'react';
import { AppDialog } from '@/components/ui/AppDialog';
import type { LessonOption, StudySetup } from '@/lib/studySetup';

type Props = {
  open: boolean;
  deckName: string;
  totalCards: number;
  canSchedule: boolean;
  lessons: LessonOption[];
  defaultMode: 'free' | 'scheduled';
  defaultMinutes: number;
  onClose: () => void;
  onStart: (setup: StudySetup) => void;
};

export function StudySetupSheet({ open, deckName, totalCards, canSchedule, lessons, defaultMode, defaultMinutes, onClose, onStart }: Props) {
  const [mode, setMode] = useState<'free' | 'scheduled'>(defaultMode);
  const [limit, setLimit] = useState<10 | 20 | 50 | 'all'>(20);
  const [order, setOrder] = useState<'source' | 'shuffle'>('source');
  const [lesson, setLesson] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(defaultMinutes);
  useEffect(() => { if (open) { setMode(defaultMode); setLesson(null); setMinutes(defaultMinutes); } }, [open, defaultMode, defaultMinutes]);
  const counts = [10, 20, 50, 'all'] as const;
  return <AppDialog open={open} title={`Chuẩn bị học · ${deckName}`} onClose={onClose} className="self-end !mb-0 !rounded-b-none sm:self-center sm:!mb-auto sm:!rounded-b-2xl">
    <div className="space-y-5">
      {canSchedule && <fieldset><legend className="mb-2 text-sm font-semibold">Cách học</legend><div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--color-surface-alt)] p-1">
        <button className={`study-button !border-0 ${mode === 'free' ? 'bg-[var(--color-surface)] shadow-sm' : ''}`} onClick={() => setMode('free')}>Học tự do</button>
        <button className={`study-button !border-0 ${mode === 'scheduled' ? 'bg-[var(--color-surface)] shadow-sm' : ''}`} onClick={() => setMode('scheduled')}>Ôn theo lịch</button>
      </div></fieldset>}
      {mode === 'free' ? <>
        <fieldset><legend className="mb-2 text-sm font-semibold">Số thẻ</legend><div className="grid grid-cols-4 gap-2">{counts.map(value => <button key={value} disabled={value !== 'all' && value > totalCards} aria-pressed={limit === value} className={`study-button !px-2 ${limit === value ? 'study-button-primary' : ''}`} onClick={() => setLimit(value)}>{value === 'all' ? `Tất cả${totalCards > 200 ? ' (200)' : ''}` : value}</button>)}</div></fieldset>
        <fieldset><legend className="mb-2 text-sm font-semibold">Thứ tự</legend><div className="grid grid-cols-2 gap-2"><button className={`study-button ${order === 'source' ? 'study-button-primary' : ''}`} onClick={() => setOrder('source')}>Theo bộ thẻ</button><button className={`study-button ${order === 'shuffle' ? 'study-button-primary' : ''}`} onClick={() => setOrder('shuffle')}>Xáo trộn</button></div></fieldset>
        {lessons.length > 0 && <label className="block text-sm font-semibold">Bài học<select className="study-input mt-2" value={lesson ?? ''} onChange={event => setLesson(event.target.value || null)}><option value="">Tất cả bài</option>{lessons.map(item => <option key={item.key} value={item.key}>{item.label} · {item.count} thẻ</option>)}</select></label>}
      </> : <label className="block text-sm font-semibold">Giới hạn thời gian (phút)<input className="study-input mt-2" type="number" min={0} max={180} value={minutes} onChange={event => setMinutes(Math.max(0, Math.min(180, Number(event.target.value) || 0)))}/><span className="mt-1 block text-xs font-normal text-[var(--color-text-tertiary)]">0 là không giới hạn. Thứ tự do lịch ôn quyết định.</span></label>}
      <button className="study-button study-button-primary w-full" onClick={() => onStart(mode === 'scheduled' ? { mode: 'scheduled', sessionMinutes: minutes } : { mode: 'free', limit, order, lessonKey: lesson })}>Bắt đầu học</button>
    </div>
  </AppDialog>;
}
