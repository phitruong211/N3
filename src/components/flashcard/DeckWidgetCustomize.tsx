import { useEffect, useId, useRef, type CSSProperties, type RefObject } from 'react';
import { X } from '@/components/ui/icons';
import { MAX_WIDGET_BLUR, MAX_WIDGET_OPACITY, MIN_WIDGET_BLUR, WIDGET_COLORS, widgetSpan, type DeckWidgetStyle, type WidgetSize } from '@/lib/deckWidgets';

const SIZE_OPTIONS: [WidgetSize, string][] = [['small', 'Nhỏ'], ['medium', 'Vừa'], ['large', 'Lớn'], ['xlarge', 'Rất lớn']];
/** Tiny grid glyph showing the tier's footprint (4-column reference grid). */
function SizeGlyph({ size }: { size: WidgetSize }) {
  const { cols, rows } = widgetSpan(size, 4);
  return <span className="widget-size-glyph" aria-hidden="true"><i style={{ width: `${cols * 6 + (cols - 1)}px`, height: `${rows * 6 + (rows - 1)}px` }}/></span>;
}

/** Non-modal: the selected widget is the live preview and the board stays interactive. */
export function DeckWidgetCustomize({ name, value, anchor, onChange, onReset, onClose }: {
  name: string; value: DeckWidgetStyle; anchor: RefObject<HTMLDivElement | null>;
  onChange: (patch: Partial<DeckWidgetStyle>) => void; onReset: () => void; onClose: () => void;
}) {
  const title = useId();
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('[data-panel-close]')?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close.current(); } };
    const place = () => {
      const box = anchor.current?.getBoundingClientRect();
      if (box && panel.current) {
        panel.current.style.setProperty('--panel-right', `${Math.max(16, innerWidth - box.right)}px`);
        panel.current.style.setProperty('--panel-top', `${Math.max(24, Math.min(box.top, innerHeight - 420))}px`);
      }
    };
    place(); const observer = new ResizeObserver(place);
    if (anchor.current) observer.observe(anchor.current);
    window.addEventListener('keydown', escape); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { observer.disconnect(); window.removeEventListener('keydown', escape); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, [anchor]);

  return <aside ref={panel} className="deck-widget-customizer" aria-labelledby={title}>
    <header className="widget-panel-header"><div><h3 id={title}>Giao diện thẻ</h3><p>{name}</p></div>
      <button type="button" data-panel-close className="widget-icon-button" aria-label="Đóng bảng tùy chỉnh" onClick={onClose}><X size={18}/></button></header>
    <div className="widget-panel-body">
      <fieldset className="widget-control"><legend>Kích thước</legend><div className="widget-size-options">
        {SIZE_OPTIONS.map(([size, label]) =>
          <button key={size} type="button" aria-pressed={value.size === size} onClick={() => onChange({ size })}><SizeGlyph size={size}/>{label}</button>)}
      </div></fieldset>
      <fieldset className="widget-control"><legend>Tông màu</legend><div className="widget-color-options">
        {WIDGET_COLORS.map(color => <button key={color.value} type="button" title={color.label} aria-label={color.label} aria-pressed={value.color === color.value}
          style={{ '--swatch': color.value } as CSSProperties} onClick={() => onChange({ color: color.value })}/>)}
      </div>
        <label className="widget-custom-color"><span>Màu riêng</span>
          <input type="color" aria-label="Chọn màu widget từ bảng màu" value={value.color} onChange={event => onChange({ color: event.target.value })}/>
        </label>
      </fieldset>
      <label className="widget-control widget-slider"><span>Độ đậm màu <span>{value.opacity}%</span></span><input aria-label="Độ đậm màu" type="range" min={0} max={MAX_WIDGET_OPACITY} step={1} value={value.opacity} onChange={event => onChange({ opacity: Number(event.target.value) })}/></label>
      <label className="widget-control widget-slider"><span>Độ mờ kính <span>{value.blur}px</span></span><input aria-label="Độ mờ kính" type="range" min={MIN_WIDGET_BLUR} max={MAX_WIDGET_BLUR} step={1} value={Math.max(MIN_WIDGET_BLUR, value.blur)} onChange={event => onChange({ blur: Number(event.target.value) })}/></label>
    </div>
    <footer className="widget-panel-footer"><button type="button" className="widget-pill" onClick={onReset}>Đặt lại</button><button type="button" className="widget-pill widget-pill-primary" onClick={onClose}>Xong</button></footer>
  </aside>;
}
