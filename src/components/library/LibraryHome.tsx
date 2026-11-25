import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from '@/components/ui/icons';
import { Seal } from '@/components/ui/Seal';
import { PageHeading } from '@/components/ui/StudyUI';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import { KANA_PROGRESS_KEY, KANA_TOTAL, kanaLearned, type KanaProgress } from '@/components/kana/kanaProgress';
import type { DeckType } from '@/types';

type Stage = { to: string; glyph: string; name: string; about: string; unit?: string; done?: number; total?: number; tracked?: boolean };
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
    { to: '/library/kana', glyph: '仮', name: 'Bảng chữ cái', about: 'Hiragana và Katakana: cách đọc, mẹo nhớ mặt chữ, thứ tự nét viết.', unit: 'chữ', done: kanaLearned(kana), total: KANA_TOTAL, tracked: true },
    { to: '/library/vocabulary', glyph: '語', name: 'Từ vựng', about: 'Từ mới theo cấp độ, kèm cách đọc, Hán Việt và ví dụ.', unit: 'từ', done: studied('vocabulary'), total: vocabulary.length, tracked: true },
    { to: '/library/grammar', glyph: '文', name: 'Ngữ pháp', about: 'Mẫu câu có ví dụ, so sánh và những chỗ dễ nhầm.', unit: 'mẫu câu', done: studied('grammar'), total: grammar.length, tracked: true },
    { to: '/library/kanji', glyph: '漢', name: 'Kanji', about: 'Chữ Hán theo cấp độ: âm on, âm kun và từ ghép thường gặp.', unit: 'chữ', done: studied('kanji'), total: kanji.length, tracked: true },
    { to: '/library/listening', glyph: '聴', name: 'Luyện nghe', about: 'Nghe podcast và bài nghe JLPT, có câu hỏi và giải thích đáp án.' },
    { to: '/library/exam', glyph: '試', name: 'Đề thi JLPT', about: 'Đề thật có đồng hồ đếm ngược, chấm điểm tự động.' },
  ];

  const path = stages.filter(s => s.tracked);
  const practice = stages.filter(s => !s.tracked);
  const current = stages.find(s => statusOf(s) !== 'complete') ?? stages[stages.length - 1];
  const currentStatus = statusOf(current);
  const cta = { new: 'Bắt đầu học', started: 'Học tiếp', loading: 'Mở chặng này', practice: 'Vào luyện tập', complete: 'Ôn lại' }[currentStatus];
  const pct = (s: Stage) => (s.total ? Math.min(100, (s.done! / s.total) * 100) : 0);
  const step = String(stages.indexOf(current) + 1).padStart(2, '0');

  return <div className="study-page">
    <PageHeading title="Thư viện" subtitle="Sáu chặng, đi từ chữ cái đến đề thi thật. Học lần lượt từ trên xuống." />

    {/* The next stop: the one thing to do when you open the library. */}
    <section aria-label="Chặng tiếp theo" className="study-panel relative overflow-hidden shadow-[var(--shadow-sm)]">
      <span key={current.glyph} aria-hidden="true" lang="ja" className="pointer-events-none absolute -bottom-10 right-4 select-none font-jp-serif text-[13rem] leading-none text-[var(--color-gold)] opacity-[.1] sm:right-10">{current.glyph}</span>
      <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <p className="study-eyebrow">Chặng {step} · {currentStatus === 'started' ? 'Đang học' : currentStatus === 'complete' ? 'Đã xong' : 'Tiếp theo'}</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-[2rem] leading-tight tracking-tight text-[var(--color-text)] sm:text-[2.5rem]">{current.name}</h2>
          <p className="study-copy mt-2 max-w-[52ch]">{current.about}</p>
          {current.tracked && current.total ? <div className="mt-5 max-w-md">
            <p className="flex items-baseline justify-between text-sm tabular-nums text-[var(--color-text-secondary)]">
              <span><b className="text-base text-[var(--color-text)]">{current.done}</b> / {current.total} {current.unit} đã học</span>
              <span>{Math.round(pct(current))}%</span>
            </p>
            <Meter value={pct(current)} className="mt-2" />
          </div> : null}
        </div>
        <Link to={current.to} className="study-button study-button-primary w-full md:w-auto">{cta} <ArrowRight size={17} /></Link>
      </div>
    </section>

    <section aria-labelledby="lib-path" className="grid gap-4">
      <h2 id="lib-path" className="study-eyebrow">Lộ trình</h2>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {path.map((stage, i) => {
          const status = statusOf(stage);
          const isCurrent = stage === current;
          const tone = status === 'complete' ? 'var(--color-seal)' : status === 'started' || isCurrent ? 'var(--color-gold)' : 'var(--color-text-tertiary)';
          return <li key={stage.to} className="min-w-0">
            <Link to={stage.to} aria-current={isCurrent ? 'step' : undefined}
              className={`study-panel group flex h-full flex-col gap-4 !p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-ring ${isCurrent ? '!border-[var(--color-gold)]' : 'hover:border-[var(--color-border-strong)]'}`}>
              <span className="flex items-center justify-between">
                <Seal glyph={stage.glyph} tone={tone} className={status === 'complete' ? 'stamp-pop' : ''} />
                <span className="font-[family-name:var(--font-display)] text-sm tabular-nums text-[var(--color-text-tertiary)]">{String(i + 1).padStart(2, '0')}</span>
              </span>
              <span className="flex-1">
                <span className="block text-[1.0625rem] font-medium text-[var(--color-text)]">{stage.name}</span>
                <span className="study-copy mt-1 block !text-sm !leading-relaxed">{stage.about}</span>
              </span>
              <span className="block">
                <span className="flex items-baseline justify-between text-xs tabular-nums text-[var(--color-text-secondary)]">
                  {status === 'complete' ? <span className="text-[var(--color-success)]">Hoàn thành</span>
                    : status === 'loading' ? <span>{loading ? 'Đang tải…' : '—'}</span>
                    : <span><b className="text-sm text-[var(--color-text)]">{stage.done}</b> / {stage.total} {stage.unit}</span>}
                  <ChevronRight size={16} className="text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-0.5" />
                </span>
                <Meter value={pct(stage)} className="mt-2" />
              </span>
            </Link>
          </li>;
        })}
      </ol>
    </section>

    <section aria-labelledby="lib-practice" className="grid gap-4">
      <h2 id="lib-practice" className="study-eyebrow">Luyện tập</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {practice.map(stage => <li key={stage.to} className="min-w-0">
          <Link to={stage.to} aria-current={stage === current ? 'step' : undefined}
            className="study-panel group flex h-full items-center gap-4 !p-5 transition-[border-color,box-shadow] duration-200 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)] focus-ring">
            <Seal glyph={stage.glyph} tone="var(--color-accent)" />
            <span className="min-w-0 flex-1">
              <span className="block text-[1.0625rem] font-medium text-[var(--color-text)]">{stage.name}</span>
              <span className="study-copy mt-0.5 block !text-sm !leading-relaxed">{stage.about}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>)}
      </ul>
    </section>
  </div>;
}

function Meter({ value, className = '' }: { value: number; className?: string }) {
  return <span aria-hidden="true" className={`block h-1 overflow-hidden rounded-full bg-[var(--color-border)] ${className}`}>
    <span className="block h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-700 ease-out" style={{ width: `${value}%` }} />
  </span>;
}
