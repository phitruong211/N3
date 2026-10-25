// Formatting is opt-in through recognized HTML tags; ordinary comparisons remain text.
export const CARD_MARKUP_TAGS = ['p', 'div', 'span', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'small', 'mark', 'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'ruby', 'rt', 'rp'] as const;
export const hasCardMarkup = (value: string) => new RegExp(`<\\/?(?:${CARD_MARKUP_TAGS.join('|')})(?:\\s|\\/?>)`, 'i').test(value);

// What safeCardStyle accepts, as data: the import prompt is generated from this and a test checks every example passes.
export const CARD_STYLE_DOC = [
  { property: 'color', values: 'màu #rrggbb, rgb(), hsl() hoặc tên màu cơ bản', example: '#60a5fa' },
  { property: 'background-color', values: 'như color', example: '#fef3c7' },
  { property: 'font-size', values: '12–72px, 50–200% hoặc 0.5–2em/rem', example: '24px' },
  { property: 'font-weight', values: 'normal, bold hoặc 100–900 theo bước 100', example: '700' },
  { property: 'font-style', values: 'normal, italic hoặc oblique', example: 'italic' },
  { property: 'text-align', values: 'left, right, center, justify, start, end', example: 'left' },
  { property: 'text-decoration', values: 'none, underline, line-through', example: 'underline' },
  { property: 'white-space', values: 'normal, pre-wrap, pre-line', example: 'pre-line' },
  { property: 'line-height', values: 'số từ 1 đến 2', example: '1.5' },
  { property: 'padding-left', values: '0–64px (hoặc 0–4em, 0–15%)', example: '16px' },
  { property: 'text-indent', values: 'như padding-left', example: '16px' },
  { property: 'margin-left', values: 'như padding-left', example: '16px' },
  { property: 'margin-top', values: 'như padding-left', example: '8px' },
  { property: 'margin-bottom', values: 'như padding-left', example: '8px' },
] as const;

export function safeCardStyle(property: string, value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (/url|expression|var\(|[\\<>@]/i.test(v)) return;
  if (['color', 'background-color'].includes(property)) {
    if (/^#[\da-f]{3,8}$/.test(v) || /^(?:rgb|rgba|hsl|hsla)\([\d.,%\s+-]+\)$/.test(v) || /^(?:black|white|red|blue|green|yellow|orange|purple|pink|gray|grey|teal|navy|brown|transparent|currentcolor)$/.test(v)) return v;
  }
  if (property === 'font-weight' && /^(?:normal|bold|[1-9]00)$/.test(v)) return v;
  if (property === 'font-style' && /^(?:normal|italic|oblique)$/.test(v)) return v;
  if (property === 'text-align' && /^(?:left|right|center|justify|start|end)$/.test(v)) return v;
  if (property === 'text-decoration' && /^(?:none|underline|line-through)$/.test(v)) return v;
  if (property === 'white-space' && /^(?:normal|pre-wrap|pre-line)$/.test(v)) return v;
  if (property === 'line-height' && /^(?:1(?:\.\d+)?|2(?:\.0+)?)$/.test(v)) return v;
  const length = v.match(/^(\d+(?:\.\d+)?)(px|em|rem|%)$/);
  if (!length) return;
  const n = Number(length[1]), unit = length[2];
  if (property === 'font-size' && (unit === 'px' ? n >= 12 && n <= 72 : unit === '%' ? n >= 50 && n <= 200 : n >= .5 && n <= 2)) return v;
  if (['text-indent', 'padding-left', 'margin-left', 'margin-top', 'margin-bottom'].includes(property) && n <= (unit === 'px' ? 64 : unit === '%' ? 15 : 4)) return v;
}
