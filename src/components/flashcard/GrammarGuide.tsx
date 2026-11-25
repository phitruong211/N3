import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from '@/components/ui/icons';
import { PageHeading } from '@/components/ui/StudyUI';
import { useApp } from '@/hooks/useApp';
import type { CardView } from '@/lib/cards';
import { calloutParts, isPatternTable, lessonCards, parseGuide, patternPieces, splitNote, type GuideBlock, type GuideLesson } from '@/lib/grammarGuide';
import n3 from '@/data/guide/N3.md?raw';
import n4 from '@/data/guide/N4.md?raw';
import n2 from '@/data/guide/N2.md?raw';
import './grammarGuide.css';

const SOURCES: Record<string, string> = { N2: n2, N3: n3, N4: n4 };
/** The last tab: every lesson on one page. */
export const REVIEW_ALL = -1;

/** A level's grammar guide: one lesson per tab, a "Tổng ôn" tab with all of them, and each lesson's patterns as flashcards. */
export function GrammarGuide({ level, lesson, onLesson, onStudy, onExit }: {
  level: string; lesson: number; onLesson: (index: number) => void;
  onStudy: (id: string, name: string, cards: CardView[]) => void; onExit: () => void;
}) {
  const { grammar } = useApp();
  const guide = useMemo(() => parseGuide(SOURCES[level] ?? ''), [level]);
  const top = useRef<HTMLDivElement>(null);
  const [hideMeaning, setHideMeaning] = useState(false);
  const all = lesson === REVIEW_ALL;
  // Tổng ôn skips the "how to use this document" intro; the conjugation lesson stays.
  const shown = all ? guide.lessons.filter(item => !item.title.startsWith('Cách dùng')) : guide.lessons.slice(lesson, lesson + 1);
  const cards = useMemo(() => lessonCards(shown, level, grammar), [shown, level, grammar]);
  const total = useMemo(() => lessonCards(guide.lessons, level, grammar).length, [guide, level, grammar]);
  const current = guide.lessons[lesson];

  function go(index: number) {
    onLesson(index);
    top.current?.scrollIntoView({ block: 'start' });
  }
  const study = cards.length > 0 && <button type="button" className="study-button study-button-primary" onClick={() => onStudy(`guide-${level}-${lesson}`, all ? `Tổng ôn ngữ pháp ${level}` : `${level} · ${current.title}`, cards)}>
    Học {cards.length} mẫu bằng thẻ <ChevronRight size={16} aria-hidden="true"/>
  </button>;

  const quiz = <button type="button" className="study-button" aria-pressed={hideMeaning} onClick={() => setHideMeaning(!hideMeaning)}>{hideMeaning ? 'Hiện nghĩa' : 'Che nghĩa để tự kiểm tra'}</button>;
  const patterns = shown.flatMap(item => item.blocks).filter(block => block.kind === 'table' && isPatternTable(block)).reduce((n, block) => n + (block.kind === 'table' ? block.rows.length : 0), 0);

  return <div className="study-page" ref={top} style={{ scrollMarginTop: 72 }}>
    <PageHeading title={`Hướng dẫn ngữ pháp ${level}`} subtitle={`${guide.lessons.length} bài · ${total} mẫu và cặp dễ nhầm`}
      action={<button type="button" className="study-button" onClick={onExit}>← N4–N3</button>}/>
    <div className="guide-layout">
      <nav aria-label="Bài học" className="guide-nav">
        {guide.lessons.map((item, index) => <button key={item.title} type="button" aria-current={index === lesson ? 'page' : undefined} onClick={() => go(index)}>
          <b>{lessonLabel(item.title)}</b><span>{item.title.replace(/^\d+\.\s*/, '')}</span>
        </button>)}
        <button type="button" className="guide-nav-all" aria-current={all ? 'page' : undefined} onClick={() => go(REVIEW_ALL)}><b>Tổng ôn</b><span>Toàn bộ mẫu, dạng danh sách gọn</span></button>
      </nav>
      <article className={'guide-article' + (hideMeaning ? ' guide-quiz' : '')}>
        <header className="guide-lesson-head">
          <p className="study-eyebrow">{all ? `Tổng ôn · ${patterns} mục` : `${lessonLabel(current.title)}${patterns ? ` · ${patterns} mục` : ''}`}</p>
          <h2>{all ? `Ôn nhanh toàn bộ ${level}` : current.title.replace(/^\d+\.\s*/, '')}</h2>
          {all && <p className="guide-lead">Mỗi dòng chỉ giữ mẫu, cách nối và nghĩa. Che nghĩa, tự nói nghĩa trong đầu, rồi chạm vào ô để kiểm tra.</p>}
          {patterns > 0 && <div className="guide-actions">{quiz}{study}</div>}
          {patterns > 0 && <p className="guide-legend" aria-label="Chú thích màu">
            <span className="is-meaning">Nghĩa</span><span className="is-form">Cách nối</span>{!all && <><span className="is-example">Ví dụ</span><span className="is-note">Lưu ý</span></>}
          </p>}
        </header>
        {shown.map(item => <section key={item.title} className="guide-lesson">
          {all && <h3 className="guide-review-title"><span>{lessonLabel(item.title)}</span>{item.title.replace(/^\d+\.\s*/, '')}</h3>}
          <LessonBody lesson={item} compact={all}/>
        </section>)}
        {!all && <footer className="guide-actions guide-foot">
          {lesson > 0 ? <button type="button" className="study-button" onClick={() => go(lesson - 1)}>← {lessonLabel(guide.lessons[lesson - 1].title)}</button> : <span/>}
          {study}
          <button type="button" className="study-button" onClick={() => go(lesson + 1 < guide.lessons.length ? lesson + 1 : REVIEW_ALL)}>
            {lesson + 1 < guide.lessons.length ? lessonLabel(guide.lessons[lesson + 1].title) : 'Tổng ôn'} →
          </button>
        </footer>}
      </article>
    </div>
  </div>;
}

