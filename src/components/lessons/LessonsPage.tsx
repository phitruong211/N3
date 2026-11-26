import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from '@/components/ui/icons';
import { PageHeading } from '@/components/ui/StudyUI';
import { onDemand } from '@/components/ui/onDemand';
import { AppLoading } from '@/components/ui/AppLoading';
import { StudySession } from '@/components/flashcard/LazyStudySession';
import { useLearningStorage } from '@/hooks/useApp';
import { defaultDeckTemplate } from '@/lib/ankiImport';
import type { CardView } from '@/lib/cards';
import { formParts, locate, pairSection, type LessonGroup, type LessonPair, type LessonPattern, type LessonQuiz, type LessonStar, type LessonTop } from '@/lib/lessons';
import data from '@/data/lessons/n4n3.json';
import checks from '@/data/lessons/n4n3-check.json';
import './lessons.css';

// N2 has no N4–N3-style lessons yet, so it keeps the older markdown guide.
const GrammarGuide = onDemand(() => import('@/components/flashcard/GrammarGuide').then(module => module.GrammarGuide), <AppLoading message="Đang mở bài học…"/>);

const GROUPS = data as LessonGroup[];
const CHECKS = checks as { quiz: LessonQuiz[]; star: LessonStar[]; top: LessonTop[] };
const TOTAL = GROUPS.reduce((n, g) => n + g.pats.length, 0);
const GROUP_KEY = 'lessons-group-v1';
const SCORE_KEY = 'lessons-score-v1';
/** The "15 cặp hay ra thi" page; lesson ids start at 2. */
const TOP_VIEW = 0;
type Level = 'all' | 'N4' | 'N3';
type Scores = Record<number, { right: number; total: number }>;

/** Grammar lessons: topic groups on the left; each lesson teaches, compares, then tests. */
export function LessonsPage() {
  const { getJSON, setJSON } = useLearningStorage();
  const top = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(() => {
    const saved = getJSON<number | null>(GROUP_KEY, null);
    return saved === TOP_VIEW || GROUPS.some(g => g.id === saved) ? saved : GROUPS[0].id;
  });
  const [scores, setScores] = useState<Scores>(() => getJSON<Scores>(SCORE_KEY, {}) ?? {});
  const [n2, setN2] = useState<{ lesson: number } | null>(null);
  const [session, setSession] = useState<{ name: string; cards: CardView[] } | null>(null);

  if (session) return <StudySession cards={session.cards} deckName={session.name} template={defaultDeckTemplate()} mode="flashcards" initialIndex={0} onExit={() => setSession(null)}/>;
  if (n2) return <GrammarGuide level="N2" lesson={n2.lesson} onLesson={lesson => setN2({ lesson })} onExit={() => setN2(null)} onStudy={(_id, name, cards) => setSession({ name, cards })}/>;

  const group = GROUPS.find(g => g.id === current);

  function choose(id: number) {
    setCurrent(id);
    setJSON(GROUP_KEY, id);
    top.current?.scrollIntoView({ block: 'start' });
  }
  function score(id: number, right: number, total: number) {
    // Keep the best try: the list shows how far each lesson has been mastered.
    if ((scores[id]?.right ?? -1) > right) return;
    const next = { ...scores, [id]: { right, total } };
    setScores(next);
    setJSON(SCORE_KEY, next);
  }

  return <div className="study-page">
    <PageHeading title="Bài giảng ngữ pháp N4–N3" subtitle={`${GROUPS.length} bài · ${TOTAL} mẫu · mỗi bài: học mẫu → phân biệt → tự kiểm tra`}
      action={<button type="button" className="study-button" onClick={() => setN2({ lesson: 0 })}>Ngữ pháp N2 <ChevronRight size={16} aria-hidden="true"/></button>}/>
    <div className="lesson-layout">
      <nav className="lesson-groups" aria-label="Bài học">
        {GROUPS.map(g => {
          const s = scores[g.id];
          return <button key={g.id} type="button" aria-pressed={g.id === current} onClick={() => choose(g.id)}>
            <span>{g.id - 1}. {g.short}</span>
            {s ? <small className={s.right / s.total >= .8 ? 'is-done' : undefined}>✓ {s.right}/{s.total}<span className="sr-only"> câu đúng</span></small> : <small>{g.pats.length}<span className="sr-only"> mẫu</span></small>}
          </button>;
        })}
        <button type="button" className="lesson-groups-top" aria-pressed={current === TOP_VIEW} onClick={() => choose(TOP_VIEW)}><span>★ 15 cặp hay ra thi</span></button>
      </nav>
      <article className="lesson-body" ref={top} style={{ scrollMarginTop: 80 }}>
        {group ? <Lesson key={group.id} group={group} onGo={choose} onScore={(right, total) => score(group.id, right, total)}/> : <TopPairs onGo={choose}/>}
      </article>
    </div>
  </div>;
}

