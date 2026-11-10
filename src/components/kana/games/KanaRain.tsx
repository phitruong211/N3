import { useReducer, useRef, useState } from 'react';
import { KANA_POOL, ROMAJI, pickKana } from '../kanaProgress';
import { speak } from '../kanaSpeech';
import { rainLevel, resolveTyped } from './gameLogic';
import { Board, Countdown, GameOver, Hud, PausedOverlay, SHAKE, readBest, saveBest, useGameLoop, useGameMusic, usePhase, type GameProps } from './GameShell';

type Drop = { id: number; ch: string; slot: number; y: number };
type Effect = { id: number; kind: 'hit' | 'miss'; ch: string; slot: number; y: number; ttl: number };

const SLOTS = 7;
const LIVES = 3;
const slotX = (slot: number) => `${8 + slot * (84 / (SLOTS - 1))}%`;

export function KanaRain(props: GameProps) {
  const phase = usePhase();
  return <RainRound key={phase.round} {...props} {...phase} />;
}

function RainRound({ script, progress, storage, onRecord, onExit, phase, setPhase, restart }: GameProps & ReturnType<typeof usePhase>) {
  const pool = KANA_POOL[script];
  const world = useRef({ drops: [] as Drop[], effects: [] as Effect[], spawnIn: 0.4, hits: 0, score: 0, combo: 0, lives: LIVES, nextId: 1, missed: [] as string[], last: '' });
  const [, render] = useReducer((n: number) => n + 1, 0);
  const [typed, setTyped] = useState('');
  const [best] = useState(() => readBest(storage, 'rain', script));
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(progress);
  latest.current = progress;
  const w = world.current;
  const { level, fallSeconds, spawnEvery, maxDrops } = rainLevel(w.hits);
  const music = useGameMusic(phase, level);

  useGameLoop(dt => {
    w.spawnIn -= dt;
    if (w.spawnIn <= 0 && w.drops.length < maxDrops) {
      const onScreen = new Set(w.drops.map(d => d.ch));
      let ch = pickKana(pool, latest.current, w.last);
      for (let i = 0; i < 6 && onScreen.has(ch); i++) ch = pickKana(pool, latest.current, w.last);
      const busy = new Set(w.drops.filter(d => d.y < 0.4).map(d => d.slot));
      const free = [...Array(SLOTS).keys()].filter(s => !busy.has(s));
      w.drops.push({ id: w.nextId++, ch, slot: free[Math.floor(Math.random() * free.length)] ?? 0, y: 0 });
      w.last = ch;
      w.spawnIn = spawnEvery * (0.75 + Math.random() * 0.5);
    }
    for (const d of w.drops) d.y += dt / fallSeconds;
    for (const d of w.drops.filter(d => d.y >= 1)) {
      w.lives -= 1;
      w.combo = 0;
      w.effects.push({ id: w.nextId++, kind: 'miss', ch: d.ch, slot: d.slot, y: 1, ttl: 1.6 });
      if (!w.missed.includes(d.ch)) w.missed.push(d.ch);
      onRecord(d.ch, false);
    }
    w.drops = w.drops.filter(d => d.y < 1);
    for (const e of w.effects) e.ttl -= dt;
    w.effects = w.effects.filter(e => e.ttl > 0);
    if (w.lives <= 0 && phase === 'play') { saveBest(storage, 'rain', script, w.score); setPhase('over'); }
    render();
  }, phase === 'play');

  const submit = (value: string, force: boolean) => {
    if (phase !== 'play') return;
    const urgent = [...w.drops].sort((a, b) => b.y - a.y);
    const { hit, wrong } = resolveTyped(value, urgent, force);
    if (hit) {
      w.drops = w.drops.filter(d => d !== hit);
      w.effects.push({ id: w.nextId++, kind: 'hit', ch: hit.ch, slot: hit.slot, y: hit.y, ttl: 0.6 });
      w.hits += 1;
      w.combo += 1;
      w.score += 10 * level + Math.min(w.combo, 10) * 2;
      onRecord(hit.ch, true);
      speak(hit.ch);
      setTyped('');
    } else if (wrong) {
      w.combo = 0;
      input.current?.animate(SHAKE, 320);
      setTyped('');
    } else setTyped(value);
  };

  return <section aria-label="Mưa chữ">
    <Hud score={w.score} level={level} lives={w.lives} phase={phase} onExit={onExit} music={music}
      onPause={() => setPhase(phase === 'paused' ? 'play' : 'paused')}>
      {w.combo >= 3 && <span key={w.combo} className="stamp-pop font-semibold text-[var(--color-seal)]">×{w.combo}</span>}
    </Hud>

    <Board className="rain-sky" onPointerDown={() => input.current?.focus()}>
      {w.drops.map(d => {
        const danger = d.y > 0.62;
        return <div key={d.id} className="absolute -translate-x-1/2" style={{ left: slotX(d.slot), top: `calc(${d.y} * (100% - 5.5rem) - 0.25rem)` }}>
          <div className={'grid size-16 place-items-center rounded-full border-2 bg-[var(--color-surface)] shadow-[0_6px_14px_-8px_rgb(0_0_0/.35)] transition-colors duration-300 ' + (danger ? 'border-[var(--color-seal)]' : 'border-[var(--color-border-strong)]')}>
            <span className="font-jp-serif text-4xl leading-none text-[var(--color-text)]">{d.ch}</span>
          </div>
        </div>;
      })}
      {w.effects.map(e => e.kind === 'hit'
        ? <div key={e.id} aria-hidden="true" className="pointer-events-none absolute -translate-x-1/2" style={{ left: slotX(e.slot), top: `calc(${e.y} * (100% - 5.5rem) - 0.25rem)` }}>
          <div className="kana-burst grid size-16 place-items-center rounded-full border-2 border-[var(--color-success)]">
            <span className="font-jp-serif text-4xl leading-none text-[var(--color-success)]">{e.ch}</span>
          </div>
        </div>
        : <div key={e.id} className="pointer-events-none absolute bottom-12 -translate-x-1/2" style={{ left: slotX(e.slot) }}>
          <div className="kana-miss flex items-baseline gap-1.5 whitespace-nowrap rounded-lg border border-[var(--color-error)] bg-[var(--color-error-subtle)] px-2 py-0.5">
            <span className="font-jp-serif text-xl text-[var(--color-text)]">{e.ch}</span>
            <span className="text-sm font-semibold text-[var(--color-error)]">{ROMAJI[e.ch]}</span>
          </div>
        </div>)}
      <div aria-hidden="true" className="rain-ground absolute inset-x-0 bottom-0 h-10" />

      {phase === 'countdown' && <Countdown onDone={() => { setPhase('play'); input.current?.focus(); }}
        hint={<>Gõ romaji của chữ đang rơi rồi chữ sẽ vỡ. Để chữ chạm đất là mất một mạng.</>} />}
      {phase === 'paused' && <PausedOverlay onResume={() => { setPhase('play'); input.current?.focus(); }} onExit={onExit} />}
      {phase === 'over' && <GameOver score={w.score} best={best} missed={w.missed} onRetry={restart} onExit={onExit} />}
    </Board>

    <div className="mx-auto mt-4 max-w-sm">
      <label className="sr-only" htmlFor="kana-rain-input">Gõ romaji</label>
      <input id="kana-rain-input" ref={input} value={typed} disabled={phase === 'over'}
        onChange={e => submit(e.target.value, false)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); submit(typed, true); } }}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go" placeholder="Gõ romaji…"
        className="h-14 w-full rounded-xl border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] text-center text-2xl tracking-wider text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]" />
      <p className="mt-2 text-center text-xs text-[var(--color-text-tertiary)]">Chữ gần đất nhất được bắn trước · Enter để xác nhận · Esc tạm dừng</p>
    </div>
  </section>;
}
