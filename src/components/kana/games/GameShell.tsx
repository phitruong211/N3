import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Music, MusicOff, Pause, Play, RotateCcw, Volume2 } from '@/components/ui/icons';
import type { KanaScript } from '../kanaData';
import { ROMAJI, type KanaProgress } from '../kanaProgress';
import { sayKana } from '../kanaSpeech';
import { GAME_SCORES_KEY, type GameId, type GameScores } from './gameLogic';
import { createMusic, type GameMusic } from './gameMusic';

/** A wrong answer nudges the element sideways (Web Animations, so focus and state stay put). */
export const SHAKE: Keyframe[] = [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }];

export type Phase = 'countdown' | 'play' | 'paused' | 'over';
type Storage = { getJSON<T>(key: string, fallback: T): T; setJSON<T>(key: string, value: T): void };

export type GameProps = {
  script: KanaScript;
  progress: KanaProgress;
  storage: Storage;
  onRecord: (ch: string, correct: boolean) => void;
  onExit: () => void;
  /** Opens a calm drill of just these characters, offered after a game. */
  onDrill?: (chars: string[]) => void;
};

/** Calls `step(dt)` every frame while `running`. dt is capped so a background tab does not jump the world forward. */
export function useGameLoop(step: (dt: number) => void, running: boolean) {
  const latest = useRef(step);
  latest.current = step;
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      latest.current(Math.min(0.05, (now - last) / 1000));
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
}

/** Countdown → play ⇄ paused → over. Esc and leaving the tab pause; `restart` starts a fresh countdown. */
export function usePhase() {
  const [phase, setPhase] = useState<Phase>('countdown');
  const [round, setRound] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPhase(p => p === 'play' ? 'paused' : p === 'paused' ? 'play' : p);
    };
    const onHide = () => { if (document.hidden) setPhase(p => p === 'play' ? 'paused' : p); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onHide); };
  }, []);
  return { phase, setPhase, round, restart: () => { setRound(r => r + 1); setPhase('countdown'); } };
}

const MUSIC_OFF_KEY = 'nhat-game-music-off';

/** Background music that plays only while the game is running and follows the level. The on/off choice is per device. */
export function useGameMusic(phase: Phase, level: number) {
  const [on, setOn] = useState(() => localStorage.getItem(MUSIC_OFF_KEY) !== '1');
  const music = useRef<GameMusic | null>(null);
  useEffect(() => () => { music.current?.close(); music.current = null; }, []);
  useEffect(() => {
    if (!on || phase !== 'play') { music.current?.pause(); return; }
    music.current ??= createMusic();
    music.current?.play();
  }, [on, phase]);
  useEffect(() => { music.current?.setLevel(level); }, [level, on, phase]);
  const toggle = () => setOn(v => { localStorage.setItem(MUSIC_OFF_KEY, v ? '1' : '0'); return !v; });
  return { on, toggle };
}

export function readBest(storage: Storage, game: GameId, script: KanaScript) {
  return storage.getJSON<GameScores>(GAME_SCORES_KEY, {})[`${game}-${script}`] ?? 0;
}

/** Saves the score if it beats the record; returns the previous best. */
export function saveBest(storage: Storage, game: GameId, script: KanaScript, score: number) {
  const all = storage.getJSON<GameScores>(GAME_SCORES_KEY, {});
  const before = all[`${game}-${script}`] ?? 0;
  if (score > before) storage.setJSON(GAME_SCORES_KEY, { ...all, [`${game}-${script}`]: score });
  return before;
}

export function Lives({ left, max = 3 }: { left: number; max?: number }) {
  return <span className="flex items-center gap-1" role="img" aria-label={`Còn ${left} mạng`}>
    {Array.from({ length: max }, (_, i) => <span key={i} aria-hidden="true"
      className={'size-3 rounded-full border-2 transition-colors ' + (i < left ? 'border-[var(--color-seal)] bg-[var(--color-seal)]' : 'border-[var(--color-border-strong)] bg-transparent')} />)}
  </span>;
}

