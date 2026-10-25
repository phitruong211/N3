import { useEffect, useId, useState } from "react";
import type { CardTheme, StyleSpec } from "@/lib/deckFormat";
import { FONTS, fontStack } from "@/lib/fontRegistry";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { customFontId } from "@/lib/customFonts";
import { FontManagerDialog } from "./FontManagerDialog";
import { FontSelectOptions } from "./FontSelectOptions";
import { ensureFont } from "@/lib/fontLoader";
import { layered, updateStyle, type StylePatch } from "@/lib/styleEdit";
import { MIN_CONTRAST, styleContrast } from "@/lib/styleContrast";

const THEMES: Array<[CardTheme, string]> = [["paper", "Giấy"], ["blue", "Xanh nhạt"], ["dark", "Tối"], ["system", "Theo ứng dụng"]];
const COLORS = [["bg", "Màu nền"], ["fg", "Màu chữ"], ["accent", "Màu nhấn (cách đọc)"]] as const;
const triState = (value: boolean | undefined) => value === undefined ? "" : value ? "on" : "off";
const fromTriState = (value: string) => value === "" ? null : value === "on";

/**
 * Edits one tier of card style. Every control can be left on "Kế thừa", which removes the key so the tier above shows
 * through. `inherited` is only used to show what that would be and to judge contrast.
 */
