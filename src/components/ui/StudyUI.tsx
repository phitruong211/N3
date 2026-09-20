import type { ReactNode } from 'react';

export function PageHeading({ eyebrow, title, subtitle, action }: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--color-border)] pb-5">
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="study-eyebrow">{eyebrow}</p>}
        <h1 className="study-title">{title}</h1>
        {subtitle && <p className="study-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function EmptyState({ title, detail, action }: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="study-empty" role="status">
      <p className="font-semibold text-[var(--color-text)]">{title}</p>
      {detail && <p className="mt-1 text-sm">{detail}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ContentBadge({ children, tone = 'neutral' }: {
  children: ReactNode;
  tone?: 'neutral' | 'vocabulary' | 'grammar' | 'kanji';
}) {
  const color = tone === 'neutral' ? 'var(--color-text-secondary)' : `var(--color-${tone === 'vocabulary' ? 'accent' : tone})`;
  return <span className="study-pill" style={{ color }}>{children}</span>;
}
