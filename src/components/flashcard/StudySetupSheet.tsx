import { useEffect, useState } from 'react';
import { AppDialog } from '@/components/ui/AppDialog';
import type { LessonOption } from '@/lib/studySetup';

type Props = {
  open: boolean;
  deckName: string;
  lessons: LessonOption[];
  onClose: () => void;
  onStart: (lessonKey: string | null) => void;
};

export function StudySetupSheet({ open, deckName, lessons, onClose, onStart }: Props) {
  const [lesson, setLesson] = useState<string | null>(null);
  useEffect(() => { if (open) setLesson(null); }, [open]);

  return <AppDialog open={open} title={`Chọn bài · ${deckName}`} onClose={onClose} className="self-end !mb-0 !rounded-b-none sm:self-center sm:!mb-auto sm:!rounded-b-2xl">
    <div className="space-y-5">
      <p className="study-copy">Chọn bài muốn học. Thẻ sẽ hiển thị theo đúng thứ tự trong bộ.</p>
      <label className="block text-sm font-semibold">Bài học
        <select className="study-input mt-2" value={lesson ?? ''} onChange={event => setLesson(event.target.value || null)}>
          <option value="">Tất cả bài</option>
          {lessons.map(item => <option key={item.key} value={item.key}>{item.label} · {item.count} thẻ</option>)}
        </select>
      </label>
      <button className="study-button study-button-primary w-full" onClick={() => onStart(lesson)}>Bắt đầu học</button>
    </div>
  </AppDialog>;
}
