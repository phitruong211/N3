import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from '@/components/ui/icons';
import { PageHeading } from '@/components/ui/StudyUI';
import { useApp } from '@/hooks/useApp';
import type { CardView } from '@/lib/cards';
import { isPatternTable, lessonCards, parseGuide, type GuideBlock, type GuideLesson } from '@/lib/grammarGuide';
import n3 from '@/data/guide/N3.md?raw';
import n4 from '@/data/guide/N4.md?raw';
import './grammarGuide.css';

const SOURCES: Record<string, string> = { N3: n3, N4: n4 };
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

  return <div className="study-page" ref={top} style={{ scrollMarginTop: 72 }}>
    <PageHeading title={`Hướng dẫn ngữ pháp ${level}`} subtitle={`${guide.lessons.length} bài · ${total} mẫu và cặp dễ nhầm`}
      action={<button type="button" className="study-button" onClick={onExit}>← Bộ thẻ</button>}/>
    <div className="guide-layout">
      <nav aria-label="Bài học" className="guide-nav">
        {guide.lessons.map((item, index) => <button key={item.title} type="button" aria-current={index === lesson ? 'page' : undefined} onClick={() => go(index)}>
          <b>{lessonLabel(item.title)}</b><span>{item.title.replace(/^\d+\.\s*/, '')}</span>
        </button>)}
        <button type="button" className="guide-nav-all" aria-current={all ? 'page' : undefined} onClick={() => go(REVIEW_ALL)}><b>Tổng ôn</b><span>Toàn bộ {guide.lessons.length} bài</span></button>
      </nav>
      <article className={'guide-article' + (hideMeaning ? ' guide-quiz' : '')}>
        {all ? <header className="guide-head">
          <h2>Tổng ôn {level}</h2>
          <p className="study-copy">Toàn bộ bài trên một trang. Bật “Che nghĩa” để tự kiểm tra: nghĩ trước, rồi chạm vào ô để xem.</p>
          <div className="guide-actions">
            <button type="button" className="study-button" aria-pressed={hideMeaning} onClick={() => setHideMeaning(!hideMeaning)}>{hideMeaning ? 'Hiện nghĩa' : 'Che nghĩa'}</button>
            {study}
          </div>
        </header> : <h2 className="guide-head">{current.title}</h2>}
        {shown.map(item => <Fragment key={item.title}>
          {all && <h2 className="guide-section-title">{item.title}</h2>}
          <LessonBody lesson={item}/>
        </Fragment>)}
        {!all && <footer className="guide-actions guide-foot">
          {lesson > 0 && <button type="button" className="study-button" onClick={() => go(lesson - 1)}>← {lessonLabel(guide.lessons[lesson - 1].title)}</button>}
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

function LessonBody({ lesson }: { lesson: GuideLesson }) {
  return <>{lesson.blocks.map((block, i) => <Block key={i} block={block}/>)}</>;
}

function Block({ block }: { block: GuideBlock }) {
  if (block.kind === 'p') return <p className="study-copy guide-p">{inline(block.text)}</p>;
  if (block.kind === 'h3') return <h3 className="guide-h3">{block.text}</h3>;
  if (block.kind === 'list') return <ul className="guide-list">{block.items.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul>;
  if (block.kind === 'table' && isPatternTable(block)) return <ul className="guide-patterns">{block.rows.map((row, i) => <li key={i} className="guide-pattern">
    <h4 className="font-jp-serif">{row[0]}</h4>
    <dl>{block.head.slice(1).map((head, j) => row[j + 1] && <div key={head} className={/^(Nghĩa|Khác nhau)/.test(head) ? 'guide-meaning' : undefined} tabIndex={/^(Nghĩa|Khác nhau)/.test(head) ? 0 : undefined}>
      <dt>{head}</dt><dd className={/^Ví dụ/.test(head) ? 'font-jp' : undefined}>{inline(row[j + 1])}</dd>
    </div>)}</dl>
  </li>)}</ul>;
  return <div className="guide-table-wrap"><table className="guide-table">
    <thead><tr>{block.head.map(head => <th key={head} scope="col">{head}</th>)}</tr></thead>
    <tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{inline(cell)}</td>)}</tr>)}</tbody>
  </table></div>;
}

/** **bold** and [text](https://…) — the only inline markup the guides use. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https:\/\/[^)\s]+\))/).map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return /^\*\*.+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part;
  });
}
