import { alignFurigana, normalizeReadingInput, parseFuriganaMarkup, parseStoredFurigana, resolveFurigana, segmentCursor, type FuriganaSegment } from "@/lib/furigana";
import { hasCardMarkup } from '@/lib/cardFormatting';
import { RichCardContent } from './RichCardContent';

// A reading that could not be matched to single characters still sits above the word, never under it.
const ReadingAbove = ({ reading }: { reading: string }) =>
  <span className="card-reading mb-1 block text-[0.46em] font-normal not-italic leading-relaxed text-[var(--color-accent)]">{reading}</span>;

const Ruby = ({ segments }: { segments: FuriganaSegment[] }) => <span className="furigana-text">
  {segments.map((segment, index) => segment.reading
    ? <ruby key={`${index}-${segment.text}`}>{segment.text}<rt>{segment.reading}</rt></ruby>
    : <span key={`${index}-${segment.text}`}>{segment.text}</span>)}
</span>;

function MarkupFurigana({ text, reading, storedSegments, show }: { text: string; reading: string; storedSegments?: unknown; show: boolean }) {
  const plain = new DOMParser().parseFromString(text, 'text/html').body.textContent ?? '';
  const stored = parseStoredFurigana(storedSegments);
  const joins = (segments: FuriganaSegment[]) => segments.map(segment => segment.text).join('') === plain;
  // Bracket ruby (学校[がっこう]) and hand-written <ruby> already place themselves; only a separate reading needs aligning.
  const own = /<ruby\b/i.test(text) || parseFuriganaMarkup(plain).explicit;
  const segments = !show || own ? [] : stored.length && joins(stored) ? stored : reading ? alignFurigana(plain, normalizeReadingInput(reading)).segments : [];
  if (segments.some(segment => segment.reading) && joins(segments)) {
    const take = segmentCursor(segments);
    return <RichCardContent value={text} showRuby={show} renderText={value => <Ruby segments={take(value)} />} />;
  }
  return <>
    {show && reading && !own && <ReadingAbove reading={reading} />}
    <RichCardContent value={text} showRuby={show} renderText={value => <FuriganaText text={value} show={show} allowMarkup={false} />} />
  </>;
}

export function FuriganaText({
  text,
  reading = "",
  storedSegments,
  show = true,
  allowMarkup = true,
}: {
  text: string;
  reading?: string;
  storedSegments?: unknown;
  show?: boolean;
  allowMarkup?: boolean;
}) {
  if (allowMarkup && hasCardMarkup(text)) return <MarkupFurigana text={text} reading={reading} storedSegments={storedSegments} show={show} />;
  const stored = parseStoredFurigana(storedSegments);
  const resolved = stored.length
    ? { text, segments: stored, warning: undefined }
    : resolveFurigana(text, reading);
  const segments: FuriganaSegment[] = resolved.segments.length ? resolved.segments : [{ text: resolved.text }];
  if (!show) return <>{resolved.text}</>;
  if (segments.some((segment) => segment.reading)) return <Ruby segments={segments} />;
  return <>
    {reading && <ReadingAbove reading={reading} />}
    <span className="furigana-text">{resolved.text}</span>
  </>;
}
