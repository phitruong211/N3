import { parseStoredFurigana, resolveFurigana, type FuriganaSegment } from "@/lib/furigana";
import { hasCardMarkup } from '@/lib/cardFormatting';
import { RichCardContent } from './RichCardContent';

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
  if (allowMarkup && hasCardMarkup(text)) return <>
    <RichCardContent value={text} showRuby={show} renderText={value => <FuriganaText text={value} show={show} allowMarkup={false} />} />
    {show && reading && <span className="mt-2 block text-[0.46em] font-normal text-[var(--color-accent)]">{reading}</span>}
  </>;
  const stored = parseStoredFurigana(storedSegments);
  const resolved = stored.length
    ? { text, segments: stored, warning: undefined }
    : resolveFurigana(text, reading);
  const segments: FuriganaSegment[] = resolved.segments.length ? resolved.segments : [{ text: resolved.text }];
  if (!show) return <>{resolved.text}</>;
  const hasRuby = segments.some((segment) => segment.reading);
  return (
    <>
      <span className="furigana-text">
        {hasRuby
          ? segments.map((segment, index) => segment.reading ? (
              <ruby key={`${index}-${segment.text}`}>
                {segment.text}
                <rt>{segment.reading}</rt>
              </ruby>
            ) : <span key={`${index}-${segment.text}`}>{segment.text}</span>)
          : resolved.text}
      </span>
      {!hasRuby && reading && (
        <span className="mt-2 block text-[0.46em] font-normal not-italic leading-relaxed text-[var(--color-accent)]">
          {reading}
        </span>
      )}
    </>
  );
}
