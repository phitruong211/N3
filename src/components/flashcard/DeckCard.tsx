import type { DragEventHandler } from 'react';
import type { DeckSummary } from '@/lib/cards';
import { ContentBadge } from '@/components/ui/StudyUI';
import { OverflowMenu, type DeckAction } from '@/components/ui/OverflowMenu';

export type DeckCardProps = {
  summary: DeckSummary;
  badge: { label: string; tone: 'neutral' | 'vocabulary' | 'grammar' | 'kanji' };
  description?: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  metrics?: Array<{ label: string; value: number; tone?: string }>;
  hideProgress?: boolean;
  actions?: DeckAction[];
  draggable?: boolean;
  onDragStart?: DragEventHandler;
  onDrop?: DragEventHandler;
};

export function DeckCard({ summary, badge, description, primaryLabel, primaryDisabled, onPrimary, metrics, hideProgress, actions, draggable, onDragStart, onDrop }: DeckCardProps) {
  const muted = summary.totalCards === 0;
  return <article className="study-panel flex min-h-56 flex-col transition-[border-color,transform] duration-150 hover:border-[var(--color-border-strong)]" draggable={draggable} onDragStart={onDragStart} onDragOver={event => draggable && event.preventDefault()} onDrop={onDrop}>
    <div className="flex items-start justify-between gap-3">
      <ContentBadge tone={badge.tone === 'neutral' ? undefined : badge.tone}>{badge.label}</ContentBadge>
      {actions?.length ? <OverflowMenu label={`Tùy chọn ${summary.name}`} actions={actions}/> : null}
    </div>
    <h3 className="mt-5 text-xl font-semibold text-[var(--color-text)]">{summary.name}</h3>
    {description && <p className="study-copy mt-1 line-clamp-2">{description}</p>}
    <p className={`mt-4 flex items-baseline gap-1.5 ${muted ? 'text-[var(--color-text-tertiary)]' : ''}`}><strong className="text-4xl font-semibold tracking-tight">{summary.totalCards}</strong><span className="text-sm">thẻ</span></p>
    {metrics?.length ? <DeckProgressGrid metrics={metrics}/> : hideProgress ? null : <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{summary.newCount} mới · {summary.dueCount} đến hạn</p>}
    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5">
      <button className={`text-left text-sm font-semibold ${primaryDisabled ? 'cursor-default text-[var(--color-text-tertiary)]' : 'text-[var(--color-accent)] hover:underline'}`} disabled={primaryDisabled} onClick={onPrimary}>{primaryLabel}</button>
    </div>
  </article>;
}

export function DeckProgressGrid({ metrics }: { metrics: Array<{ label: string; value: number; tone?: string }> }) {
  return <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-[var(--color-border)] py-4">
    {metrics.map(metric => <div key={metric.label} className="flex items-baseline justify-between gap-2">
      <dt className="text-[.68rem] font-medium text-[var(--color-text-tertiary)]">{metric.label}</dt>
      <dd className="text-sm font-semibold tabular-nums" style={metric.tone ? { color: metric.tone } : undefined}>{metric.value}</dd>
    </div>)}
  </dl>;
}
