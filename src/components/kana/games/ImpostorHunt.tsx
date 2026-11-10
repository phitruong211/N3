import { useReducer, useRef, useState } from 'react';
import { ROMAJI } from '../kanaProgress';
import { sayKana } from '../kanaSpeech';
import { impostorRound } from './gameLogic';
import { Board, Countdown, GameOver, Hud, PausedOverlay, SHAKE, readBest, saveBest, useGameLoop, usePhase, type GameProps } from './GameShell';

const LIVES = 3;
const WRONG_PENALTY = 1.5;

export function ImpostorHunt(props: GameProps) {
  const phase = usePhase();
  return <HuntRound key={phase.round} {...props} {...phase} />;
}

function HuntRound({ script, storage, onRecord, onExit, phase, setPhase, restart }: GameProps & ReturnType<typeof usePhase>) {
  const first = useRef(impostorRound(script, 1));
  const world = useRef({ level: 1, round: first.current, left: first.current.seconds, lives: LIVES, score: 0, missed: [] as string[], wrong: new Set<number>(), slipped: false, reveal: null as null | { found: boolean; gain: number; t: number } });
  const [, render] = useReducer((n: number) => n + 1, 0);
  const [best] = useState(() => readBest(storage, 'impostor', script));
  const w = world.current;
  const r = w.round;

  const next = () => {
    w.round = impostorRound(script, w.level);
    w.left = w.round.seconds;
    w.wrong = new Set();
    w.slipped = false;
    w.reveal = null;
  };

  useGameLoop(dt => {
    if (w.reveal) {
      w.reveal.t -= dt;
      if (w.reveal.t <= 0) {
        if (w.lives <= 0) { saveBest(storage, 'impostor', script, w.score); setPhase('over'); } else next();
      }
    } else {
      w.left -= dt;
      if (w.left <= 0) {
        w.left = 0;
        w.lives -= 1;
        if (!w.slipped) onRecord(r.target, false);
        if (!w.missed.includes(r.target)) w.missed.push(r.target);
        w.reveal = { found: false, gain: 0, t: 2 };
      }
    }
    render();
  }, phase === 'play');

  const pick = (i: number, el: HTMLElement) => {
    if (phase !== 'play' || w.reveal) return;
    if (i === r.index) {
      const gain = Math.round(w.left * 10) + w.level * 5;
      w.score += gain;
      onRecord(r.target, !w.slipped);
      w.level += 1;
      w.reveal = { found: true, gain, t: 0.75 };
      sayKana(r.target);
    } else if (!w.wrong.has(i)) {
      w.wrong.add(i);
      w.left = Math.max(0, w.left - WRONG_PENALTY);
      if (!w.slipped) { w.slipped = true; onRecord(r.target, false); }
      el.animate(SHAKE, 300);
    }
    render();
  };

  const shown = w.reveal !== null;
  return <section aria-label="Tìm kẻ mạo danh">
    <Hud score={w.score} level={w.level} lives={w.lives} phase={phase} onExit={onExit} onPause={() => setPhase(phase === 'paused' ? 'play' : 'paused')} />

    <Board className="flex flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--color-border)] px-4 py-3">
        <p className="text-sm text-[var(--color-text-secondary)]">Tìm chữ</p>
        <p className="font-jp-serif text-4xl leading-none text-[var(--color-seal)]">{r.target}</p>
        <p className="text-sm text-[var(--color-text-tertiary)]">giữa các chữ <span className="font-jp-serif text-lg text-[var(--color-text)]">{r.base}</span></p>
        <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-border)] sm:w-40" role="timer" aria-label={`Còn ${Math.ceil(w.left)} giây`}>
          <div className={'h-full rounded-full ' + (w.left / r.seconds < 0.3 ? 'bg-[var(--color-seal)]' : 'bg-[var(--color-accent)]')} style={{ width: `${(w.left / r.seconds) * 100}%` }} />
        </div>
      </div>

      <div className="min-h-0 flex-1 p-3 sm:p-4" style={{ containerType: 'size' }}>
        <div className="mx-auto grid aspect-square h-full max-w-full gap-[1.2cqmin]" style={{ gridTemplateColumns: `repeat(${r.size}, minmax(0, 1fr))`, width: '100cqmin', height: '100cqmin' }}
          role="grid" aria-label={`Lưới ${r.size} × ${r.size}`}>
          {Array.from({ length: r.size * r.size }, (_, i) => {
            const target = i === r.index;
            const wrong = w.wrong.has(i);
            const tone = shown && target ? (w.reveal!.found ? 'stamp-pop border-[var(--color-success)] bg-[var(--color-success-subtle)]' : 'stamp-pop border-[var(--color-seal)] bg-[var(--color-error-subtle)]')
              : wrong ? 'border-[var(--color-error)] bg-[var(--color-error-subtle)] opacity-60'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]';
            return <button key={`${r.base}${r.target}${r.index}-${i}`} onClick={e => pick(i, e.currentTarget)} aria-label={`Ô ${i + 1}`}
              className={'grid place-items-center rounded-[1.4cqmin] border font-jp-serif leading-none text-[var(--color-text)] transition-colors focus-ring ' + tone}
              style={{ fontSize: `${58 / r.size}cqmin` }}>
              {target ? r.target : r.base}
            </button>;
          })}
        </div>
      </div>

      <p role="status" className={'absolute inset-x-0 bottom-0 z-10 px-4 py-2.5 text-center text-sm transition-opacity ' + (shown ? 'opacity-100' : 'opacity-0') + (w.reveal?.found ? ' bg-[var(--color-success-subtle)] text-[var(--color-success)]' : ' bg-[var(--color-error-subtle)] text-[var(--color-text)]')}>
        {w.reveal && (w.reveal.found
          ? <b>Đúng rồi! +{w.reveal.gain}</b>
          : <>Hết giờ — <b className="font-jp-serif text-base">{r.target}</b> đọc là “{ROMAJI[r.target]}”, còn <b className="font-jp-serif text-base">{r.base}</b> đọc là “{ROMAJI[r.base]}”.</>)}
      </p>

      {phase === 'countdown' && <Countdown onDone={() => setPhase('play')} hint={<>Mỗi lưới giấu đúng một chữ khác. Bấm sai bị trừ {WRONG_PENALTY} giây; hết giờ mất một mạng.</>} />}
      {phase === 'paused' && <PausedOverlay onResume={() => setPhase('play')} onExit={onExit} />}
      {phase === 'over' && <GameOver score={w.score} best={best} missed={w.missed} onRetry={restart} onExit={onExit} />}
    </Board>
  </section>;
}
