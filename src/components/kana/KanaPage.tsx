import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RotateCcw, Volume2 } from '@/components/ui/icons';
import { AppDialog } from '@/components/ui/AppDialog';
import { PageHeading } from '@/components/ui/StudyUI';
import { HIRA_INFO, KANA_COLUMNS, KANA_ROWS, KATA_INFO, counterpart, type KanaRow, type KanaScript } from './kanaData';
import { KANA_STROKES } from './kanaStrokes';

const SCRIPTS: Record<KanaScript, { name: string; jp: string; sample: string; use: string; ex: [string, string] }> = {
  hira: { name: 'Hiragana', jp: 'ひらがな', sample: 'あ', ex: ['ねこ', 'con mèo'], use: 'Dùng để viết từ gốc Nhật, trợ từ và đuôi động từ — phần lớn chữ trong một câu tiếng Nhật là Hiragana. Nét tròn, mềm.' },
  kata: { name: 'Katakana', jp: 'カタカナ', sample: 'ア', ex: ['コーヒー', 'cà phê'], use: 'Dùng để viết từ mượn nước ngoài và tên người nước ngoài. Nét thẳng, góc cạnh. Học sau khi đã quen Hiragana.' },
};

type Cell = [row: number, col: number];
type Focus = { kind: 'row' | 'col'; i: number } | null;

/** Every filled slot in reading order; drives the "previous / next character" buttons. */
const ORDER: Cell[] = KANA_ROWS.flatMap((r, ri) => r.hira.flatMap((k, c) => (k ? [[ri, c] as Cell] : [])));

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
}

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

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return <section className="mt-6 border-t border-[var(--color-border)] pt-5">
    <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-[var(--color-text)]">
      <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-xs text-[var(--color-text-inverse)]">{n}</span>
      {title}
    </h3>
    {children}
  </section>;
}

