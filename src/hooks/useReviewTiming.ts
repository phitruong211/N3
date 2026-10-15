import { useLayoutEffect, useRef } from 'react';
import { createReviewTimer } from '../lib/reviewTiming';

export function useReviewTiming(key: string | null, revealed: boolean, paused: boolean) {
  const timer = useRef<ReturnType<typeof createReviewTimer> | null>(null);
  useLayoutEffect(() => {
    timer.current = key ? createReviewTimer() : null;
    return () => { timer.current?.setActive(false); };
  }, [key]);
  useLayoutEffect(() => {
    const sync = () => timer.current?.setActive(!paused && !document.hidden && document.hasFocus());
    const suspend = () => timer.current?.setActive(false);
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('blur', sync);
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', sync);
    return () => {
      timer.current?.setActive(false);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('blur', sync);
      window.removeEventListener('pagehide', suspend);
      window.removeEventListener('pageshow', sync);
    };
  }, [key, paused]);
  useLayoutEffect(() => { if (revealed) timer.current?.reveal(); }, [key, revealed]);
  return () => timer.current?.finish();
}
