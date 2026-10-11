export interface Live2DCapabilities {
  reducedMotion: boolean;
  saveData: boolean;
  webgl: boolean;
}

export function shouldEnableLive2D(value: Live2DCapabilities): boolean {
  return !value.reducedMotion && !value.saveData && value.webgl;
}

export function detectLive2DCapabilities(): Live2DCapabilities {
  const canvas = document.createElement('canvas');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: connection?.saveData === true,
    webgl: Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')),
  };
}