function KanaDetail({ ch, row, col, script, position, replay, onStep, onReplay, onSwitch }: {
  ch: string; row: KanaRow; col: number; script: KanaScript; position: number;
  replay: number; onStep: (delta: number) => void; onReplay: () => void; onSwitch: () => void;
}) {
  const romaji = row.romaji[col];
  const info = (script === 'hira' ? HIRA_INFO : KATA_INFO)[ch];
  const paths = KANA_STROKES[ch] ?? [];
  const formula = row.id === 'nn' ? 'Chữ đặc biệt: đứng một mình, không ghép với nguyên âm'
    : row.id === 'a' ? `Hàng A (chỉ có nguyên âm) → “${romaji}”`
    : `Hàng ${row.id.toUpperCase()} + Cột ${KANA_COLUMNS[col].id.toUpperCase()} = “${romaji}”`;
  return <>
    <div className="flex items-center justify-between gap-2">
      <button className="study-button !min-h-10 !px-3" onClick={() => onStep(-1)}>‹ Chữ trước</button>
      <span className="text-xs text-[var(--color-text-secondary)]">Chữ {position + 1} / {ORDER.length}</span>
      <button className="study-button !min-h-10 !px-3" onClick={() => onStep(1)}>Chữ sau ›</button>
    </div>
    <div className="mt-5">
      <p className="study-eyebrow">{SCRIPTS[script].name.toUpperCase()} · {row.label.toUpperCase()}</p>
      <p className="font-jp-serif mt-2 text-8xl leading-none text-[var(--color-text)]">{ch}</p>
    </div>

    <Step n={1} title="Nghe và đọc">
      <p className="text-2xl font-semibold text-[var(--color-text)]">đọc là “{romaji}”</p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formula}</p>
      <p className="study-copy mt-2">Gần giống tiếng Việt: <b className="text-[var(--color-text)]">“{row.vi[col]}”</b> (chỉ gần đúng — bấm nút bên dưới để nghe giọng Nhật).</p>
      <button className="study-button mt-3" onClick={() => speak(ch)}><Volume2 size={18} /> Nghe phát âm</button>
      {info.note && <p className="mt-3 rounded-lg border border-[var(--color-gold)] px-3 py-2 text-sm text-[var(--color-text)]">⚠ Lưu ý: {info.note}</p>}
    </Step>

    <Step n={2} title="Nhớ mặt chữ">
      <p className="text-[var(--color-text)]">{info.hint}</p>
      {info.ex && <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-[var(--color-surface-alt)] px-3 py-2">
        <span className="text-xs text-[var(--color-text-secondary)]">Ví dụ:</span>
        <span className="font-jp-serif text-2xl text-[var(--color-text)]">{info.ex[0]}</span>
        <span className="text-sm text-[var(--color-text-secondary)]">{info.ex[1]} = {info.ex[2]}</span>
        <button className="ml-auto text-sm font-semibold text-[var(--color-accent)]" onClick={() => speak(info.ex![0])}>Nghe từ</button>
      </div>}
      <button className="study-button mt-3" onClick={onSwitch}>
        Xem chữ {script === 'hira' ? 'Katakana' : 'Hiragana'} cùng âm: <span className="font-jp-serif text-xl">{counterpart(ch)}</span>
      </button>
    </Step>

    <Step n={3} title={`Tập viết (${paths.length} nét)`}>
      <svg key={ch + replay} viewBox="0 0 109 109" role="img" aria-label={`Thứ tự ${paths.length} nét của chữ ${ch}`}
        className="mx-auto block w-56 max-w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M54.5 2v105M2 54.5h105" strokeWidth="1" strokeDasharray="3 4" style={{ stroke: GHOST }} />
        {paths.map((d, i) => <path key={'g' + i} d={d} style={{ stroke: GHOST, opacity: .45 }} />)}
        {paths.map((d, i) => <path key={i} d={d} pathLength={1} className="kana-stroke" style={{ stroke: INK, animationDelay: `${i * 0.8}s` }} />)}
      </svg>
      <button className="study-button mx-auto mt-3 !min-h-10" onClick={onReplay}><RotateCcw size={16} /> Xem lại từ đầu</button>
      <p className="study-copy mt-3">Hình trên tự vẽ từng nét theo đúng thứ tự. Quy tắc chung: viết <b>từ trái sang phải, từ trên xuống dưới</b>. Dưới đây là từng nét tách riêng — <b>chấm màu</b> là nơi đặt bút.</p>
      <div className="mt-3 flex flex-wrap gap-3">{paths.map((_, n) => <StrokeStep key={n} paths={paths} n={n} />)}</div>
    </Step>
  </>;
}

