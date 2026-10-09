import { parseStoredFurigana, resolveFurigana, type FuriganaSegment } from "@/lib/furigana";

export function FuriganaText({
  text,
  reading = "",
  storedSegments,
  show = true,
}: {
  text: string;
  reading?: string;
  storedSegments?: unknown;
  show?: boolean;
}) {
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
