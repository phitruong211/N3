import { useEffect, useRef } from 'react';
import { detectLive2DCapabilities, shouldEnableLive2D } from './live2dPolicy';
import { loadCubismCore } from './live2dRuntime';

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

interface Live2DCompanionProps {
  onReady?: () => void;
  onUnavailable?: () => void;
}

export function Live2DCompanion({ onReady, onUnavailable }: Live2DCompanionProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas || !shouldEnableLive2D(detectLive2DCapabilities())) {
      onUnavailable?.();
      return;
    }

    let disposed = false;
    let started = false;
    let visible = false;
    let idleHandle: number | ReturnType<typeof setTimeout> | null = null;
    let app: import('pixi.js').Application | null = null;
    let model: import('pixi-live2d-display/cubism4').Live2DModel | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let pointerFrame = 0;

    const syncTicker = () => {
      if (!app) return;
      if (visible && !document.hidden) app.ticker.start();
      else app.ticker.stop();
    };

    const fitModel = () => {
      if (!app || !model) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      app.renderer.resize(width, height);
      model.scale.set(1);
      // Haru contains a wide, normally-hidden sketch part. Fit by the model canvas
      // height so that this invisible part cannot shrink the visible character.
      const sourceHeight = Math.max(1, model.internalModel.originalHeight);
      const scale = (height * 1.68) / sourceHeight;
      model.scale.set(scale);
      model.anchor.set(0.5, 1);
      // Keep the face and upper body in the compact postcard viewport while
      // allowing the lower half to crop below the card.
      model.position.set(width * 0.5, height * 1.72);
    };

    const initialize = async () => {
      if (started || disposed) return;
      started = true;
      try {
        await loadCubismCore();
        if (disposed) return;
        const [PIXI, live2d] = await Promise.all([
          import('pixi.js'),
          import('pixi-live2d-display/cubism4'),
        ]);
        if (disposed) return;

        live2d.Live2DModel.registerTicker(PIXI.Ticker);
        app = new PIXI.Application({
          view: canvas,
          width: Math.max(1, host.clientWidth),
          height: Math.max(1, host.clientHeight),
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 1.5),
        });
        app.ticker.maxFPS = 30;
        model = await live2d.Live2DModel.from('/models/haru/Haru.model3.json', {
          autoInteract: false,
          autoUpdate: true,
        });
        if (disposed) {
          model.destroy({ children: true, texture: true, baseTexture: true });
          return;
        }
        app.stage.addChild(model);
        fitModel();
        resizeObserver = new ResizeObserver(fitModel);
        resizeObserver.observe(host);
        syncTicker();
        onReady?.();
      } catch (error) {
        console.warn('Live2D companion unavailable:', error);
        onUnavailable?.();
      }
    };

    const scheduleInitialize = () => {
      if (started || idleHandle !== null) return;
      const idleWindow = window as IdleWindow;
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(() => void initialize(), { timeout: 900 });
      } else {
        idleHandle = window.setTimeout(() => void initialize(), 250);
      }
    };

    const visibilityObserver = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) scheduleInitialize();
      syncTicker();
    }, { rootMargin: '180px' });
    visibilityObserver.observe(host);

    const handleVisibility = () => syncTicker();
    const handlePointerMove = (event: PointerEvent) => {
      if (!model || pointerFrame) return;
      const { clientX, clientY } = event;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!model) return;
        const bounds = canvas.getBoundingClientRect();
        model.focus(clientX - bounds.left, clientY - bounds.top);
      });
    };
    const handlePointerLeave = () => model?.focus(host.clientWidth / 2, host.clientHeight / 2);
    const handlePointerDown = (event: PointerEvent) => {
      if (!model) return;
      const bounds = canvas.getBoundingClientRect();
      model.tap(event.clientX - bounds.left, event.clientY - bounds.top);
      void model.motion('TapBody');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    host.addEventListener('pointermove', handlePointerMove, { passive: true });
    host.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    host.addEventListener('pointerdown', handlePointerDown, { passive: true });

    return () => {
      disposed = true;
      visibilityObserver.disconnect();
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      host.removeEventListener('pointermove', handlePointerMove);
      host.removeEventListener('pointerleave', handlePointerLeave);
      host.removeEventListener('pointerdown', handlePointerDown);
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      if (idleHandle !== null) {
        const idleWindow = window as IdleWindow;
        if (idleWindow.cancelIdleCallback && idleWindow.requestIdleCallback) idleWindow.cancelIdleCallback(idleHandle as number);
        else clearTimeout(idleHandle);
      }
      if (model) {
        app?.stage.removeChild(model);
        model.destroy({ children: true, texture: true, baseTexture: true });
      }
      app?.destroy(false, { children: false, texture: false, baseTexture: false });
    };
  }, [onReady, onUnavailable]);

  return <div ref={hostRef} className="dashboard-live2d-host" aria-hidden="true">
    <canvas ref={canvasRef}/>
  </div>;
}

export default Live2DCompanion;
