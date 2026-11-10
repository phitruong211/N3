import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Volume2 } from '@/components/ui/icons';
import { AppDialog } from '@/components/ui/AppDialog';
import { PageHeading } from '@/components/ui/StudyUI';
import { useLearningStorage } from '@/hooks/useApp';
import { KANA_COLUMNS, KANA_ROWS, type KanaRow, type KanaScript } from './kanaData';
import { KANA_STROKES } from './kanaStrokes';
import { KANA_POOL, KANA_PROGRESS_KEY, buildQuestion, countLearned, isLearned, type KanaProgress } from './kanaProgress';

const SCRIPTS: Record<KanaScript, { name: string; jp: string; sample: string; role: string }> = {
  hira: { name: 'Hiragana', jp: 'ひらがな', sample: 'あ', role: 'chữ gốc Nhật · học trước' },
  kata: { name: 'Katakana', jp: 'カタカナ', sample: 'ア', role: 'từ mượn nước ngoài' },
};

type Cell = [row: number, col: number];
type Focus = { kind: 'row' | 'col'; i: number } | null;

/** Every filled slot in reading order; drives the "previous / next character" buttons. */
const ORDER: Cell[] = KANA_ROWS.flatMap((r, ri) => r.hira.flatMap((k, c) => (k ? [[ri, c] as Cell] : [])));

// The browser's default ja-JP voice is often the weakest one installed: prefer natural/enhanced voices, then well-known good ones.
const voiceScore = (v: SpeechSynthesisVoice) => (/premium|enhanced|natural|neural/i.test(v.name) ? 2 : 0) + (/kyoko|o-ren|google|nanami|haruka/i.test(v.name) ? 1 : 0);
function japaneseVoice() {
  return window.speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('ja')).sort((a, b) => voiceScore(b) - voiceScore(a))[0];
}

// A lone kana is one short mora: speak it slowly, and twice (see sayKana) so a beginner can catch it.
function speak(text: string, rate = 0.45) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.voice = japaneseVoice() ?? null; // voices load lazily; null falls back to the browser default
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

const sayKana = (ch: string) => speak(`${ch}。${ch}`);

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

function Drill({ script, progress, learned, onRecord, onReset }: {
  script: KanaScript; progress: KanaProgress; learned: number;
  onRecord: (ch: string, correct: boolean) => void; onReset: () => void;
}) {
  const pool = KANA_POOL[script];
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
    <p className="mt-4 text-[var(--color-text)]">Thuộc cả {pool.length} chữ {SCRIPTS[script].name}.</p>
    <button className="study-button mx-auto mt-5" onClick={onReset}><RotateCcw size={16} /> Luyện lại từ đầu</button>
  </section>;

  const right = picked === question.romaji;
  return <section className="mx-auto w-full max-w-md" aria-label="Luyện tập">
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
          <span className="block text-[11px] leading-tight text-[var(--color-text-tertiary)]">{s.role}</span>
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
        {([['chart', 'Bảng'], ['drill', 'Luyện tập']] as const).map(([key, label]) =>
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
      ? <Drill key={script} script={script} progress={progress} learned={learned} onRecord={record} onReset={resetScript} />
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
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">{kind}</span>
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
