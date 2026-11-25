import { Fragment, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from '@/components/ui/icons';
import { PageHeading } from '@/components/ui/StudyUI';
import { onDemand } from '@/components/ui/onDemand';
import { AppLoading } from '@/components/ui/AppLoading';
import { StudySession } from '@/components/flashcard/LazyStudySession';
import { useLearningStorage } from '@/hooks/useApp';
import { defaultDeckTemplate } from '@/lib/ankiImport';
import type { CardView } from '@/lib/cards';
import { formParts, locate, type LessonGroup, type LessonPattern } from '@/lib/lessons';
import data from '@/data/lessons/n4n3.json';
import './lessons.css';

// N2 has no N4–N3-style lessons yet, so it keeps the older markdown guide.
const GrammarGuide = onDemand(() => import('@/components/flashcard/GrammarGuide').then(module => module.GrammarGuide), <AppLoading message="Đang mở bài học…"/>);

const GROUPS = data as LessonGroup[];
const TOTAL = GROUPS.reduce((n, g) => n + g.pats.length, 0);
const GROUP_KEY = 'lessons-group-v1';
type Level = 'all' | 'N4' | 'N3';

/** Grammar lessons: topic groups on the left, the chosen group's patterns as cards that open on tap. */
export function LessonsPage() {
  const { getJSON, setJSON } = useLearningStorage();
  const top = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(() => {
    const saved = getJSON<number | null>(GROUP_KEY, null);
    return GROUPS.some(g => g.id === saved) ? saved : GROUPS[0].id;
  });
  const [level, setLevel] = useState<Level>('all');
  const [n2, setN2] = useState<{ lesson: number } | null>(null);
  const [session, setSession] = useState<{ name: string; cards: CardView[] } | null>(null);

  if (session) return <StudySession cards={session.cards} deckName={session.name} template={defaultDeckTemplate()} mode="flashcards" initialIndex={0} onExit={() => setSession(null)}/>;
  if (n2) return <GrammarGuide level="N2" lesson={n2.lesson} onLesson={lesson => setN2({ lesson })} onExit={() => setN2(null)} onStudy={(_id, name, cards) => setSession({ name, cards })}/>;

  const group = GROUPS.find(g => g.id === current) ?? GROUPS[0];
  const pats = group.pats.filter(p => level === 'all' || p.lv.includes(level));
  const subs = [...new Set(pats.map(p => p.sub))];

  function choose(id: number) {
    setCurrent(id);
    setJSON(GROUP_KEY, id);
    top.current?.scrollIntoView({ block: 'start' });
  }

  return <div className="study-page">
    <PageHeading title="Bài giảng ngữ pháp N4–N3" subtitle={`${GROUPS.length} nhóm · ${TOTAL} mẫu · bấm vào mẫu để xem cách nối, nghĩa và ví dụ`}
      action={<button type="button" className="study-button" onClick={() => setN2({ lesson: 0 })}>Ngữ pháp N2 <ChevronRight size={16} aria-hidden="true"/></button>}/>
    <div className="lesson-layout">
      <nav className="lesson-groups" aria-label="Nhóm ngữ pháp">
        {GROUPS.map(g => <button key={g.id} type="button" aria-pressed={g.id === group.id} onClick={() => choose(g.id)}>
          <span>{g.id - 1}. {g.short}</span><small>{g.pats.length}</small>
        </button>)}
      </nav>
      <article className="lesson-body" ref={top} style={{ scrollMarginTop: 80 }}>
        <h2>{group.id - 1}. {group.name}</h2>
        <p className="lesson-lead">{rich(group.intro)}</p>
        {(group.pic.length > 0 || group.note.length > 0) && <div className="lesson-pic">
          <strong>Hình ảnh để nhớ</strong>
          {group.pic.length > 0 && <p>{rich(group.pic[0])}</p>}
          {group.pic.length > 1 && <ul>{group.pic.slice(1).map((x, i) => <li key={i}>{rich(x)}</li>)}</ul>}
          {group.note.map(([head, text], i) => <p key={i}>{head && <b>{head}: </b>}{rich(text)}</p>)}
        </div>}
        <div className="lesson-tools" role="group" aria-label="Lọc theo trình độ">
          {(['all', 'N4', 'N3'] as const).map(item => <button key={item} type="button" className="lesson-pill" aria-pressed={level === item} onClick={() => setLevel(item)}>{item === 'all' ? 'Tất cả' : item}</button>)}
        </div>
        <p className="lesson-legend">Nhãn nối: <span><Chip kind="v">V</Chip> động từ</span><span><Chip kind="n">N</Chip> danh từ</span><span><Chip kind="a">A</Chip> tính từ</span><span><Chip kind="p">名詞修飾形</Chip> như thể thường nhưng Aな→な, N→の</span></p>
        {subs.map(sub => <Fragment key={sub}>
          {sub && <h3>{sub}</h3>}
          <div className="lesson-cards">{pats.filter(p => p.sub === sub).map(p => <PatternCard key={p.id} p={p}/>)}</div>
        </Fragment>)}
        {group.keigo.length > 0 && <>
          <h3>Động từ kính ngữ đặc biệt</h3>
          <div className="lesson-table"><table>
            <thead><tr><th scope="col">Động từ</th><th scope="col">Tôn kính (nâng người trên)</th><th scope="col">Khiêm nhường (hạ mình)</th></tr></thead>
            <tbody lang="ja" className="font-jp">{group.keigo.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
          </table></div>
        </>}
        {group.pairs.length > 0 && <details className="lesson-compare">
          <summary>So sánh các mẫu dễ nhầm trong nhóm</summary>
          <p className="lesson-small">Nên học từng mẫu riêng trước rồi mới so sánh, vì gặp các mẫu gần nghĩa cùng lúc dễ bị lẫn.</p>
          {(group.remember || group.tip) && <div className="lesson-rules">
            {group.remember && <div><strong>Nhớ nhanh</strong>{rich(group.remember)}</div>}
            {group.tip && <div><strong>Mẹo chọn đáp án</strong>{rich(group.tip)}</div>}
          </div>}
          <div className="lesson-pairs">{group.pairs.map(pair => <div key={pair.t} className="lesson-pair">
            <h4 lang="ja" className="font-jp">{pair.t}</h4>
            <p>{rich(pair.d)}</p>
            <ul lang="ja" className="font-jp">{pair.e.split(/\s+\/\s+/).map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>)}</div>
        </details>}
      </article>
    </div>
  </div>;
}

function PatternCard({ p }: { p: LessonPattern }) {
  const at = locate(p);
  return <details className="lesson-card">
    <summary>
      <span lang="ja" className="lesson-name font-jp">{p.n}</span>
      <span className={'lesson-lv' + (p.lv.includes('N3') ? ' is-n3' : '')}>{p.lv}</span>
      {p.note && <span className="lesson-note">{p.note}</span>}
    </summary>
    <div className="lesson-more">
      {p.f && <p className="lesson-form">{formParts(p.f).map((part, i) => part.kind ? <Chip key={i} kind={part.kind}>{part.text}</Chip> : <span key={i}>{part.text}</span>)}</p>}
      <p className="lesson-meaning">{rich(p.m)}</p>
      <p className="lesson-ex font-jp" lang="ja">{at ? <>{p.jp.slice(0, at[0])}<mark>{p.jp.slice(at[0], at[0] + at[1])}</mark>{p.jp.slice(at[0] + at[1])}</> : p.jp}</p>
      <p className="lesson-vn">{rich(p.vn)}</p>
    </div>
  </details>;
}

const Chip = ({ kind, children }: { kind: string; children: ReactNode }) => <span className={`lesson-chip is-${kind} font-jp`} lang="ja">{children}</span>;

/** The lesson text marks emphasis with <b> and nothing else. */
const rich = (text: string): ReactNode[] => text.split(/<b>(.*?)<\/b>/).map((part, i) => i % 2 ? <b key={i}>{part}</b> : part);