const lessonLabel = (title: string) => /^\d+\./.test(title) ? `Bài ${parseInt(title)}` : title.startsWith('Cách dùng') ? 'Giới thiệu' : title.replace(/^Cách chia thể.*/, 'Chia thể');
const isMeaning = (head: string) => /^(Nghĩa|Khác nhau)/.test(head);

/** Full lessons number their patterns across tables, so "mẫu 7" means the same thing all through a lesson. */
function LessonBody({ lesson, compact }: { lesson: GuideLesson; compact: boolean }) {
  let number = 0;
  return <>{lesson.blocks.map((block, i) => {
    if (compact && block.kind === 'p') return null;
    const first = number + 1;
    if (block.kind === 'table' && isPatternTable(block)) number += block.rows.length;
    // The paragraph right under the title is the lesson's main idea.
    return <Block key={i} block={block} first={first} compact={compact} lead={i === 0 && block.kind === 'p'}/>;
  })}</>;
}

function Block({ block, first, compact, lead }: { block: GuideBlock; first: number; compact: boolean; lead: boolean }) {
  if (block.kind === 'p') {
    const tip = calloutParts(block.text);
    if (lead) return <p className="guide-lead"><b>Ý chính</b>{inline(block.text)}</p>;
    if (tip) return <aside className="guide-tip"><b>{tip[0]}</b>{tip[1] && <span>{inline(tip[1])}</span>}</aside>;
    return <p className="study-copy guide-p">{inline(block.text)}</p>;
  }
  if (block.kind === 'h3') return <h3 className="guide-h3">{block.text}</h3>;
  if (block.kind === 'list') return <ul className="guide-list">{block.items.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul>;
  if (isPatternTable(block)) {
    const column = (test: RegExp) => block.head.findIndex(head => test.test(head));
    const at = { meaning: block.head.findIndex(isMeaning), form: column(/^Cấu trúc/), example: column(/^Ví dụ/) };
    const others = block.head.map((head, i) => i).filter(i => i > 0 && !Object.values(at).includes(i));
    if (compact) return <ol className="guide-review" start={first}>{block.rows.map((row, i) => <li key={i}>
      <span className="guide-review-pattern"><b className="font-jp-serif">{pair(row[0])}</b>{at.form > 0 && <small className="font-jp">{row[at.form]}</small>}</span>
      <span className="guide-meaning" tabIndex={0}>{inline(splitNote(row[at.meaning] ?? '')[0])}</span>
    </li>)}</ol>;
    return <ol className="guide-patterns" start={first} style={{ counterReset: `pattern ${first - 1}` }}>{block.rows.map((row, i) => {
      const [meaning, note] = splitNote(row[at.meaning] ?? '');
      const points = meaning.split(/(?<=\.)\s+/);
      return <li key={i} className="guide-pattern">
        <h4 className="font-jp-serif">{pair(row[0])}</h4>
        <div className="guide-meaning" tabIndex={0}>
          {points.length > 1 ? <ul className="guide-points">{points.map((point, j) => <li key={j}>{inline(point)}</li>)}</ul> : <p className="guide-pattern-meaning">{inline(meaning)}</p>}
          {note && <p className="guide-pattern-note">{inline(note)}</p>}
        </div>
        {at.form > 0 && row[at.form] && <p className="guide-form"><span>Cách nối</span><code className="font-jp">{row[at.form]}</code></p>}
        {others.map(j => row[j] && <p key={j} className="guide-form"><span>{block.head[j]}</span><span>{inline(row[j])}</span></p>)}
        {at.example > 0 && row[at.example] && <div className="guide-examples">{row[at.example].split(' / ').map((example, j) => {
          const [sentence, aside] = splitNote(example);
          return <p key={j}><span className="font-jp">{mark(sentence, patternPieces(block.head[0] === 'Cặp' ? row[0].replace(/\s+vs\s+/g, ' / ') : row[0]))}</span>{aside && <small>{aside}</small>}</p>;
        })}</div>}
      </li>;
    })}</ol>;
  }
  return <div className="guide-table-wrap"><table className="guide-table">
    <thead><tr>{block.head.map(head => <th key={head} scope="col">{head}</th>)}</tr></thead>
    <tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{inline(cell)}</td>)}</tr>)}</tbody>
  </table></div>;
}

/** "おかげで vs せいで": the "vs" set apart so each side of a confusable pair reads on its own. */
function pair(text: string): ReactNode {
  // "〜うちに (thay đổi)": a Vietnamese aside becomes a small tag; "(に)" is part of the pattern and stays.
  const [name, aside] = splitNote(text);
  if (aside && /[a-zà-ỹ]/i.test(aside)) return <>{name}<span className="guide-tag">{aside}</span></>;
  const sides = text.split(/\s+vs\s+/);
  return sides.length < 2 ? text : sides.map((side, i) => <Fragment key={i}>{i > 0 && <span className="guide-vs">vs</span>}{side}</Fragment>);
}

/** Marks each piece of the pattern where it appears in its example sentence. */
function mark(sentence: string, pieces: string[]): ReactNode[] {
  if (!pieces.length) return [sentence];
  const escaped = [...pieces].sort((a, b) => b.length - a.length).map(piece => piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return sentence.split(new RegExp(`(${escaped.join('|')})`)).map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : part);
}

/** **bold** and [text](https://…) — the only inline markup the guides use. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https:\/\/[^)\s]+\))/).map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return /^\*\*.+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part;
  });
}
