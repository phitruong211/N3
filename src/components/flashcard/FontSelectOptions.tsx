import { customFontId } from "@/lib/customFonts";
import { FONTS, FONT_GROUP_LABELS, isCustomFontId, type FontGroup } from "@/lib/fontRegistry";
import type { UploadedFont } from "@/lib/fontApi";

const GROUPS: FontGroup[] = ["jp-sans", "jp-serif", "jp-display", "latin", "system"];

/** The <option> list for a font <select>: bundled fonts by group, then the user's own, then the current value if it is gone. */
export function FontSelectOptions({ custom, current }: { custom: UploadedFont[]; current?: string }) {
  const known = !isCustomFontId(current) || custom.some(font => customFontId(font) === current);
  return <>
    {GROUPS.map(group => <optgroup key={group} label={FONT_GROUP_LABELS[group]}>
      {FONTS.filter(font => font.group === group).map(font => <option key={font.id} value={font.id}>{font.label}</option>)}
    </optgroup>)}
    {custom.length > 0 && <optgroup label="Font của bạn">
      {custom.map(font => <option key={font.id} value={customFontId(font)}>{font.name}</option>)}
    </optgroup>}
    {!known && current && <option value={current}>Font không còn khả dụng (đang dùng font thay thế)</option>}
  </>;
}
