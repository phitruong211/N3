import { useEffect, useReducer, useRef, useState } from 'react';
import { Volume2 } from '@/components/ui/icons';
import { ROMAJI } from '../kanaProgress';
import { speak } from '../kanaSpeech';
import { gateRow, toriiLevel } from './gameLogic';
import { Board, Countdown, GameOver, Hud, PausedOverlay, SHAKE, readBest, saveBest, useGameLoop, useGameMusic, usePhase, type GameProps } from './GameShell';

type Row = { id: number; gates: string[]; lane: number; y: number; result: null | 'hit' | 'miss' };

const LIVES = 3;
const RUNNER_Y = 0.8;
/** A row is only asked about once its gates are fully on the board; before that the prompt waits. */
const PROMPT_Y = 0.3;
const laneX = (lane: number) => `${(lane + 0.5) * (100 / 3)}%`;

export function ToriiRun(props: GameProps & { listen: boolean }) {
  const phase = usePhase();
  return <RunRound key={phase.round} {...props} {...phase} />;
}

export function Torii({ ch, state }: { ch: string; state: 'idle' | 'hit' | 'miss' | 'answer' }) {
  const plaque = state === 'hit' ? 'border-[var(--color-success)] bg-[var(--color-success-subtle)]'
    : state === 'answer' ? 'border-[var(--color-seal)] bg-[var(--color-warning-subtle)]'
    : state === 'miss' ? 'border-[var(--color-border-strong)] bg-[var(--color-surface)] opacity-50'
    : 'border-[var(--color-text)] bg-[var(--color-surface)]';
  return <div style={{ containerType: 'inline-size' }} className={'relative w-full ' + (state === 'hit' || state === 'answer' ? 'stamp-pop' : '')}>
    <svg viewBox="0 0 100 78" className="block w-full drop-shadow-[0_4px_4px_rgb(0_0_0/.12)]" aria-hidden="true">
      <path d="M2 13 Q50 3 98 13 L96 20 Q50 11 4 20 Z" fill="var(--color-text)" />
      <path d="M7 19 Q50 11 93 19 L92 24 Q50 17 8 24 Z" fill="var(--color-seal)" />
      <rect x="11" y="32" width="78" height="6" rx="1" fill="var(--color-seal)" />
      <rect x="19" y="23" width="8" height="55" rx="1.5" fill="var(--color-seal)" />
      <rect x="73" y="23" width="8" height="55" rx="1.5" fill="var(--color-seal)" />
      <rect x="17" y="72" width="12" height="6" rx="1" fill="var(--color-text)" />
      <rect x="71" y="72" width="12" height="6" rx="1" fill="var(--color-text)" />
    </svg>
    <span className={'absolute left-1/2 top-[18%] grid aspect-square w-[34%] -translate-x-1/2 place-items-center rounded-md border-2 font-jp-serif text-[24cqw] leading-none text-[var(--color-text)] transition-colors ' + plaque}>{ch}</span>
  </div>;
}

function Runner() {
  return <svg viewBox="0 0 40 52" className="torii-runner w-14 drop-shadow-[0_6px_5px_rgb(0_0_0/.18)]" aria-hidden="true">
    <ellipse cx="20" cy="50" rx="11" ry="2" fill="var(--color-text)" opacity=".18" />
    <path className="torii-leg-a" d="M16 36 L13 48" stroke="var(--color-text)" strokeWidth="4" strokeLinecap="round" />
    <path className="torii-leg-b" d="M24 36 L27 48" stroke="var(--color-text)" strokeWidth="4" strokeLinecap="round" />
    <rect x="10" y="20" width="20" height="19" rx="8" fill="var(--color-accent)" />
    <circle cx="20" cy="13" r="10" fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth="2.4" />
    <path d="M10.5 10 Q20 6 29.5 10" stroke="var(--color-seal)" strokeWidth="3.4" fill="none" strokeLinecap="round" />
    <path d="M29 9.5 l6 -3 M29 10.5 l6 2" stroke="var(--color-seal)" strokeWidth="2.2" strokeLinecap="round" />
  </svg>;
}

