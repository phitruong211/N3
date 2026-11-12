import { useEffect, useState } from 'react';
import { RotateCcw, Volume2 } from '@/components/ui/icons';
import { AppDialog } from '@/components/ui/AppDialog';
import { PageHeading } from '@/components/ui/StudyUI';
import { useLearningStorage } from '@/hooks/useApp';
import { KANA_COLUMNS, KANA_ROWS, type KanaRow, type KanaScript } from './kanaData';
import { KANA_STROKES } from './kanaStrokes';
import { KANA_POOL, KANA_PROGRESS_KEY, countLearned, isLearned, type KanaProgress } from './kanaProgress';
import { sayKana, speak } from './kanaSpeech';
import { GameHub } from './games/GameHub';

const SCRIPTS: Record<KanaScript, { name: string; jp: string; sample: string; role: string }> = {
  hira: { name: 'Hiragana', jp: 'ひらがな', sample: 'あ', role: 'chữ gốc Nhật · học trước' },
  kata: { name: 'Katakana', jp: 'カタカナ', sample: 'ア', role: 'từ mượn nước ngoài' },
};

type Cell = [row: number, col: number];
type Focus = { kind: 'row' | 'col'; i: number } | null;

/** Every filled slot in reading order; drives the "previous / next character" buttons. */
const ORDER: Cell[] = KANA_ROWS.flatMap((r, ri) => r.hira.flatMap((k, c) => (k ? [[ri, c] as Cell] : [])));

const startOf = (d: string): [number, number] => {
  const m = d.match(/^M\s*(-?[\d.]+)[,\s]+(-?[\d.]+)/);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
};

const INK = 'var(--color-text)';
const GHOST = 'var(--color-border-strong)';
const ACCENT = 'var(--color-accent)';

function StrokeStep({ paths, n }: { paths: string[]; n: number }) {
  const [x, y] = startOf(paths[n]);
  return <figure className="m-0 text-center">
    <svg viewBox="0 0 109 109" className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" aria-hidden="true" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      {paths.slice(0, n).map((d, i) => <path key={i} d={d} style={{ stroke: INK }} />)}
      <path d={paths[n]} style={{ stroke: ACCENT }} />
      <circle cx={x} cy={y} r="6" style={{ fill: ACCENT, stroke: 'none' }} />
    </svg>
    <figcaption className="mt-1 text-xs text-[var(--color-text-secondary)]">Nét {n + 1}</figcaption>
  </figure>;
}

function KanaDetail({ ch, row, col, script, position, replay, onStep, onReplay }: {
  ch: string; row: KanaRow; col: number; script: KanaScript; position: number;
  replay: number; onStep: (delta: number) => void; onReplay: () => void;
}) {
  const paths = KANA_STROKES[ch] ?? [];
  return <>
    <div className="flex items-center justify-between gap-2">
      <button className="study-button !min-h-10 !px-3" onClick={() => onStep(-1)}>‹ Chữ trước</button>
      <span className="text-xs tabular-nums text-[var(--color-text-secondary)]">{position + 1} / {ORDER.length}</span>
      <button className="study-button !min-h-10 !px-3" onClick={() => onStep(1)}>Chữ sau ›</button>
    </div>
    <div className="mt-5">
      <p className="study-eyebrow">{SCRIPTS[script].name.toUpperCase()} · {row.label.toUpperCase()}</p>
      <div className="mt-2 flex items-end gap-5">
        <p className="font-jp-serif text-8xl leading-none text-[var(--color-text)]">{ch}</p>
        <div>
          <p className="text-2xl font-semibold text-[var(--color-text)]">“{row.romaji[col]}”</p>
          <button className="study-button mt-2 !min-h-10" onClick={() => sayKana(ch)}><Volume2 size={18} /> Nghe</button>
        </div>
      </div>
    </div>

    <section className="mt-6 border-t border-[var(--color-border)] pt-5">
      <h3 className="mb-3 text-base font-semibold text-[var(--color-text)]">Tập viết · {paths.length} nét</h3>
      <svg key={ch + replay} viewBox="0 0 109 109" role="img" aria-label={`Thứ tự ${paths.length} nét của chữ ${ch}`}
        className="mx-auto block w-56 max-w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M54.5 2v105M2 54.5h105" strokeWidth="1" strokeDasharray="3 4" style={{ stroke: GHOST }} />
        {paths.map((d, i) => <path key={'g' + i} d={d} style={{ stroke: GHOST, opacity: .45 }} />)}
        {paths.map((d, i) => <path key={i} d={d} pathLength={1} className="kana-stroke" style={{ stroke: INK, animationDelay: `${i * 0.8}s` }} />)}
      </svg>
      <button className="study-button mx-auto mt-3 !min-h-10" onClick={onReplay}><RotateCcw size={16} /> Xem lại</button>
      <p className="study-copy mt-3">Viết từ trái sang phải, trên xuống dưới. <b>Chấm màu</b> là nơi đặt bút.</p>
      <div className="mt-3 flex flex-wrap gap-3">{paths.map((_, n) => <StrokeStep key={n} paths={paths} n={n} />)}</div>
    </section>
  </>;
}

