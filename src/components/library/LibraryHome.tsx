import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from '@/components/ui/icons';
import { Seal } from '@/components/ui/Seal';
import { PageHeading } from '@/components/ui/StudyUI';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import { KANA_PROGRESS_KEY, KANA_TOTAL, kanaLearned, type KanaProgress } from '@/components/kana/kanaProgress';
import type { DeckType } from '@/types';

type Stage = { to: string; glyph: string; name: string; done?: number; total?: number; tracked?: boolean };

/** Top to bottom is the order to learn in: characters, then words, then how they join, then the writing. */
export function LibraryHome() {
  const { vocabulary, kanji, grammar, srsCards, loading, ensureLibrary } = useApp();
  const storage = useLearningStorage();
  const [kana, setKana] = useState<KanaProgress>({});

  useEffect(ensureLibrary, [ensureLibrary]);
  useEffect(() => setKana(storage.getJSON<KanaProgress>(KANA_PROGRESS_KEY, {})), [storage]);

  const studied = (type: DeckType) => srsCards.filter(card => card.deckType === type && card.state !== 'new').length;
  const stages: Stage[] = [
    { to: '/library/kana', glyph: '仮', name: 'Bảng chữ cái', done: kanaLearned(kana), total: KANA_TOTAL, tracked: true },
    { to: '/library/vocabulary', glyph: '語', name: 'Từ vựng', done: studied('vocabulary'), total: vocabulary.length, tracked: true },
    { to: '/library/grammar', glyph: '文', name: 'Ngữ pháp', done: studied('grammar'), total: grammar.length, tracked: true },
    { to: '/library/kanji', glyph: '漢', name: 'Kanji', done: studied('kanji'), total: kanji.length, tracked: true },
    { to: '/library/listening', glyph: '聴', name: 'Luyện nghe' },
    { to: '/library/exam', glyph: '試', name: 'Đề thi JLPT' },
  ];

  return <div className="study-page">
    <PageHeading title="Thư viện" subtitle="Học lần lượt từ trên xuống." />

    <ol className="relative max-w-2xl">
      {/* One ink thread running behind the seals: the path, drawn once. */}
      <span aria-hidden="true" className="absolute bottom-10 left-[2.125rem] top-10 w-px -translate-x-1/2 bg-[var(--color-border)]" />
      {stages.map(stage => {
        const tracked = Boolean(stage.tracked && stage.total); // totals arrive with the library; until then there is nothing to show
        const started = tracked && stage.done! > 0;
        return <li key={stage.to}>
          <Link to={stage.to} className="relative flex items-center gap-4 rounded-xl px-3 py-4 transition-colors hover:bg-[var(--color-surface-hover)] focus-ring">
            <Seal glyph={stage.glyph} tone={started ? 'var(--color-accent)' : 'var(--color-text-tertiary)'} />
            <span className="min-w-0 flex-1">
              <span className="block text-[1.0625rem] text-[var(--color-text)]">{stage.name}</span>
              {/* An ink underline that grows with what you have covered; nothing is drawn before you start. */}
              {started && <span aria-hidden="true" className="mt-2 block h-0.5 w-full max-w-48">
                <span className="block h-0.5 rounded-full bg-[var(--color-accent)]" style={{ width: `${(stage.done! / stage.total!) * 100}%` }} />
              </span>}
            </span>
            {tracked && <span className="shrink-0 text-sm tabular-nums text-[var(--color-text-secondary)]">
              <b className="text-[var(--color-text)]">{stage.done}</b> / {stage.total}
            </span>}
            {!tracked && stage.tracked && loading && <span className="shrink-0 text-sm text-[var(--color-text-tertiary)]">…</span>}
            <ChevronRight size={18} className="shrink-0 text-[var(--color-text-tertiary)]" />
          </Link>
        </li>;
      })}
    </ol>
  </div>;
}
