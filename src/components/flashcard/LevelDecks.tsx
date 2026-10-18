import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { builtInLevels, type DeckKind, type DeckLevel } from '@/lib/deckCatalog';
import { initialLevel, KIND_GLYPH, KIND_TILT, learnedPercent, levelTabLabel, nextTabIndex, summarizeLevel } from '@/lib/levelDecks';
import type { LearningStorage } from '@/lib/storage';
import './levelDecks.css';

export type LevelRow = {
  id: string; level: DeckLevel; kind: DeckKind;
  totalCards: number; learnedCount: number; dueCount: number;
  /** False when there is nothing to open (no cards, or nothing left to review today). */
  startable: boolean;
  /** Free-study verb shown on the row. */
  actionLabel: string;
  onOpen: () => void;
};

/** Each kind is a hanko-style seal: its Han character (shared with the Today library) in its own hue. */
const KINDS = {
  vocabulary: { label: 'Từ vựng', tone: 'var(--color-accent)' },
  kanji: { label: 'Kanji', tone: 'var(--color-kanji)' },
  grammar: { label: 'Ngữ pháp', tone: 'var(--color-grammar)' },
} as const;
const LEVEL_KEY = 'deck-level-v1';
const count = (value: number) => value.toLocaleString('vi-VN');

/** Pick one level, then see its decks with progress and what is waiting; replaces four stacked lists. */
export function LevelDecks({ mode, rows, storage }: { mode: 'free' | 'scheduled'; rows: LevelRow[]; storage: Pick<LearningStorage, 'getJSON' | 'setJSON'> }) {
  const uid = useId();
  const scheduled = mode === 'scheduled';
  const levels = useMemo(() => builtInLevels.filter(level => rows.some(row => row.level === level)), [rows]);
  const summaries = useMemo(() => Object.fromEntries(levels.map(level => [level, summarizeLevel(rows.filter(row => row.level === level))])), [levels, rows]);
  const [chosen, setChosen] = useState<DeckLevel | undefined>(() => {
    let saved: unknown = null;
    try { saved = storage.getJSON<string | null>(LEVEL_KEY, null); } catch { /* Fall back to the computed level. */ }
    return initialLevel(levels, saved, summaries, scheduled);
  });
  if (!levels.length) return null;
  const level = chosen && levels.includes(chosen) ? chosen : levels[0];
  const visible = rows.filter(row => row.level === level);

  function choose(next: DeckLevel) {
    setChosen(next);
    try { storage.setJSON(LEVEL_KEY, next); } catch { /* Remembering the level is a convenience only. */ }
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = nextTabIndex(event.key, levels.indexOf(level), levels.length);
    if (target === null) return;
    event.preventDefault(); choose(levels[target]);
    event.currentTarget.querySelectorAll<HTMLElement>('[role=tab]')[target]?.focus();
  }

  return <section aria-labelledby={`${uid}-title`} className="level-section">
    <h2 id={`${uid}-title`} className="level-title">Theo trình độ</h2>
    <div role="tablist" aria-label="Trình độ" className="level-tabs" style={{ '--tabs': levels.length } as React.CSSProperties} onKeyDown={onKeyDown}>
      {levels.map(item => <button key={item} id={`${uid}-tab-${item}`} role="tab" type="button" className="level-tab" aria-selected={item === level} aria-controls={`${uid}-panel`}
        tabIndex={item === level ? 0 : -1} onClick={() => choose(item)}>
        <strong>{item}</strong><span>{levelTabLabel(summaries[item], scheduled)}</span>
      </button>)}
    </div>
    <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${level}`} key={level} className="level-panel">
      <ul className="level-list">{visible.map(row => {
        const kind = KINDS[row.kind];
        const percent = learnedPercent(row.learnedCount, row.totalCards);
        const waiting = scheduled && row.startable && row.dueCount > 0;
        return <li key={row.id}>
          <button type="button" className="level-row" style={{ '--tone': kind.tone } as React.CSSProperties} disabled={!row.startable} onClick={row.onOpen}
            aria-label={`${kind.label} ${row.level}, ${count(row.totalCards)} thẻ, ${count(row.learnedCount)} đã học${waiting ? `, ${count(row.dueCount)} cần ôn` : ''}`}>
            <span className="level-seal" style={{ '--tilt': KIND_TILT[row.kind] } as React.CSSProperties} aria-hidden="true">{KIND_GLYPH[row.kind]}</span>
            <span className="level-row-main">
              <span className="level-row-name">{kind.label}</span>
              <span className="level-row-detail">{row.totalCards ? `${count(row.learnedCount)}/${count(row.totalCards)} đã học` : 'Chưa có thẻ'}</span>
              <span className="level-row-bar" aria-hidden="true"><i style={{ width: `${percent}%` }}/></span>
            </span>
            <span className="level-row-side">
              {waiting ? <span className="level-row-due">{count(row.dueCount)} cần ôn</span>
                : !row.startable ? <span className="level-row-note">{row.totalCards ? <><Check size={14} aria-hidden="true"/>Xong hôm nay</> : 'Sắp có'}</span>
                : !scheduled ? <span className="level-row-note">{row.actionLabel}</span> : null}
              {row.startable && <ChevronRight size={18} className="level-row-chevron" aria-hidden="true"/>}
            </span>
          </button>
        </li>;
      })}</ul>
    </div>
  </section>;
}