function Lesson({ group, onGo, onScore }: { group: LessonGroup; onGo: (id: number) => void; onScore: (right: number, total: number) => void }) {
  const [level, setLevel] = useState<Level>('all');
  const [examples, setExamples] = useState(false);
  const sections = [...new Set(group.pats.map(p => p.sub))];
  const pats = group.pats.filter(p => level === 'all' || p.lv.includes(level));
  const pairs = useMemo(() => {
    const bySection = new Map<string | null, LessonPair[]>();
    for (const pair of group.pairs) {
      const at = pairSection(pair, group.pats);
      bySection.set(at, [...(bySection.get(at) ?? []), pair]);
    }
    return bySection;
  }, [group]);
  const keys = CHECKS.top.filter(t => t.g === group.id);
  const quiz = CHECKS.quiz.filter(q => q.g === group.id);
  const star = CHECKS.star.filter(q => q.g === group.id);
  const at = GROUPS.indexOf(group);
  const prev = GROUPS[at - 1], next = GROUPS[at + 1];
  const levels = { N4: group.pats.filter(p => p.lv === 'N4').length, N3: group.pats.filter(p => p.lv !== 'N4').length };

  return <>
    <header className="lesson-head">
      <p className="study-eyebrow">Bài {group.id - 1}/{GROUPS.length} · {levels.N4} mẫu N4 · {levels.N3} mẫu N3</p>
      <h2>{group.name}</h2>
      <p className="lesson-lead">{rich(group.intro)}</p>
    </header>

    <div className="lesson-plan">
      <strong>Lộ trình bài học</strong>
      <ol>
        {sections.map((sub, i) => <li key={sub}><button type="button" onClick={() => jump(`sec-${i}`)}>{sub || 'Các mẫu trong bài'}</button><small>{group.pats.filter(p => p.sub === sub).length} mẫu{pairs.get(sub)?.length ? ` · ${pairs.get(sub).length} cặp so sánh` : ''}</small></li>)}
        <li><button type="button" onClick={() => jump('sec-choose')}>Tổng kết: chọn mẫu nào khi làm bài</button></li>
        <li><button type="button" onClick={() => jump('sec-check')}>Tự kiểm tra</button><small>{quiz.length + star.length} câu theo dạng đề</small></li>
      </ol>
      {group.pairs.length > 0 && <p className="lesson-goal"><b>Học xong bài này, bạn phân biệt được:</b> {group.pairs.map(pair => <span key={pair.t} lang="ja" className="lesson-goal-pair font-jp">{pair.t}</span>)}</p>}
    </div>

    {(group.pic.length > 0 || group.note.length > 0) && <div className="lesson-pic">
      <strong>Hình ảnh để nhớ</strong>
      {group.pic.length > 0 && <p>{rich(group.pic[0])}</p>}
      {group.pic.length > 1 && <ul>{group.pic.slice(1).map((x, i) => <li key={i}>{rich(x)}</li>)}</ul>}
      {group.note.map(([head, text], i) => <p key={i}>{head && <b>{head}: </b>}{rich(text)}</p>)}
    </div>}

    <div className="lesson-tools" role="group" aria-label="Lọc theo trình độ">
      {(['all', 'N4', 'N3'] as const).map(item => <button key={item} type="button" className="lesson-pill" aria-pressed={level === item} onClick={() => setLevel(item)}>{item === 'all' ? 'Tất cả' : item}</button>)}
      <button type="button" className="lesson-pill" aria-pressed={examples} onClick={() => setExamples(!examples)}>{examples ? 'Thu gọn ví dụ' : 'Hiện tất cả ví dụ'}</button>
    </div>
    <p className="lesson-legend">Nhãn nối: <span><Chip kind="v">V</Chip> động từ</span><span><Chip kind="n">N</Chip> danh từ</span><span><Chip kind="a">A</Chip> tính từ</span><span><Chip kind="p">名詞修飾形</Chip> như thể thường nhưng Aな→な, N→の</span></p>

    {sections.map((sub, i) => {
      const shown = pats.filter(p => p.sub === sub);
      const contrast = pairs.get(sub) ?? [];
      return <section key={sub} id={`sec-${i}`} className="lesson-section">
        <h3 className="lesson-h3"><span>Phần {i + 1}</span>{sub || 'Các mẫu trong bài'}</h3>
        {shown.length ? <Patterns pats={shown} open={examples}/> : <p className="lesson-small">Phần này không có mẫu {level}.</p>}
        {contrast.length > 0 && <div className="lesson-contrast">
          <p className="lesson-kicker">Phân biệt các mẫu dễ nhầm</p>
          {contrast.map(pair => <PairCard key={pair.t} pair={pair}/>)}
        </div>}
      </section>;
    })}

    {group.keigo.length > 0 && <section className="lesson-section">
      <h3 className="lesson-h3"><span>Bảng</span>Động từ kính ngữ đặc biệt</h3>
      <div className="lesson-table"><table>
        <thead><tr><th scope="col">Động từ</th><th scope="col">Tôn kính (nâng người trên)</th><th scope="col">Khiêm nhường (hạ mình)</th></tr></thead>
        <tbody lang="ja" className="font-jp">{group.keigo.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
      </table></div>
    </section>}

    <section id="sec-choose" className="lesson-section">
      <h3 className="lesson-h3"><span>Tổng kết</span>Chọn mẫu nào khi làm bài?</h3>
      {keys.length > 0 && <div className="lesson-keys">{keys.map(key => <div key={key.t} className="lesson-key">
        <span className="lesson-badge">Hay ra thi</span>
        <b lang="ja" className="font-jp">{key.t}</b>
        <p><span>Tự hỏi:</span> {key.q}</p>
      </div>)}</div>}
      {(group.remember || group.tip) && <div className="lesson-rules">
        {group.remember && <div><strong>Nhớ nhanh</strong>{rich(group.remember)}</div>}
        {group.tip && <div><strong>Mẹo chọn đáp án</strong>{rich(group.tip)}</div>}
      </div>}
      {pairs.get(null)?.map(pair => <PairCard key={pair.t} pair={pair}/>)}
      {!keys.length && !group.remember && !group.tip && !pairs.get(null) && <p className="lesson-small">Xem lại các ô "Phân biệt" ở từng phần phía trên.</p>}
    </section>

    <section id="sec-check" className="lesson-section">
      <h3 className="lesson-h3"><span>Tự kiểm tra</span>Làm thử theo dạng đề N3</h3>
      {quiz.length + star.length ? <Check quiz={quiz} star={star} onScore={onScore}/> : <p className="lesson-small">Bài này chưa có câu kiểm tra.</p>}
    </section>

    <footer className="lesson-foot">
      {prev ? <button type="button" className="study-button" onClick={() => onGo(prev.id)}>← Bài {prev.id - 1}. {prev.short}</button> : <span/>}
      <button type="button" className="study-button" onClick={() => onGo(next ? next.id : TOP_VIEW)}>{next ? `Bài ${next.id - 1}. ${next.short}` : '15 cặp hay ra thi'} →</button>
    </footer>
  </>;
}

/** A part's patterns as rows: name, how it connects and meaning stay side by side to compare; a tap opens the example. */
function Patterns({ pats, open }: { pats: LessonPattern[]; open: boolean }) {
  return <div className="lesson-rows">
    <div className="lesson-rows-head" aria-hidden="true"><span>Mẫu</span><span>Nối với</span><span>Nghĩa</span></div>
    {/* The key remounts each row when "show all" flips, since <details> keeps its own open state. */}
    {pats.map(p => <PatternRow key={`${p.id}-${open}`} p={p} open={open}/>)}
  </div>;
}

function PatternRow({ p, open }: { p: LessonPattern; open: boolean }) {
  const at = locate(p);
  return <details className="lesson-row" open={open}>
    <summary>
      <span className="lesson-row-name">
        <span lang="ja" className="lesson-name font-jp">{p.n}</span>
        <span className={'lesson-lv' + (p.lv.includes('N3') ? ' is-n3' : '')}>{p.lv}</span>
        {p.note && <small className="lesson-note">{p.note}</small>}
      </span>
      <span className="lesson-row-form">{p.f && <Form f={p.f}/>}</span>
      <span className="lesson-meaning">{rich(p.m)}</span>
    </summary>
    <div className="lesson-row-ex">
      <p className="lesson-ex font-jp" lang="ja">{at ? <>{p.jp.slice(0, at[0])}<mark>{p.jp.slice(at[0], at[0] + at[1])}</mark>{p.jp.slice(at[0] + at[1])}</> : p.jp}</p>
      <p className="lesson-vn">{rich(p.vn)}</p>
    </div>
  </details>;
}

/** A confusable pair: what tells the sides apart, then examples side by side (✓ right, ✗ wrong). */
function PairCard({ pair }: { pair: LessonPair }) {
  return <div className="lesson-pair">
    <h4 lang="ja" className="font-jp">{pair.t.split(/\s+vs\s+/).map((side, i) => <Fragment key={i}>{i > 0 && <span className="lesson-vs">vs</span>}{side}</Fragment>)}</h4>
    <ul className="lesson-diff">{pair.d.split(/(?<=\.)\s+/).map((point, i) => {
      const label = point.match(/^([^:]{1,30}):\s+(.*)$/);
      return <li key={i}>{label && /[぀-ヿ一-鿿]/.test(label[1]) ? <><b className="font-jp">{label[1]}</b>{rich(label[2])}</> : rich(point)}</li>;
    })}</ul>
    <ul className="lesson-pair-ex font-jp">{pair.e.split(/\s+\/\s+/).map((example, i) => <li key={i} className={example.includes('✗') ? 'is-wrong' : example.includes('✓') ? 'is-right' : undefined}>{example}</li>)}</ul>
  </div>;
}

type Item = { key: string; star: boolean; prompt: ReactNode; options: string[]; answer: string; why: string; vi: string };
const shuffle = <T,>(items: T[]) => items.map(item => [Math.random(), item] as const).sort((a, b) => a[0] - b[0]).map(([, item]) => item);
function items(quiz: LessonQuiz[], star: LessonStar[]): Item[] {
  const blank = (text: string) => text.split('（　）').flatMap((part, i) => i ? [<span key={i} className="lesson-blank">（　　）</span>, part] : [part]);
  return [
    ...quiz.map((q, i) => ({ key: `q${i}`, star: false, prompt: blank(q.q), options: shuffle(q.o), answer: q.o[0], why: q.w, vi: q.t })),
    ...star.map((q, i) => ({
      key: `s${i}`, star: true, options: shuffle(q.c), answer: q.c[q.s], vi: q.t,
      prompt: <>{q.pre}{q.c.map((_, j) => <span key={j} className={'lesson-slot' + (j === q.s ? ' is-star' : '')}>{j === q.s ? '★' : ''}</span>)}{q.post}</>,
      why: `Thứ tự đúng: ${q.pre}${q.c.join('')}${q.post}`,
    })),
  ];
}

/** Exam-style questions with an explanation after each, then a verdict on the whole lesson. */
function Check({ quiz, star, onScore }: { quiz: LessonQuiz[]; star: LessonStar[]; onScore: (right: number, total: number) => void }) {
  const [list, setList] = useState(() => items(quiz, star));
  const [picked, setPicked] = useState<Record<string, string>>({});
  const right = list.filter(item => picked[item.key] === item.answer).length;
  const done = Object.keys(picked).length;

  function pick(item: Item, option: string) {
    if (picked[item.key]) return;
    const next = { ...picked, [item.key]: option };
    setPicked(next);
    if (Object.keys(next).length === list.length) onScore(list.filter(entry => next[entry.key] === entry.answer).length, list.length);
  }
  function again() { setList(items(quiz, star)); setPicked({}); }

  return <>
    <p className="lesson-small">Chọn đáp án; mỗi câu có giải thích ngay sau khi chọn. <b>Đã làm {done}/{list.length} · đúng {right}</b></p>
    <ol className="lesson-quiz">{list.map(item => {
      const chosen = picked[item.key];
      return <li key={item.key}>
        {item.star && <p className="lesson-kicker">Sắp xếp câu: phần nào vào ô ★?</p>}
        <p className="lesson-q font-jp" lang="ja">{item.prompt}</p>
        <div className="lesson-opts">{item.options.map((option, k) => <button key={option} type="button" lang="ja" disabled={Boolean(chosen)} onClick={() => pick(item, option)}
          className={'font-jp' + (chosen ? option === item.answer ? ' is-right' : option === chosen ? ' is-wrong' : '' : '')}><span>{k + 1}</span>{option}</button>)}</div>
        {chosen && <div className="lesson-why" role="status">
          <b className={chosen === item.answer ? 'is-right' : 'is-wrong'}>{chosen === item.answer ? 'Đúng' : <>Chưa đúng · đáp án: <span lang="ja" className="font-jp">{item.answer}</span></>}</b>
          <p>{item.why}</p>
          <p className="lesson-vn">{item.vi}</p>
        </div>}
      </li>;
    })}</ol>
    {done === list.length && <div className="lesson-result" role="status">
      <p className="lesson-score">{right}/{list.length}</p>
      <p>{right / list.length >= .8 ? 'Vững. Sang bài tiếp theo được rồi.' : right / list.length >= .5 ? 'Khá. Đọc lại các ô "Phân biệt" ở những câu sai, rồi làm lại.' : 'Chưa vững. Nên đọc lại bài từ phần 1 rồi làm lại.'}</p>
      <button type="button" className="study-button" onClick={again}>Làm lại (đổi thứ tự đáp án)</button>
    </div>}
  </>;
}

/** Every lesson's most-tested pairs on one page, each with the question that settles it. */
function TopPairs({ onGo }: { onGo: (id: number) => void }) {
  return <>
    <header className="lesson-head">
      <p className="study-eyebrow">Ôn tổng hợp</p>
      <h2>15 cặp hay ra thi nhất</h2>
      <p className="lesson-lead">Đề N3 hay bắt chọn giữa các mẫu gần nghĩa. Mỗi cặp chỉ cần nhớ <b>một câu hỏi tự kiểm tra</b>: trả lời được câu đó là chọn đúng.</p>
    </header>
    <ol className="lesson-top">{CHECKS.top.map(key => {
      const group = GROUPS.find(g => g.id === key.g);
      return <li key={key.t}>
        <b lang="ja" className="font-jp">{key.t}</b>
        <p>{key.q}</p>
        <button type="button" className="lesson-go" onClick={() => onGo(key.g)}>Học bài {key.g - 1}. {group?.short} →</button>
      </li>;
    })}</ol>
  </>;
}

const Form = ({ f }: { f: string }) => <span className="lesson-form">{formParts(f).map((part, i) => part.kind ? <Chip key={i} kind={part.kind}>{part.text}</Chip> : <span key={i}>{part.text}</span>)}</span>;
const Chip = ({ kind, children }: { kind: string; children: ReactNode }) => <span className={`lesson-chip is-${kind} font-jp`} lang="ja">{children}</span>;

/** The lesson text marks emphasis with <b> and nothing else. */
const rich = (text: string): ReactNode[] => text.split(/<b>(.*?)<\/b>/).map((part, i) => i % 2 ? <b key={i}>{part}</b> : part);
const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