export function Hud({ score, level, lives, phase, onPause, onExit, music, children }: {
  score: number; level: number; lives?: number; phase: Phase; onPause: () => void; onExit: () => void; music?: { on: boolean; toggle: () => void }; children?: ReactNode;
}) {
  return <div className="mb-3 flex items-center gap-2 whitespace-nowrap sm:gap-5">
    <button className="study-button !min-h-9 !px-3 text-sm" onClick={onExit} aria-label="Chọn game khác">‹<span className="hidden sm:inline"> Chọn game</span></button>
    <div className="ml-auto flex items-center gap-3 text-sm tabular-nums sm:gap-6">
      {children}
      <span><span className="text-[var(--color-text-tertiary)]">Cấp </span><b>{level}</b></span>
      <span aria-live="polite"><span className="text-[var(--color-text-tertiary)]">Điểm </span><b className="text-base">{score}</b></span>
      {lives !== undefined && <Lives left={lives} />}
    </div>
    {music && <button className="study-button !min-h-9 !w-9 !p-0" onClick={music.toggle} aria-pressed={music.on} aria-label={music.on ? 'Tắt nhạc' : 'Bật nhạc'} title={music.on ? 'Tắt nhạc' : 'Bật nhạc'}>
      {music.on ? <Music size={16} /> : <MusicOff size={16} />}
    </button>}
    <button className="study-button !min-h-9 !w-9 !p-0" onClick={onPause} disabled={phase !== 'play' && phase !== 'paused'}
      aria-label={phase === 'paused' ? 'Tiếp tục' : 'Tạm dừng'} title="Esc">
      {phase === 'paused' ? <Play size={16} /> : <Pause size={16} />}
    </button>
  </div>;
}

/** The board's frame: a paper sheet that hosts the game and its overlays. */
export function Board({ children, className = '', ...rest }: React.ComponentProps<'div'>) {
  return <div {...rest} className={'relative isolate h-[min(62vh,560px)] min-h-[380px] select-none overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] ' + className}>
    {children}
  </div>;
}

function Overlay({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 z-20 grid place-items-center bg-[color-mix(in_srgb,var(--color-surface)_82%,transparent)] p-4 backdrop-blur-[2px]" style={{ animation: 'fade-in var(--dur-base) var(--ease-out) backwards' }}>
    {children}
  </div>;
}

export function Countdown({ onDone, hint }: { onDone: () => void; hint: ReactNode }) {
  const [n, setN] = useState(3);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (n === 0) { done.current(); return; }
    const t = window.setTimeout(() => setN(n - 1), 650);
    return () => window.clearTimeout(t);
  }, [n]);
  return <Overlay>
    <div className="text-center">
      <p key={n} className="stamp-pop font-[family-name:var(--font-display)] text-7xl text-[var(--color-seal)]">{n || '始'}</p>
      <div className="mt-4 max-w-xs text-sm text-[var(--color-text-secondary)]">{hint}</div>
    </div>
  </Overlay>;
}

export function PausedOverlay({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  return <Overlay>
    <div className="text-center">
      <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-text)]">Tạm dừng</p>
      <div className="mt-5 flex justify-center gap-3">
        <button autoFocus className="study-button study-button-primary" onClick={onResume}><Play size={16} /> Tiếp tục</button>
        <button className="study-button" onClick={onExit}>Chọn game khác</button>
      </div>
    </div>
  </Overlay>;
}

/** End screen: score against the record, then the characters that cost a life, each one tappable to hear it again. */
export function GameOver({ score, best, missed, onRetry, onExit, onDrill }: {
  score: number; best: number; missed: string[]; onRetry: () => void; onExit: () => void; onDrill?: (chars: string[]) => void;
}) {
  const record = score > best && score > 0;
  return <Overlay>
    <div className="w-full max-w-sm text-center">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-text-tertiary)]">Kết thúc</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-6xl tabular-nums text-[var(--color-text)]">{score}</p>
      <p className="mt-1 h-6 text-sm">
        {record ? <span className="stamp-pop inline-block rounded border-2 border-[var(--color-seal)] px-2 font-semibold text-[var(--color-seal)] [--stamp-tilt:-4deg]">Kỷ lục mới</span>
          : <span className="text-[var(--color-text-tertiary)]">Kỷ lục: {best}</span>}
      </p>
      {missed.length > 0 && <div className="mt-5">
        <p className="text-sm text-[var(--color-text-secondary)]">Chữ cần ôn lại</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {missed.map(ch => <button key={ch} onClick={() => sayKana(ch)} aria-label={`${ch}, đọc là ${ROMAJI[ch]}, nghe`}
            className="flex items-baseline gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 hover:border-[var(--color-border-strong)]">
            <span className="font-jp-serif text-xl text-[var(--color-text)]">{ch}</span>
            <span className="text-xs text-[var(--color-text-secondary)]">{ROMAJI[ch]}</span>
            <Volume2 size={12} aria-hidden="true" className="text-[var(--color-text-tertiary)]" />
          </button>)}
        </div>
      </div>}
      {missed.length > 0 && onDrill && <button className="study-button mx-auto mt-4" onClick={() => onDrill(missed)}>Luyện lại {missed.length} chữ này</button>}
      <div className="mt-6 flex justify-center gap-3">
        <button autoFocus className="study-button study-button-primary" onClick={onRetry}><RotateCcw size={16} /> Chơi lại</button>
        <button className="study-button" onClick={onExit}>Chọn game khác</button>
      </div>
    </div>
  </Overlay>;
}