export function KanaPage() {
  const [script, setScript] = useState<KanaScript>('hira');
  const [sel, setSel] = useState<Cell>([0, 0]);
  const [focus, setFocus] = useState<Focus>(null);
  const [hideRomaji, setHideRomaji] = useState(false);
  const [replay, setReplay] = useState(0);
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(() => matchMedia('(min-width:1024px)').matches);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = matchMedia('(min-width:1024px)');
    const change = () => setWide(mq.matches);
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, []);

  const row = KANA_ROWS[sel[0]];
  const ch = row[script][sel[1]];
  const position = ORDER.findIndex(([r, c]) => r === sel[0] && c === sel[1]);
  const focusRow = (r: number) => { setFocus({ kind: 'row', i: r }); speak(KANA_ROWS[r][script].filter(Boolean).join('、')); };
  const focusCol = (c: number) => { setFocus({ kind: 'col', i: c }); speak(KANA_ROWS.map(r => r[script][c]).filter(Boolean).join('、')); };
  const pick = (r: number, c: number) => { setSel([r, c]); setFocus(null); if (!wide) setOpen(true); };
  const step = (delta: number) => setSel(ORDER[(position + delta + ORDER.length) % ORDER.length]);
  const showDemo = () => { setSel([1, 0]); setFocus(null); chartRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const demoA = KANA_ROWS[1][script][0];
  const demoB = KANA_ROWS[6][script][4];
  const headBtn = 'flex flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center transition-colors focus-ring hover:bg-[var(--color-surface-hover)]';
  const speakerIcon = <Volume2 size={13} aria-hidden="true" className="text-[var(--color-text-tertiary)]" />;

  const detail = <KanaDetail ch={ch} row={row} col={sel[1]} script={script} position={position} replay={replay}
    onStep={step} onReplay={() => setReplay(n => n + 1)} onSwitch={() => setScript(script === 'hira' ? 'kata' : 'hira')} />;

  return <div className="study-page">
    <PageHeading title="Bảng chữ cái" subtitle="Tiếng Nhật không có chữ cái đơn lẻ như a, b, c. Mỗi chữ là một âm trọn vẹn (か = “ca”). Học thuộc 46 chữ này là bạn đọc được những câu tiếng Nhật đầu tiên." />

    <section className="space-y-3" aria-label="Chọn bộ chữ">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">Bước 1 · Chọn bộ chữ muốn học</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(SCRIPTS) as KanaScript[]).map(key => {
          const s = SCRIPTS[key];
          return <button key={key} aria-pressed={script === key} onClick={() => setScript(key)}
            className={'rounded-xl border p-4 text-left transition-colors focus-ring ' + (script === key ? 'border-[var(--color-accent)] bg-[var(--color-surface-alt)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]')}>
            <span className="flex items-center gap-3">
              <span className="font-jp-serif text-4xl leading-none text-[var(--color-text)]">{s.sample}</span>
              <span className="min-w-0 flex-1"><b className="block text-base text-[var(--color-text)]">{s.name} <span className="font-jp text-xs font-normal text-[var(--color-text-tertiary)]">{s.jp}</span></b></span>
              {key === 'hira' && <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs text-[var(--color-text-inverse)]">Học trước</span>}
            </span>
            <span className="study-copy mt-2 block">{s.use}</span>
            <span className="mt-2 block text-sm text-[var(--color-text-secondary)]">Ví dụ: <span className="font-jp-serif text-lg text-[var(--color-text)]">{s.ex[0]}</span> = {s.ex[1]}</span>
          </button>;
        })}
      </div>
    </section>

    <section className="study-panel grid gap-6 md:grid-cols-2" aria-label="Hướng dẫn đọc bảng">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Bước 2 · Hiểu cách đọc bảng</h2>
        <ol className="study-copy mt-3 list-decimal space-y-2 pl-5">
          <li><b>Cột dọc</b> (phía trên) là 5 nguyên âm: <b>a · i · u · e · o</b> — đọc gần như a, i, u, ê, ô.</li>
          <li><b>Hàng ngang</b> (bên trái) cho biết phụ âm đứng trước: k, s, t, n, h, m, y, r, w. Hàng đầu không có phụ âm.</li>
          <li><b>Ghép hàng + cột</b> ra âm cần đọc.</li>
        </ol>
        <p className="mt-3 rounded-lg bg-[var(--color-surface-alt)] px-3 py-2 text-[var(--color-text)]">
          Hàng <b>K</b> + cột <b>A</b> = <b>ka</b> = <span className="font-jp-serif text-2xl">{demoA}</span><br />
          Hàng <b>M</b> + cột <b>O</b> = <b>mo</b> = <span className="font-jp-serif text-2xl">{demoB}</span>
        </p>
        <button className="study-button mt-3" onClick={showDemo}>Xem chữ {demoA} trên bảng ↓</button>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Bước 3 · Cách dùng trang này</h2>
        <ul className="study-copy mt-3 list-disc space-y-2 pl-5">
          <li><b>Bấm vào một chữ</b> để xem cách đọc, mẹo nhớ mặt chữ và cách viết từng nét.</li>
          <li><b>Bấm tên hàng hoặc tên cột</b> (có biểu tượng loa) để nghe đọc cả hàng/cột kèm mẹo phát âm.</li>
          <li><b>Bật “Tự kiểm tra”</b> để che phiên âm: đoán thử, rồi bấm vào chữ để xem đáp án.</li>
          <li><b>Nút “Chữ trước / Chữ sau”</b> giúp học lần lượt từng chữ theo thứ tự trong bảng.</li>
          <li>Gợi ý lộ trình: mỗi ngày 1–2 hàng, vừa đọc to vừa viết tay.</li>
        </ul>
      </div>
    </section>

    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,1fr)]">
      <div ref={chartRef} className="scroll-mt-16 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Bảng {SCRIPTS[script].name} · bấm vào chữ để học</h2>
        <button role="switch" aria-checked={hideRomaji} onClick={() => setHideRomaji(!hideRomaji)} className="flex w-full items-center gap-3 rounded-lg text-left focus-ring">
          <span aria-hidden="true" className={'relative h-6 w-11 shrink-0 rounded-full transition-colors ' + (hideRomaji ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]')}>
            <span className={'absolute top-0.5 size-5 rounded-full bg-white transition-all ' + (hideRomaji ? 'left-[22px]' : 'left-0.5')} />
          </span>
          <span className="text-sm text-[var(--color-text)]"><b>Tự kiểm tra</b> — {hideRomaji ? 'đang che phiên âm. Đoán âm đọc rồi bấm vào chữ để xem đáp án.' : 'bật để che phiên âm và tự thử trí nhớ.'}</span>
        </button>
        <div className="min-h-[4.5rem]" aria-live="polite">
          {focus ? <p className="study-copy rounded-lg border border-[var(--color-gold)] bg-[var(--color-surface-alt)] px-3 py-2 !text-[var(--color-text)]">
            {focus.kind === 'row' ? <><b>{KANA_ROWS[focus.i].label}:</b> {KANA_ROWS[focus.i].tip}</>
              : <><b>Cột {KANA_COLUMNS[focus.i].id.toUpperCase()}:</b> mọi chữ trong cột này kết thúc bằng âm “{KANA_COLUMNS[focus.i].id}” ({KANA_COLUMNS[focus.i].hint}).</>}
          </p> : <p className="study-copy">Mẹo: bấm vào <b>chữ in đậm bên trái</b> (hàng) hoặc <b>phía trên</b> (cột) để nghe cả hàng/cột.</p>}
        </div>

        <div className="grid grid-cols-[3.25rem_repeat(5,minmax(0,1fr))] gap-1.5 sm:gap-2" role="grid" aria-label={`Bảng ${SCRIPTS[script].name}`}>
          <div />
          {KANA_COLUMNS.map((col, c) => <button key={col.id} onClick={() => focusCol(c)} aria-label={`Cột ${col.id.toUpperCase()}, nghe cả cột`}
            className={headBtn + (sel[1] === c ? ' bg-[var(--color-surface-alt)]' : '')}>
            <span className={'text-lg font-semibold uppercase ' + (sel[1] === c ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]')}>{col.id} {speakerIcon}</span>
            <span className="hidden text-[11px] leading-tight text-[var(--color-text-tertiary)] sm:block">{col.hint}</span>
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
                return <button key={c} onClick={() => pick(ri, c)} aria-pressed={selected} aria-label={`${kana}, đọc là ${r.romaji[c]}`}
                  className={'group flex aspect-square min-w-0 flex-col items-center justify-center rounded-xl border p-1 transition-colors focus-ring ' + (selected ? 'border-[var(--color-accent)] bg-[var(--color-surface-alt)] shadow-[0_0_0_1px_var(--color-accent)]' : lit ? 'border-[var(--color-gold)] bg-[var(--color-surface-alt)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]')}>
                  <span className="font-jp-serif text-3xl leading-none text-[var(--color-text)] sm:text-4xl">{kana}</span>
                  <span className={'mt-1 text-xs text-[var(--color-text-secondary)] ' + (hideRomaji && !selected ? 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100' : '')}>{r.romaji[c]}</span>
                </button>;
              })}
            </div>;
          })}
        </div>
      </div>

      {wide
        ? <section className="study-panel min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto" aria-label={'Chi tiết chữ ' + ch}>{detail}</section>
        : <AppDialog open={open} title={`${ch} · đọc là “${row.romaji[sel[1]]}”`} onClose={() => setOpen(false)}>{detail}</AppDialog>}
    </div>
    <p className="text-xs text-[var(--color-text-tertiary)]">Hình thứ tự nét: KanjiVG (Ulrich Apel), giấy phép CC BY-SA 3.0 — kanjivg.tagaini.net.</p>
  </div>;
}
