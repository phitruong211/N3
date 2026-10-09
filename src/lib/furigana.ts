export interface FuriganaSegment {
  text: string;
  reading?: string;
}

export interface FuriganaResult {
  text: string;
  segments: FuriganaSegment[];
  warning?: string;
  explicit: boolean;
}

const HAN_RUN = /[\p{Script=Han}々〆ヵヶ]+/u;
const HAN_GLOBAL = /[\p{Script=Han}々〆ヵヶ]+/gu;

function mergePlain(segments: FuriganaSegment[], text: string) {
  if (!text) return;
  const last = segments.at(-1);
  if (last && !last.reading) last.text += text;
  else segments.push({ text });
}

export function segmentsReading(segments: FuriganaSegment[]): string {
  return segments.map((segment) => segment.reading || segment.text).join("");
}

export function serializeFurigana(segments: FuriganaSegment[]): string {
  return segments
    .map((segment) => segment.reading ? `${segment.text}[${segment.reading}]` : segment.text)
    .join("");
}

export function parseFuriganaMarkup(input: string): FuriganaResult {
  const source = input.normalize("NFC");
  if (!source.includes("[") && !source.includes("]")) return { text: source, segments: source ? [{ text: source }] : [], explicit: false };

  const segments: FuriganaSegment[] = [];
  let clean = "";
  let cursor = 0;
  let matched = false;
  const pattern = new RegExp(
    String.raw`([\p{Script=Han}々〆ヵヶ]+)\[([^\[\]\r\n]+)\]`,
    "gu",
  );
  for (const match of source.matchAll(pattern)) {
    const index = match.index;
    mergePlain(segments, source.slice(cursor, index));
    segments.push({ text: match[1], reading: match[2].trim() });
    clean += source.slice(cursor, index) + match[1];
    cursor = index + match[0].length;
    matched = true;
  }
  clean += source.slice(cursor);
  mergePlain(segments, source.slice(cursor));
  if (!matched || clean.includes("[") || clean.includes("]")) {
    return {
      text: source,
      segments: source ? [{ text: source }] : [],
      warning: "Cú pháp furigana chưa đúng. Dùng dạng Kanji[hiragana], ví dụ 学校[がっこう].",
      explicit: true,
    };
  }
  return { text: clean, segments, explicit: true };
}

export function normalizeReadingInput(input: string): string {
  const parsed = parseFuriganaMarkup(input.trim());
  return parsed.explicit && !parsed.warning
    ? segmentsReading(parsed.segments)
    : input.trim();
}

function surfaceRuns(text: string): Array<{ text: string; han: boolean }> {
  const runs: Array<{ text: string; han: boolean }> = [];
  let cursor = 0;
  for (const match of text.matchAll(HAN_GLOBAL)) {
    if (match.index > cursor) runs.push({ text: text.slice(cursor, match.index), han: false });
    runs.push({ text: match[0], han: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) runs.push({ text: text.slice(cursor), han: false });
  return runs;
}

export function alignFurigana(text: string, reading: string): FuriganaResult {
  const surface = text.normalize("NFC");
  const kana = reading.trim().normalize("NFC");
  if (!kana || !HAN_RUN.test(surface)) return { text: surface, segments: surface ? [{ text: surface }] : [], explicit: false };

  const runs = surfaceRuns(surface);
  const segments: FuriganaSegment[] = [];
  let cursor = 0;
  for (let index = 0; index < runs.length; index++) {
    const run = runs[index];
    if (!run.han) {
      if (!kana.startsWith(run.text, cursor)) {
        return { text: surface, segments: [{ text: surface }], warning: "Cách đọc không khớp phần kana có sẵn; hãy dùng cú pháp Kanji[hiragana].", explicit: false };
      }
      mergePlain(segments, run.text);
      cursor += run.text.length;
      continue;
    }

    const nextAnchor = runs[index + 1]?.han === false ? runs[index + 1].text : "";
    let end = kana.length;
    if (nextAnchor) {
      end = kana.indexOf(nextAnchor, cursor);
      if (end < cursor || kana.indexOf(nextAnchor, end + 1) !== -1) {
        return { text: surface, segments: [{ text: surface }], warning: "Có nhiều cách căn furigana; hãy dùng cú pháp Kanji[hiragana].", explicit: false };
      }
    }
    const value = kana.slice(cursor, end);
    if (!value) return { text: surface, segments: [{ text: surface }], warning: "Thiếu cách đọc cho một cụm Kanji.", explicit: false };
    segments.push({ text: run.text, reading: value });
    cursor = end;
  }
  if (cursor !== kana.length) return { text: surface, segments: [{ text: surface }], warning: "Cách đọc còn ký tự không thể ghép; hãy kiểm tra lại.", explicit: false };
  return { text: surface, segments, explicit: false };
}

export function resolveFurigana(input: string, reading = ""): FuriganaResult {
  const explicit = parseFuriganaMarkup(input);
  if (explicit.explicit || explicit.warning) return explicit;
  return alignFurigana(explicit.text, normalizeReadingInput(reading));
}

export function parseStoredFurigana(value: unknown): FuriganaSegment[] {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.length > 200) return [];
    return parsed
      .filter((segment): segment is Record<string, unknown> => !!segment && typeof segment === "object" && !Array.isArray(segment))
      .map((segment) => ({
        text: typeof segment.text === "string" ? segment.text : "",
        ...(typeof segment.reading === "string" && segment.reading ? { reading: segment.reading } : {}),
      }))
      .filter((segment) => segment.text);
  } catch {
    return [];
  }
}