export function KanaPage() {
  const storage = useLearningStorage();
  const [script, setScript] = useState<KanaScript>('hira');
  const [mode, setMode] = useState<'chart' | 'drill'>('chart');
  const [progress, setProgress] = useState<KanaProgress>(() => storage.getJSON<KanaProgress>(KANA_PROGRESS_KEY, {}));
  const [sel, setSel] = useState<Cell>([0, 0]);
  const [focus, setFocus] = useState<Focus>(null);
  const [hideRomaji, setHideRomaji] = useState(false);
  const [replay, setReplay] = useState(0);
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(() => matchMedia('(min-width:1024px)').matches);

  useEffect(() => {
    const mq = matchMedia('(min-width:1024px)');
    const change = () => setWide(mq.matches);
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, []);

  // Signing in or out swaps the storage scope, so the progress on screen must follow it.
  useEffect(() => setProgress(storage.getJSON<KanaProgress>(KANA_PROGRESS_KEY, {})), [storage]);

  const save = (next: KanaProgress) => { setProgress(next); storage.setJSON(KANA_PROGRESS_KEY, next); };
  const pool = KANA_POOL[script];
  const learned = countLearned(progress, pool);
  const record = (ch: string, correct: boolean) => save({ ...progress, [ch]: correct ? (progress[ch] ?? 0) + 1 : 0 });
  const resetScript = () => {
    const next = { ...progress };
    for (const kana of pool) delete next[kana];
    save(next);
  };

  const row = KANA_ROWS[sel[0]];
  const ch = row[script][sel[1]];
  const position = ORDER.findIndex(([r, c]) => r === sel[0] && c === sel[1]);
  const focusRow = (r: number) => { setFocus({ kind: 'row', i: r }); speak(KANA_ROWS[r][script].filter(Boolean).join('。')); };
  const focusCol = (c: number) => { setFocus({ kind: 'col', i: c }); speak(KANA_ROWS.map(r => r[script][c]).filter(Boolean).join('。')); };
  const pick = (r: number, c: number) => { setSel([r, c]); setFocus(null); if (!wide) setOpen(true); };
  const step = (delta: number) => setSel(ORDER[(position + delta + ORDER.length) % ORDER.length]);
  const headBtn = 'flex flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center transition-colors focus-ring hover:bg-[var(--color-surface-hover)]';
  const speakerIcon = <Volume2 size={13} aria-hidden="true" className="text-[var(--color-text-tertiary)]" />;

  const detail = <KanaDetail ch={ch} row={row} col={sel[1]} script={script} position={position} replay={replay}
    onStep={step} onReplay={() => setReplay(n => n + 1)} />;

  const scriptSwitch = <div className="flex w-full gap-2 sm:w-auto" role="group" aria-label="Chọn bộ chữ">
    {(Object.keys(SCRIPTS) as KanaScript[]).map(key => {
      const s = SCRIPTS[key];
      return <button key={key} aria-pressed={script === key} onClick={() => setScript(key)}
        className={'flex flex-1 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors focus-ring sm:flex-none ' + (script === key ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]')}>
        <span className="font-jp-serif text-2xl leading-none text-[var(--color-text)]">{s.sample}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--color-text)]">{s.name}</span>
          <span className="block text-xs leading-tight text-[var(--color-text-tertiary)]">{s.role}</span>
        </span>
      </button>;
    })}
  </div>;

  return <div className="study-page">
    {/* Practising is a task, not a reference: the title and its intro only earn their space on the chart. */}
    {mode === 'chart'
      ? <PageHeading title="Bảng chữ cái" subtitle="46 chữ, mỗi chữ là một âm trọn vẹn — nền tảng để đọc được tiếng Nhật." action={scriptSwitch} />
      : <div className="flex justify-center">{scriptSwitch}</div>}

    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="flex gap-6" role="group" aria-label="Chế độ">
        {([['chart', 'Bảng'], ['drill', 'Trò chơi']] as const).map(([key, label]) =>
          <button key={key} aria-pressed={mode === key} onClick={() => setMode(key)}
            className={'relative cursor-pointer py-1 text-[0.9375rem] transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:transition-colors ' + (mode === key ? 'font-semibold text-[var(--color-text)] after:bg-[var(--color-gold)]' : 'text-[var(--color-text-tertiary)] after:bg-transparent hover:text-[var(--color-text)]')}>
            {label}
          </button>)}
      </div>

      <div className="min-w-[11rem] flex-1 sm:max-w-xs">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-[var(--color-text-secondary)]">Đã thuộc</span>
          <span className="tabular-nums text-[var(--color-text)]"><b>{learned}</b> / {pool.length}</span>
        </div>
        <div className="mt-1.5 h-0.5 w-full rounded-full bg-[var(--color-border)]">
          <div className="h-0.5 rounded-full bg-[var(--color-accent)] transition-[width] duration-[var(--dur-base)] ease-[var(--ease-out)]" style={{ width: `${(learned / pool.length) * 100}%` }} />
        </div>
      </div>
    </div>

    {mode === 'drill'
      ? <GameHub key={script} script={script} progress={progress} storage={storage} onRecord={record} onReset={resetScript} />
      : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,1fr)]">
        <div className="space-y-3">
          <div className="flex justify-end">
            <button role="switch" aria-checked={hideRomaji} onClick={() => setHideRomaji(!hideRomaji)} className="flex shrink-0 items-center gap-2 rounded-lg text-sm text-[var(--color-text)] focus-ring">
              <span aria-hidden="true" className={'relative h-5 w-9 shrink-0 rounded-full transition-colors ' + (hideRomaji ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]')}>
                <span className={'absolute top-0.5 size-4 rounded-full bg-white transition-all ' + (hideRomaji ? 'left-[18px]' : 'left-0.5')} />
              </span>
              Che phiên âm
            </button>
          </div>

          <div className="grid grid-cols-[3.25rem_repeat(5,minmax(0,1fr))] gap-1.5 sm:gap-2" role="grid" aria-label={`Bảng ${SCRIPTS[script].name}`}>
            <div />
            {KANA_COLUMNS.map((col, c) => <button key={col.id} onClick={() => focusCol(c)} aria-label={`Cột ${col.id.toUpperCase()}, nghe cả cột`}
              className={headBtn + (sel[1] === c ? ' bg-[var(--color-surface-alt)]' : '')}>
              <span className={'text-lg font-semibold uppercase ' + (sel[1] === c ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]')}>{col.id} {speakerIcon}</span>
            </button>)}
            {KANA_ROWS.map((r, ri) => {
              const [kind, letter] = r.label.split(' ');
              return <div key={r.id} className="contents" role="row">
                <button onClick={() => focusRow(ri)} aria-label={`${r.label}, nghe cả hàng`}
                  className={headBtn + (sel[0] === ri ? ' bg-[var(--color-surface-alt)]' : '')}>
                  <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)] sm:text-xs">{kind}</span>
                  <span className={'text-lg font-semibold ' + (sel[0] === ri ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]')}>{letter}</span>
                  {speakerIcon}
                </button>
                {r[script].map((kana, c) => {
                  if (!kana) return <div key={c} aria-hidden="true" className="aspect-square rounded-xl border border-dashed border-[var(--color-border)] opacity-50" />;
                  const selected = sel[0] === ri && sel[1] === c;
                  const lit = focus?.kind === 'row' ? focus.i === ri : focus?.kind === 'col' ? focus.i === c : false;
                  const known = isLearned(progress, kana);
                  return <button key={c} onClick={() => pick(ri, c)} aria-pressed={selected} aria-label={`${kana}, đọc là ${r.romaji[c]}${known ? ', đã thuộc' : ''}`}
                    className={'group relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-xl border p-1 transition-colors focus-ring ' + (selected ? 'border-[var(--color-accent)] bg-[var(--color-surface-alt)] shadow-[0_0_0_1px_var(--color-accent)]' : lit ? 'border-[var(--color-gold)] bg-[var(--color-surface-alt)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]')}>
                    {known && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--color-seal)]" />}
                    <span className="font-jp-serif text-3xl leading-none text-[var(--color-text)] sm:text-4xl">{kana}</span>
                    <span className={'mt-1 text-xs text-[var(--color-text-secondary)] ' + (hideRomaji && !selected ? 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100' : '')}>{r.romaji[c]}</span>
                  </button>;
                })}
              </div>;
            })}
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            <span aria-hidden="true" className="mr-1.5 inline-block size-1.5 rounded-full bg-[var(--color-seal)] align-middle" />
            Chữ đã thuộc. Tiến độ lưu trên máy này.
            {learned > 0 && <button className="ml-2 underline hover:text-[var(--color-text)]" onClick={resetScript}>Xóa</button>}
          </p>
        </div>

        {wide
          ? <section className="study-panel min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto" aria-label={'Chi tiết chữ ' + ch}>{detail}</section>
          : <AppDialog open={open} title={`${ch} · “${row.romaji[sel[1]]}”`} onClose={() => setOpen(false)}>{detail}</AppDialog>}
      </div>}

    {mode === 'chart' && <p className="text-xs text-[var(--color-text-tertiary)]">Hình thứ tự nét: KanjiVG (Ulrich Apel), giấy phép CC BY-SA 3.0 — kanjivg.tagaini.net.</p>}
  </div>;
}
