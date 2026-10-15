export interface ReviewTimingData {
  shownAt: string;
  revealedAt: string | null;
  ratedAt: string;
  recallTimeMs: number;
  decisionTimeMs: number;
  isTimeValid: boolean;
}

/** Injected clocks make background/focus/pause transitions deterministic in tests. */
export function createReviewTimer(now = () => performance.now(), wall = () => new Date().toISOString()) {
  const shownAt = wall();
  let revealedAt: string | null = null;
  let phase: 'recall' | 'decision' = 'recall';
  let last = now();
  let active = false;
  let valid = true;
  let recall = 0;
  let decision = 0;
  let result: ReviewTimingData | null = null;
  const tick = () => {
    const current = now();
    const delta = current - last;
    if (!Number.isFinite(delta) || delta < 0) valid = false;
    else if (active && !result) {
      if (phase === 'recall') recall += delta;
      else decision += delta;
    }
    last = current;
  };
  return {
    setActive(value: boolean) { tick(); active = value; },
    reveal() {
      if (revealedAt || result) return;
      tick(); revealedAt = wall(); phase = 'decision';
    },
    finish(): ReviewTimingData {
      if (result) return result; // A network retry must send the identical observation.
      tick();
      const ratedAt = wall();
      const recallTimeMs = Math.floor(recall);
      const decisionTimeMs = Math.floor(decision);
      result = {
        shownAt, revealedAt, ratedAt, recallTimeMs, decisionTimeMs,
        isTimeValid: valid && revealedAt !== null && recallTimeMs > 0 && decisionTimeMs > 0
          && recallTimeMs <= 2147483647 && decisionTimeMs <= 2147483647
          && Date.parse(revealedAt) - Date.parse(shownAt) >= recallTimeMs
          && Date.parse(ratedAt) - Date.parse(revealedAt) >= decisionTimeMs,
      };
      // Keep the JSON payload representable by the backend's INTEGER fields.
      if (!Number.isSafeInteger(recallTimeMs) || recallTimeMs > 2147483647) result.recallTimeMs = 0;
      if (!Number.isSafeInteger(decisionTimeMs) || decisionTimeMs > 2147483647) result.decisionTimeMs = 0;
      return result;
    },
  };
}

/** Call with past, valid observations from the same learner and comparable card group. */
export function relativeRecallTime(recallTimeMs: number, baseline: readonly number[], minimumSamples: number) {
  const samples = baseline.filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!Number.isInteger(minimumSamples) || minimumSamples < 1 || samples.length < minimumSamples
      || !Number.isFinite(recallTimeMs) || recallTimeMs <= 0) return null;
  const mid = Math.floor(samples.length / 2);
  const median = samples.length % 2 ? samples[mid] : (samples[mid - 1] + samples[mid]) / 2;
  return { baselineRecallTimeMs: median, relativeRecallTime: recallTimeMs / median, sampleCount: samples.length };
}
