import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from '@/components/ui/icons';
import { KANA_POOL, buildQuestion, countLearned } from '../kanaProgress';
import { speak } from '../kanaSpeech';
import type { GameProps } from './GameShell';

/** The calm mode: one character, four readings, no clock. */
export function QuizDrill({ script, progress, onRecord, onExit, onReset }: GameProps & { onReset: () => void }) {
  const pool = KANA_POOL[script];
  const learned = countLearned(progress, pool);
  const [question, setQuestion] = useState(() => buildQuestion(pool, progress));
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef(0);
  const latest = useRef(progress);
  latest.current = progress;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const advance = () => {
    window.clearTimeout(timer.current);
    setPicked(null);
    setQuestion(buildQuestion(pool, latest.current, question.ch));
  };

  const answer = (choice: string) => {
    if (picked) return;
    setPicked(choice);
    onRecord(question.ch, choice === question.romaji);
    speak(question.ch);
    if (choice === question.romaji) timer.current = window.setTimeout(advance, 750);
  };

  // No dependency list: every render re-binds the handler, so it never answers a stale question.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (picked) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); } return; }
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < question.choices.length) answer(question.choices[i]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (learned === pool.length) return <section className="study-panel mx-auto w-full max-w-md text-center">
    <p className="font-jp-serif text-6xl leading-none text-[var(--color-seal)]">済</p>
    <p className="mt-4 text-[var(--color-text)]">Thuộc cả {pool.length} chữ {script === 'hira' ? 'Hiragana' : 'Katakana'}.</p>
    <div className="mt-5 flex justify-center gap-3">
      <button className="study-button" onClick={onReset}><RotateCcw size={16} /> Luyện lại từ đầu</button>
      <button className="study-button" onClick={onExit}>Chọn game khác</button>
    </div>
  </section>;

  const right = picked === question.romaji;
  return <section className="mx-auto w-full max-w-md" aria-label="Trắc nghiệm">
    <button className="study-button mb-3 !min-h-9 !px-3 text-sm" onClick={onExit}>‹ Chọn game</button>
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-5 text-center sm:py-7">
      <p className="font-jp-serif text-[3.5rem] leading-none text-[var(--color-text)] sm:text-[4.5rem]">{question.ch}</p>
      <p className="mt-2 h-6 text-base text-[var(--color-text-secondary)] sm:h-7 sm:text-lg">{picked ? question.romaji : ''}</p>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3">
      {question.choices.map(choice => {
        const tone = !picked ? 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
          : choice === question.romaji ? 'border-[var(--color-success)] bg-[var(--color-success-subtle)] text-[var(--color-text)]'
          : choice === picked ? 'border-[var(--color-error)] bg-[var(--color-error-subtle)] text-[var(--color-text)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] opacity-45';
        return <button key={choice} onClick={() => answer(choice)} disabled={Boolean(picked)}
          className={'min-h-14 rounded-xl border text-lg text-[var(--color-text)] transition-colors focus-ring disabled:cursor-default ' + tone}>
          {choice}
        </button>;
      })}
    </div>

    <p role="status" className="sr-only">{picked ? (right ? 'Đúng' : `Sai, đáp án là ${question.romaji}`) : ''}</p>
    <div className="mt-4 min-h-12">
      {picked && !right && <button className="study-button study-button-primary w-full" onClick={advance}>Tiếp tục</button>}
    </div>
  </section>;
}