function RunRound({ script, progress, storage, onRecord, onExit, listen, phase, setPhase, restart }: GameProps & { listen: boolean } & ReturnType<typeof usePhase>) {
  const world = useRef({ rows: [] as Row[], lane: 1, passed: 0, score: 0, combo: 0, lives: LIVES, missed: [] as string[], dist: 0, nextId: 1, last: '', note: null as null | { text: string; t: number } });
  const [, render] = useReducer((n: number) => n + 1, 0);
  const [best] = useState(() => readBest(storage, 'torii', script));
  const board = useRef<HTMLDivElement>(null);
  const latest = useRef(progress);
  latest.current = progress;
  const spoken = useRef(0);
  const w = world.current;
  const { level, speed } = toriiLevel(w.passed);
  const music = useGameMusic(phase, level);
  const next = w.rows.find(r => !r.result);
  const active = next && next.y >= PROMPT_Y ? next : undefined;
  const answer = active ? active.gates[active.lane] : '';

  const move = (lane: number) => { if (phase === 'play') { w.lane = Math.max(0, Math.min(2, lane)); render(); } };

  useGameLoop(dt => {
    w.dist += speed * dt;
    for (const row of w.rows) {
      row.y += speed * dt;
      if (row.result || row.y < RUNNER_Y) continue;
      const ch = row.gates[row.lane];
      if (w.lane === row.lane) {
        row.result = 'hit';
        w.passed += 1;
        w.combo += 1;
        w.score += 10 * level + Math.min(w.combo, 10) * 2;
        onRecord(ch, true);
        if (!listen) speak(ch);
      } else {
        row.result = 'miss';
        w.lives -= 1;
        w.combo = 0;
        onRecord(ch, false);
        if (!w.missed.includes(ch)) w.missed.push(ch);
        w.note = { text: `${ch} đọc là “${ROMAJI[ch]}”`, t: 1.6 };
        board.current?.animate(SHAKE, 320);
      }
    }
    w.rows = w.rows.filter(r => r.y < 1.3);
    if (!w.rows.some(r => r.y < 0.42)) {
      const row = gateRow(script, latest.current, w.last);
      w.rows.push({ id: w.nextId++, ...row, y: -0.22, result: null });
      w.last = row.gates[row.lane];
    }
    if (w.note) { w.note.t -= dt; if (w.note.t <= 0) w.note = null; }
    if (w.lives <= 0 && phase === 'play') { saveBest(storage, 'torii', script, w.score); setPhase('over'); }
    render();
  }, phase === 'play');

  // Listening mode says each new question once; Space repeats it.
  useEffect(() => {
    if (!listen || !active || phase !== 'play' || spoken.current === active.id) return;
    spoken.current = active.id;
    speak(answer);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); move(w.lane - 1); }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); move(w.lane + 1); }
      else if (['1', '2', '3'].includes(e.key)) move(Number(e.key) - 1);
      else if (e.key === ' ' && listen && answer) { e.preventDefault(); speak(answer); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const scroll = `${(w.dist * (board.current?.clientHeight ?? 500))}px`;
  return <section aria-label="Chạy qua cổng torii">
    <Hud score={w.score} level={level} lives={w.lives} phase={phase} onExit={onExit} music={music} onPause={() => setPhase(phase === 'paused' ? 'play' : 'paused')}>
      {w.combo >= 3 && <span key={w.combo} className="stamp-pop font-semibold text-[var(--color-seal)]">×{w.combo}</span>}
    </Hud>

    <div className="mb-3 flex justify-center">
        <div className="flex min-h-14 min-w-40 items-center justify-center gap-3 rounded-xl border-2 border-[var(--color-text)] bg-[var(--color-surface)] px-5 shadow-[0_4px_0_var(--color-text)]" aria-live="polite">
          {listen
            ? <button className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]" onPointerDown={e => e.stopPropagation()} onClick={() => answer && speak(answer)}>
              <Volume2 size={22} /> Nghe lại <kbd className="kbd-shortcut">Space</kbd>
            </button>
            : <span className="text-3xl font-semibold tracking-wide text-[var(--color-text)]">{active ? ROMAJI[answer] : '…'}</span>}
        </div>
    </div>

    <Board ref={board} className="torii-path" style={{ '--scroll': scroll } as React.CSSProperties}
      onPointerDown={e => { const box = e.currentTarget.getBoundingClientRect(); move(Math.floor(((e.clientX - box.left) / box.width) * 3)); }}>

      {w.rows.map(row => <div key={row.id} className="absolute inset-x-0" style={{ top: `calc(${row.y} * 100% - 7rem)` }}>
        {row.gates.map((ch, lane) => {
          const state = row.result === 'hit' && lane === row.lane ? 'hit' : row.result === 'miss' ? (lane === row.lane ? 'answer' : 'miss') : 'idle';
          // Once a row is behind the runner only its feedback gate stays bright, so nobody reads it as the next question.
          const faded = row.result && state !== 'hit' && state !== 'answer';
          return <div key={lane} className={'absolute w-[28%] max-w-52 -translate-x-1/2 transition-opacity duration-300 ' + (faded ? 'opacity-25' : '')} style={{ left: laneX(lane) }}><Torii ch={ch} state={state} /></div>;
        })}
      </div>)}

      <div className="absolute z-[5] -translate-x-1/2 transition-[left] duration-150 ease-out" style={{ left: laneX(w.lane), top: `calc(${RUNNER_Y} * 100% - 1rem)` }}>
        <Runner />
        {w.note && <p className="kana-miss absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--color-error)] bg-[var(--color-error-subtle)] px-2 py-0.5 text-sm font-semibold text-[var(--color-text)]">{w.note.text}</p>}
      </div>

      {phase === 'countdown' && <Countdown onDone={() => setPhase('play')}
        hint={<>{listen ? 'Nghe âm' : 'Nhìn romaji'} rồi chạy qua cổng mang đúng chữ. Dùng ← → (hoặc A D), hay chạm vào làn muốn chạy.</>} />}
      {phase === 'paused' && <PausedOverlay onResume={() => setPhase('play')} onExit={onExit} />}
      {phase === 'over' && <GameOver score={w.score} best={best} missed={w.missed} onRetry={restart} onExit={onExit} />}
    </Board>
  </section>;
}
