import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Measures foreground time with a monotonic clock. Time spent while the tab is
 * hidden is excluded so a learner leaving a session open does not inflate the
 * study statistics.
 */
export function useActiveElapsedMinutes(resetKey: unknown): () => number {
  const elapsedMs = useRef(0);
  const activeSince = useRef<number | null>(null);

  const startFresh = useCallback(() => {
    elapsedMs.current = 0;
    activeSince.current = document.hidden ? null : performance.now();
  }, []);

  useEffect(() => {
    startFresh();
  }, [resetKey, startFresh]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = performance.now();
      if (document.hidden) {
        if (activeSince.current !== null) {
          elapsedMs.current += now - activeSince.current;
          activeSince.current = null;
        }
      } else if (activeSince.current === null) {
        activeSince.current = now;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return useCallback(() => {
    const runningMs = activeSince.current === null ? 0 : performance.now() - activeSince.current;
    return Math.max(0, (elapsedMs.current + runningMs) / 60_000);
  }, []);
}

export function useAnkiSessionTimer(limitMinutes: number, resetKey: unknown, running = true) {
  const readElapsedMinutes = useActiveElapsedMinutes(resetKey);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    limitMinutes > 0 ? limitMinutes * 60 : null
  );

  useEffect(() => {
    if (!running || limitMinutes <= 0) {
      setRemainingSeconds(null);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.ceil(limitMinutes * 60 - readElapsedMinutes() * 60));
      setRemainingSeconds(remaining);
    };
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [limitMinutes, readElapsedMinutes, resetKey, running]);

  const isExpired = useCallback(
    () => limitMinutes > 0 && readElapsedMinutes() >= limitMinutes,
    [limitMinutes, readElapsedMinutes]
  );

  return { remainingSeconds, expired: remainingSeconds === 0, isExpired };
}

export function formatSessionTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
