import { useState, type ReactNode } from 'react';
import { Volume2 } from '@/components/ui/icons';
import type { KanaScript } from '../kanaData';
import { type GameId } from './gameLogic';
import { readBest, type GameProps } from './GameShell';
import { ImpostorHunt } from './ImpostorHunt';
import { QuizDrill } from './QuizDrill';
import { KanaRain } from './KanaRain';
import { Torii, ToriiRun } from './ToriiRun';

type Choice = { game: GameId | 'quiz'; listen?: boolean; focus?: string[] };

const SAMPLE: Record<KanaScript, { rain: string[]; base: string; odd: string; gate: string }> = {
  hira: { rain: ['か', 'ね', 'す'], base: 'め', odd: 'ぬ', gate: 'さ' },
  kata: { rain: ['カ', 'ネ', 'ス'], base: 'ツ', odd: 'シ', gate: 'サ' },
};

function Card({ title, rule, art, best, children }: { title: string; rule: string; art: ReactNode; best: number; children: ReactNode }) {
  return <article className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-border-strong)]">
    <div aria-hidden="true" className="relative h-36 overflow-hidden border-b border-[var(--color-border)]">{art}</div>
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>
        {best > 0 && <span className="text-xs tabular-nums text-[var(--color-text-tertiary)]">Kỷ lục <b className="text-[var(--color-text)]">{best}</b></span>}
      </div>
      <p className="mt-1 flex-1 text-sm text-[var(--color-text-secondary)]">{rule}</p>
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </div>
  </article>;
}

export function GameHub({ onReset, ...props }: Omit<GameProps, 'onExit'> & { onReset: () => void }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const { script, storage } = props;
  const s = SAMPLE[script];
  const exit = () => setChoice(null);

  const drill = (chars: string[]) => setChoice({ game: 'quiz', focus: chars });
  if (choice?.game === 'quiz') return <QuizDrill key={choice.focus?.join('') ?? 'all'} {...props} focus={choice.focus} onReset={onReset} onExit={exit} />;
  if (choice?.game === 'rain') return <KanaRain {...props} onExit={exit} onDrill={drill} />;
  if (choice?.game === 'impostor') return <ImpostorHunt {...props} onExit={exit} onDrill={drill} />;
  if (choice?.game === 'torii') return <ToriiRun {...props} listen={Boolean(choice.listen)} onExit={exit} onDrill={drill} />;

  const play = 'study-button study-button-primary !min-h-10';
  return <div className="rise-group grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <Card title="Trắc nghiệm" best={0}
      rule="Một chữ, bốn cách đọc. Không tính giờ, không mất mạng — ôn chậm và chắc, bấm 1–4 để trả lời nhanh."
      art={<div className="grid h-full place-items-center bg-[var(--color-surface-alt)]">
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] font-jp-serif text-4xl">{s.gate}</span>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {['sa', 'chi', 'ki', 'ra'].map((r, i) => <span key={r} className={'grid h-7 w-10 place-items-center rounded-md border ' + (i === 0 ? 'border-[var(--color-success)] bg-[var(--color-success-subtle)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]')}>{r}</span>)}
          </div>
        </div>
      </div>}>
      <button className="study-button study-button-primary !min-h-10" onClick={() => setChoice({ game: 'quiz' })}>Ôn tập</button>
    </Card>

    <Card title="Mưa chữ" best={readBest(storage, 'rain', script)}
      rule="Chữ rơi từ trên xuống. Gõ romaji để làm vỡ chữ trước khi nó chạm đất — phải tự nhớ ra, không có đáp án để đoán."
      art={<div className="rain-sky absolute inset-0">
        {s.rain.map((ch, i) => <span key={ch} className="absolute grid size-12 place-items-center rounded-full border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] font-jp-serif text-2xl"
          style={{ left: `${18 + i * 30}%`, top: `${[14, 52, 30][i]}%` }}>{ch}</span>)}
        <div className="rain-ground absolute inset-x-0 bottom-0 h-5" />
      </div>}>
      <button className={play} onClick={() => setChoice({ game: 'rain' })}>Chơi</button>
    </Card>

    <Card title="Tìm kẻ mạo danh" best={readBest(storage, 'impostor', script)}
      rule={`Lưới toàn chữ ${s.base} giấu đúng một chữ ${s.odd}. Chỉ dùng các cặp chữ người mới hay nhầm nhất, lưới lớn dần tới 8 × 8.`}
      art={<div className="grid h-full place-items-center bg-[var(--color-surface-alt)]">
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 15 }, (_, i) => <span key={i} className={'grid size-7 place-items-center rounded border font-jp-serif text-base ' + (i === 8 ? 'border-[var(--color-seal)] bg-[var(--color-surface)] text-[var(--color-seal)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]')}>{i === 8 ? s.odd : s.base}</span>)}
        </div>
      </div>}>
      <button className={play} onClick={() => setChoice({ game: 'impostor' })}>Chơi</button>
    </Card>

    <Card title="Chạy qua cổng torii" best={readBest(storage, 'torii', script)}
      rule="Nhìn romaji (hoặc chỉ nghe âm) rồi đổi làn để chạy qua cổng mang đúng chữ. Càng chạy càng nhanh."
      art={<div className="torii-path absolute inset-0">
        <div className="absolute left-1/2 top-3 w-28 -translate-x-1/2"><Torii ch={s.gate} state="idle" /></div>
      </div>}>
      <button className={play} onClick={() => setChoice({ game: 'torii' })}>Chơi</button>
      <button className="study-button !min-h-10" onClick={() => setChoice({ game: 'torii', listen: true })}><Volume2 size={16} /> Chế độ nghe</button>
    </Card>
  </div>;
}
