import { useState } from 'react';
import { AppDialog } from '@/components/ui/AppDialog';
import type { LessonOption, StudySetup } from '@/lib/studySetup';

type Props = {
  open: boolean;
  deckName: string;
  lessons: LessonOption[];
  onClose: () => void;
  onStart: (setup: StudySetup) => void;
};

export function StudySetupSheet({ open, deckName, lessons, onClose, onStart }: Props) {
  const [lesson, setLesson] = useState<string | null>(null);
  return <AppDialog open={open} title={`Học tự do · ${deckName}`} onClose={onClose} className="self-end !mb-0 !rounded-b-none sm:self-center sm:!mb-auto sm:!rounded-b-2xl">
    <div className="space-y-5">
      <p className="study-copy">Chọn bài để bắt đầu học tự do. Hoạt động này không thay đổi lịch ôn.</p>
      {lessons.length > 0 && <label className="block text-sm font-semibold">Bài học<select className="study-input mt-2" value={lesson ?? ''} onChange={event => setLesson(event.target.value || null)}><option value="">Tất cả bài</option>{lessons.map(item => <option key={item.key} value={item.key}>{item.label} · {item.count} thẻ</option>)}</select></label>}
      <button className="study-button study-button-primary w-full" onClick={() => onStart({ mode: 'free', lessonKey: lesson })}>Bắt đầu học</button>
    </div>
  </AppDialog>;
}
