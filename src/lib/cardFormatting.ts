// Formatting is opt-in through recognized HTML tags; ordinary comparisons remain text.
export const hasCardMarkup = (value: string) => /<\/?(?:p|div|span|br|b|strong|i|em|u|s|small|mark|font|h[1-6]|ul|ol|li|blockquote|pre|code|ruby|rt|rp)(?:\s|\/?>)/i.test(value);

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
