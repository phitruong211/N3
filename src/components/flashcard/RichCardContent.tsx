import { createElement, Fragment, useMemo, type CSSProperties, type ReactNode } from 'react';
import { CARD_MARKUP_TAGS, safeCardStyle } from '@/lib/cardFormatting';
import './richCardContent.css';

const allowed = new Set<string>(CARD_MARKUP_TAGS.filter(tag => tag !== 'font'));
const discard = new Set('script style iframe object embed svg math form input button textarea select link meta base img audio video source'.split(' '));

// Build React elements rather than injecting HTML. No URLs, event handlers or global CSS survive.
export function RichCardContent({ value, renderText, showRuby = true }: { value: string; renderText: (text: string) => ReactNode; showRuby?: boolean }) {
  const document = useMemo(() => new DOMParser().parseFromString(value, 'text/html'), [value]);
  let budget = 3000;
  const visit = (node: Node, key: number, depth: number): ReactNode => {
    if (--budget < 0 || depth > 40) return null;
    if (node.nodeType === Node.TEXT_NODE) return createElement(Fragment, { key }, renderText(node.textContent || ''));
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (discard.has(tag) || (!showRuby && ['rt', 'rp'].includes(tag))) return null;
    const children = Array.from(element.childNodes).map((child, index) => visit(child, index, depth + 1));
    if (!allowed.has(tag) && tag !== 'font') return createElement('span', { key }, children);
    const style: Record<string, string> = {};
    for (const property of Array.from(element.style)) {
      const safe = safeCardStyle(property, element.style.getPropertyValue(property));
      if (safe) style[property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = safe;
    }
    if (tag === 'font') {
      const color = safeCardStyle('color', element.getAttribute('color') || '');
      if (color) style.color = color;
    }
    return createElement(tag === 'font' ? 'span' : tag, { key, style: style as CSSProperties }, tag === 'br' ? undefined : children);
  };
  return <span className="rich-card-content">{Array.from(document.body.childNodes).map((node, index) => visit(node, index, 0))}</span>;
}
