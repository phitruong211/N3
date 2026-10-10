import type { DragEventHandler } from 'react';
import type { DeckSummary } from '@/lib/cards';
import type { DeckScheduleSummary } from '@/lib/deckSchedule';
import { ContentBadge } from '@/components/ui/StudyUI';
import { OverflowMenu, type DeckAction } from '@/components/ui/OverflowMenu';

export type DeckCardProps = {
  summary: DeckSummary;
  badge: { label: string; tone: 'neutral' | 'vocabulary' | 'grammar' | 'kanji' };
  description?: string;
  scheduleSummary?: DeckScheduleSummary;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  secondaryLabel?: string;
  secondaryDisabled?: boolean;
  onSecondary?: () => void;
  actions?: DeckAction[];
  draggable?: boolean;
  onDragStart?: DragEventHandler;
  onDrop?: DragEventHandler;
};

export function DeckCard({ summary, badge, description, scheduleSummary, primaryLabel, primaryDisabled, onPrimary, secondaryLabel, secondaryDisabled, onSecondary, actions, draggable, onDragStart, onDrop }: DeckCardProps) {
  const muted = summary.totalCards === 0;
  return <article className="study-panel flex min-h-56 flex-col transition-[border-color,transform] duration-150 hover:border-[var(--color-border-strong)]" draggable={draggable} onDragStart={onDragStart} onDragOver={event => draggable && event.preventDefault()} onDrop={onDrop}>
    <div className="flex items-start justify-between gap-3">
      <ContentBadge tone={badge.tone === 'neutral' ? undefined : badge.tone}>{badge.label}</ContentBadge>
      {actions?.length ? <OverflowMenu label={`Tùy chọn ${summary.name}`} actions={actions}/> : null}
    </div>
    <h3 className="mt-5 text-xl font-semibold text-[var(--color-text)]">{summary.name}</h3>
    {description && <p className="study-copy mt-1 line-clamp-2">{description}</p>}
    <p className={`mt-4 flex items-baseline gap-1.5 ${muted ? 'text-[var(--color-text-tertiary)]' : ''}`}><strong className="text-4xl font-semibold tracking-tight">{summary.totalCards}</strong><span className="text-sm">thẻ</span></p>
    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{summary.newCount} mới · {summary.dueCount} đến hạn</p>
    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5">
      <button className={`text-left text-sm font-semibold ${primaryDisabled ? 'cursor-default text-[var(--color-text-tertiary)]' : 'text-[var(--color-accent)] hover:underline'}`} disabled={primaryDisabled} onClick={onPrimary}>{primaryLabel}</button>
      {secondaryLabel && onSecondary ? <button className={`text-left text-sm font-semibold ${secondaryDisabled ? 'cursor-default text-[var(--color-text-tertiary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:underline'}`} disabled={secondaryDisabled} onClick={onSecondary}>{secondaryLabel}</button> : null}
    </div>
    {scheduleSummary && (scheduleSummary.learningCount > 0 || scheduleSummary.dueCount > 0) && (
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
        {scheduleSummary.learningCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-subtle)] px-2.5 py-0.5 text-[.68rem] font-semibold text-[var(--color-warning)]"><span className="inline-block h-1.5 w-1.5 rounded-full bg-current"/>{scheduleSummary.learningCount} đang học</span>}
        {scheduleSummary.dueCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-subtle)] px-2.5 py-0.5 text-[.68rem] font-semibold text-[var(--color-accent)]"><span className="inline-block h-1.5 w-1.5 rounded-full bg-current"/>{scheduleSummary.dueCount} đến hạn</span>}
      </div>
    )}
  </article>;
}
