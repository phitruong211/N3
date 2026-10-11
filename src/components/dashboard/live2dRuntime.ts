const CORE_SCRIPT_ID = 'live2d-cubism-core';
const CORE_SCRIPT_URL = '/vendor/live2d/live2dcubismcore.min.js';

declare global {
  interface Window {
    Live2DCubismCore?: unknown;
  }
}

let corePromise: Promise<void> | null = null;

export function loadCubismCore(source = CORE_SCRIPT_URL): Promise<void> {
  if (window.Live2DCubismCore) return Promise.resolve();
  if (corePromise) return corePromise;

  corePromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(CORE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');

    const finish = () => {
      if (window.Live2DCubismCore) resolve();
      else reject(new Error('Live2D Cubism Core did not initialize.'));
    };
    const fail = () => reject(new Error('Unable to load Live2D Cubism Core.'));

    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', fail, { once: true });

    if (!existing) {
      script.id = CORE_SCRIPT_ID;
      script.src = source;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }
  }).catch(error => {
    corePromise = null;
    throw error;
  });

  return corePromise;
}