export function StyleEditor({ value, inherited, onChange, scope = "full", label = "Giao diện" }: {
  value: StyleSpec | undefined;
  inherited?: StyleSpec;
  onChange: (next: StyleSpec | undefined) => void;
  /** Fields only take colors, font and alignment. */
  scope?: "full" | "field";
  label?: string;
}) {
  const id = useId();
  const customFonts = useCustomFonts();
  const [managing, setManaging] = useState(false);
  const patch = (change: StylePatch) => onChange(updateStyle(value, change));
  const shown = layered(inherited, value);
  const family = value?.font?.family ?? "";
  useEffect(() => { ensureFont(shown.font?.family); }, [shown.font?.family]);
  const shownColor = (key: "bg" | "fg" | "accent") => { const inheritedColor = inherited?.colors?.[key]; return inheritedColor && /^#[\da-f]{6}$/i.test(inheritedColor) ? inheritedColor : key === "bg" ? "#faf7f1" : key === "fg" ? "#1f2937" : "#b45309"; };
  const contrast = styleContrast(shown);
  const effectiveFont = FONTS.find(font => font.id === (shown.font?.family ?? "default"))
    ?? (shown.font?.family ? { label: customFonts.fonts.find(font => customFontId(font) === shown.font?.family)?.name ?? "font riêng" } : undefined);

  return <fieldset className="space-y-4 rounded-xl border border-[var(--color-border)] p-4">
    <legend className="px-2 font-semibold">{label}</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      {scope === "full" && <label>Chủ đề
        <select className="study-input mt-1" aria-label="Chủ đề" value={value?.theme ?? ""} onChange={event => patch({ theme: (event.target.value || null) as CardTheme | null })}>
          <option value="">Kế thừa</option>
          {THEMES.map(([theme, text]) => <option key={theme} value={theme}>{text}</option>)}
        </select>
      </label>}
      <label>Font chữ
        <select className="study-input mt-1" aria-label="Font chữ" value={family} onChange={event => patch({ font: { family: event.target.value || null } })}>
          <option value="">Kế thừa{effectiveFont && !value?.font?.family ? ` (${effectiveFont.label})` : ""}</option>
          <FontSelectOptions custom={customFonts.fonts} current={value?.font?.family} />
        </select>
        <button type="button" className="mt-1 text-sm text-[var(--color-accent)] underline" onClick={() => setManaging(true)}>Font của bạn: tải lên và quản lý</button>
      </label>
      <label>Cỡ chữ (12–72)
        <input className="study-input mt-1" type="number" min={12} max={72} aria-label="Cỡ chữ" placeholder={shown.font?.size ? `Kế thừa (${shown.font.size})` : "Kế thừa"}
          value={value?.font?.size ?? ""} onChange={event => patch({ font: { size: event.target.value ? Number(event.target.value) : null } })} />
      </label>
      {scope === "full" && <label>Căn lề
        <select className="study-input mt-1" aria-label="Căn lề" value={value?.align ?? ""} onChange={event => patch({ align: (event.target.value || null) as "left" | "center" | null })}>
          <option value="">Kế thừa</option><option value="center">Giữa</option><option value="left">Trái</option>
        </select>
      </label>}
      {scope === "full" && <>
        <label>In đậm
          <select className="study-input mt-1" aria-label="In đậm" value={triState(value?.font?.bold)} onChange={event => patch({ font: { bold: fromTriState(event.target.value) } })}>
            <option value="">Kế thừa</option><option value="on">Bật</option><option value="off">Tắt</option>
          </select>
        </label>
        <label>In nghiêng
          <select className="study-input mt-1" aria-label="In nghiêng" value={triState(value?.font?.italic)} onChange={event => patch({ font: { italic: fromTriState(event.target.value) } })}>
            <option value="">Kế thừa</option><option value="on">Bật</option><option value="off">Tắt</option>
          </select>
        </label>
        <label className="sm:col-span-2">Tự phóng to chữ ngắn (một từ, một chữ Kanji)
          <select className="study-input mt-1" aria-label="Tự phóng to chữ ngắn" value={triState(value?.autoFit)} onChange={event => patch({ autoFit: fromTriState(event.target.value) })}>
            <option value="">Kế thừa</option><option value="on">Bật</option><option value="off">Tắt</option>
          </select>
        </label>
      </>}
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      {COLORS.map(([key, text]) => {
        const own = value?.colors?.[key];
        return <div key={key} className="space-y-1">
          <label htmlFor={`${id}-${key}`} className="block text-sm">{text}</label>
          <div className="flex items-center gap-2">
            <input id={`${id}-${key}`} type="color" aria-label={text} className="h-10 w-14 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-1"
              value={own ?? shownColor(key)}
              onChange={event => patch({ colors: { [key]: event.target.value } })} />
            <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-secondary)]">{own ?? "Kế thừa"}</span>
            {own
              ? <button type="button" className="study-button !min-h-9 !px-2 !py-1 !text-xs" aria-label={`Bỏ ${text.toLowerCase()}`} onClick={() => patch({ colors: { [key]: null } })}>Bỏ</button>
              // A color input only reports a change, so choosing the swatch it already shows needs its own button.
              : <button type="button" className="study-button !min-h-9 !px-2 !py-1 !text-xs" aria-label={`Dùng màu đang hiện cho ${text.toLowerCase()}`} onClick={() => patch({ colors: { [key]: shownColor(key) } })}>Dùng</button>}
          </div>
        </div>;
      })}
    </div>

    {contrast && !contrast.ok && <p role="status" className="rounded-lg bg-[var(--color-warning-subtle)] px-3 py-2 text-sm text-[var(--color-warning)]">
      Chữ và nền chỉ đạt tương phản {contrast.ratio.toFixed(1)}:1; khuyến nghị từ {MIN_CONTRAST}:1 để dễ đọc. Bạn vẫn lưu được.
    </p>}
    <p lang="ja" className="rounded-lg bg-[var(--color-surface-alt)] px-3 py-2 text-lg leading-relaxed" style={{ fontFamily: fontStack(shown.font?.family), color: shown.colors?.fg, backgroundColor: shown.colors?.bg }}>
      日本語を勉強する · Tiếng Việt có dấu
    </p>
    {value && <button type="button" className="study-button" onClick={() => onChange(undefined)}>Xóa mọi tùy chỉnh ở mục này</button>}
    {managing && <FontManagerDialog onClose={() => setManaging(false)} onUploaded={fontId => patch({ font: { family: fontId } })} />}
  </fieldset>;
}
