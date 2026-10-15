import { useEffect, useRef, useState } from 'react';

/** Counts visible study time across cards; pauses in dialogs and between reviews. */
export function useStudySeconds(running: boolean) {
  const accumulated = useRef(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    let since = running && !document.hidden ? performance.now() : null;
    const update = () => setSeconds(Math.floor((accumulated.current + (since === null ? 0 : performance.now() - since)) / 1000));
    const settle = () => {
      if (since !== null) accumulated.current += performance.now() - since;
      since = null;
      update();
    };
    const visibility = () => {
      settle();
      if (running && !document.hidden) since = performance.now();
    };
    document.addEventListener('visibilitychange', visibility);
    const interval = window.setInterval(update, 1000);
    update();
    return () => {
      settle();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [running]);
  return seconds;
}

export function StudyClock({ seconds }: { seconds: number }) {
  const minutes = Math.floor(seconds / 60);
  const time = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  return <div className="study-clock" role="timer" aria-label={`Thời gian học: ${minutes} phút ${seconds % 60} giây`}>
    <svg viewBox="0 0 160 100" aria-hidden="true" className="study-clock-ticks">
      {Array.from({ length: 40 }, (_, i) => {
        const top = i < 12, right = i >= 12 && i < 20, bottom = i >= 20 && i < 32;
        const x = top ? 25 + i * 10 : right ? 149 : bottom ? 135 - (i - 20) * 10 : 11;
        const y = top ? 9 : right ? 19 + (i - 12) * 9 : bottom ? 91 : 82 - (i - 32) * 9;
        return <line key={i} x1={x} y1={y} x2={x + (right ? -4 : !top && !bottom ? 4 : 0)} y2={y + (top ? 4 : bottom ? -4 : 0)} stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity={i <= (seconds % 60) / 60 * 40 ? .8 : .16}/>;
      })}
    </svg>
    <span className="study-clock-digits">{time}</span>
    <span className="study-clock-label">THỜI GIAN HỌC</span>
  </div>;
}
