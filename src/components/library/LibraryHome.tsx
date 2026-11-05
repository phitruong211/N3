import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from '@/components/ui/icons';
import { INK, type InkName } from '@/components/ui/ink';
import { Seal } from '@/components/ui/Seal';
import { PageHeading } from '@/components/ui/StudyUI';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import { KANA_PROGRESS_KEY, KANA_TOTAL, kanaLearned, type KanaProgress } from '@/components/kana/kanaProgress';
import type { DeckType } from '@/types';

type Stage = { to: string; glyph: string; name: string; about: string; art: InkName; unit?: string; done?: number; total?: number; tracked?: boolean };
type Status = 'loading' | 'new' | 'started' | 'complete' | 'practice';

const statusOf = (s: Stage): Status => {
  if (!s.tracked) return 'practice';
  if (!s.total) return 'loading'; // totals arrive with the library; until then there is nothing to show
  return s.done! >= s.total ? 'complete' : s.done! > 0 ? 'started' : 'new';
};

/** Top to bottom is the order to learn in: characters, then words, then how they join, then the writing. */
export function LibraryHome() {
  const { vocabulary, kanji, grammar, srsCards, loading, ensureLibrary } = useApp();
  const storage = useLearningStorage();
  const [kana, setKana] = useState<KanaProgress>({});

  useEffect(ensureLibrary, [ensureLibrary]);
  useEffect(() => setKana(storage.getJSON<KanaProgress>(KANA_PROGRESS_KEY, {})), [storage]);

  const studied = (type: DeckType) => srsCards.filter(card => card.deckType === type && card.state !== 'new').length;
  const stages: Stage[] = [
    { to: '/library/kana', glyph: '仮', name: 'Bảng chữ cái', about: 'Hiragana và Katakana: cách đọc, mẹo nhớ mặt chữ, thứ tự nét viết.', art: 'enso', unit: 'chữ', done: kanaLearned(kana), total: KANA_TOTAL, tracked: true },
    { to: '/library/vocabulary', glyph: '語', name: 'Từ vựng', about: 'Từ mới theo cấp độ, kèm cách đọc, Hán Việt và ví dụ.', art: 'notebook', unit: 'từ', done: studied('vocabulary'), total: vocabulary.length, tracked: true },
    { to: '/library/grammar', glyph: '文', name: 'Ngữ pháp', about: 'Mẫu câu có ví dụ, so sánh và những chỗ dễ nhầm.', art: 'bamboo', unit: 'mẫu câu', done: studied('grammar'), total: grammar.length, tracked: true },
    { to: '/library/kanji', glyph: '漢', name: 'Kanji', about: 'Chữ Hán theo cấp độ: âm on, âm kun và từ ghép thường gặp.', art: 'inkstone', unit: 'chữ', done: studied('kanji'), total: kanji.length, tracked: true },
    { to: '/library/listening', glyph: '聴', name: 'Luyện nghe', about: 'Nghe podcast và bài nghe JLPT, có câu hỏi và giải thích đáp án.', art: 'wave' },
    { to: '/library/exam', glyph: '試', name: 'Đề thi JLPT', about: 'Đề thật có đồng hồ đếm ngược, chấm điểm tự động.', art: 'crane' },
  ];

  const current = stages.find(s => statusOf(s) !== 'complete') ?? stages[stages.length - 1];
  const currentStatus = statusOf(current);
  const Art = INK[current.art];
  const cta = { new: 'Bắt đầu học', started: 'Học tiếp', loading: 'Mở chặng này', practice: 'Vào luyện tập', complete: 'Ôn lại' }[currentStatus];

  return <div className="study-page">
    <PageHeading title="Thư viện" subtitle="Sáu chặng, đi từ chữ cái đến đề thi thật. Học lần lượt từ trên xuống." />

    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-12">
      {/* The next stop stays beside the path; on a phone it comes first. */}
      <aside aria-label="Chặng tiếp theo" className="relative order-1 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-md)] lg:order-2 lg:sticky lg:top-20">
        <Art key={current.art} size={104} className="absolute right-4 top-4 text-[var(--color-text-secondary)]" />
        <h2 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-[var(--color-text)]">{current.name}</h2>
        <p className="study-copy mt-3 max-w-[30ch]">{current.about}</p>
        {currentStatus !== 'practice' && currentStatus !== 'loading' && <div className="mt-5">
          <p className="text-sm tabular-nums text-[var(--color-text-secondary)]">
            <b className="text-[var(--color-text)]">{current.done}</b> / {current.total} {current.unit} đã học
          </p>
          <span aria-hidden="true" className="mt-2 block h-0.5 rounded-full bg-[var(--color-border)]">
            <span className="block h-0.5 rounded-full bg-[var(--color-accent)]" style={{ width: `${(current.done! / current.total!) * 100}%` }} />
          </span>
        </div>}
        <Link to={current.to} className="study-button study-button-primary mt-6 w-full sm:w-auto">{cta} <ArrowRight size={17} /></Link>
      </aside>

      <ol className="order-2 max-w-2xl lg:order-1">
        {stages.map((stage, i) => {
          const status = statusOf(stage);
          const isCurrent = stage === current;
          const tone = status === 'complete' ? 'var(--color-seal)' : status === 'started' ? 'var(--color-accent)' : 'var(--color-text-tertiary)';
          const fill = status === 'complete' ? 100 : status === 'started' ? (stage.done! / stage.total!) * 100 : 0;
          return <li key={stage.to} className="relative">
            <Link to={stage.to} aria-current={isCurrent ? 'step' : undefined}
              className={`relative flex items-start gap-4 rounded-xl px-3 py-4 transition-colors focus-ring ${isCurrent ? 'bg-[var(--color-surface-alt)]' : 'hover:bg-[var(--color-surface-hover)]'}`}>
              <Seal glyph={stage.glyph} tone={tone} className={status === 'complete' ? 'stamp-pop' : ''} />
              <span className="min-w-0 flex-1">
                <span className="block text-[1.0625rem] leading-[44px] text-[var(--color-text)]">{stage.name}</span>
                <span className="study-copy -mt-1 block max-w-[52ch] !text-sm !leading-relaxed">{stage.about}</span>
              </span>
              <span className="flex h-11 shrink-0 items-center gap-2 text-sm tabular-nums text-[var(--color-text-secondary)]">
                {status === 'complete' && <span className="text-[var(--color-success)]">Hoàn thành</span>}
                {(status === 'started' || status === 'new') && <span><b className="text-[var(--color-text)]">{stage.done}</b> / {stage.total}</span>}
                {status === 'loading' && loading && <span className="text-[var(--color-text-tertiary)]">…</span>}
                {status === 'practice' && <span>Luyện tập</span>}
                <ChevronRight size={18} className="text-[var(--color-text-tertiary)]" />
              </span>
            </Link>
            {/* The path between two seals fills with ink as far as you have come in the stage above it. */}
            {i < stages.length - 1 && <span aria-hidden="true" className="pointer-events-none absolute bottom-[-1rem] left-[2.125rem] top-[3.75rem] w-0.5 -translate-x-1/2 bg-[var(--color-border)]">
              <span className="library-thread absolute inset-x-0 top-0 bg-[var(--color-accent)]" style={{ height: `${fill}%`, '--i': i } as React.CSSProperties} />
            </span>}
          </li>;
        })}
      </ol>
    </div>
  </div>;
}
