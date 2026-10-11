# Dashboard Live2D Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lazy-loaded, interactive Haru Live2D companion to the Dashboard postcard without delaying or destabilizing the existing learning interface.

**Architecture:** A small pure policy module decides whether the enhancement can run. A lazy React component owns the Cubism Core script, Pixi application, model lifecycle, pointer interaction, visibility pausing, and cleanup; the Dashboard owns only the fixed-size slot and static fallback.

**Tech Stack:** React 19, TypeScript 6, Vite 8, PixiJS 6.5.10, `pixi-live2d-display` 0.4.0, Live2D Cubism Core for Web, Playwright smoke verification.

**Spec:** `docs/superpowers/specs/2026-10-11-dashboard-live2d-companion-design.md`

## Global Constraints

- Use `pixi.js@6.5.10` and `pixi-live2d-display@0.4.0`; do not install PixiJS 7 or 8.
- Import `pixi-live2d-display/cubism4`, not the combined Cubism 2/4 bundle.
- Source `live2dcubismcore.min.js` only from `https://cubism.live2d.com/sdk-web/core/` or a versioned official Live2D Core path.
- Keep the existing static postcard visible until Live2D is ready and whenever policy checks or loading fail.
- Do not autoplay model sound.
- Limit renderer resolution to `1.5` and update cadence to approximately 30 FPS.
- Pause while the document or companion is hidden, and destroy all Pixi/model resources on unmount.
- Do not push the implementation; the user will review it locally first.

---

### Task 1: Capability policy and dependencies

**Files:**
- Create: `src/components/dashboard/live2dPolicy.ts`
- Create: `tests/live2dPolicy.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `Live2DCapabilities`, `shouldEnableLive2D(capabilities): boolean`, and `detectLive2DCapabilities(): Live2DCapabilities`.
- Consumers: `Live2DCompanion.tsx` uses `detectLive2DCapabilities` before importing Pixi or loading model assets.

- [ ] **Step 1: Write the failing policy test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldEnableLive2D } from '../src/components/dashboard/live2dPolicy.ts';

test('Live2D runs only when motion, data and WebGL policies allow it', () => {
  assert.equal(shouldEnableLive2D({ reducedMotion: false, saveData: false, webgl: true }), true);
  assert.equal(shouldEnableLive2D({ reducedMotion: true, saveData: false, webgl: true }), false);
  assert.equal(shouldEnableLive2D({ reducedMotion: false, saveData: true, webgl: true }), false);
  assert.equal(shouldEnableLive2D({ reducedMotion: false, saveData: false, webgl: false }), false);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --experimental-strip-types --test tests/live2dPolicy.test.mjs`

Expected: FAIL because `live2dPolicy.ts` does not exist.

- [ ] **Step 3: Implement the policy module**

```ts
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
```

- [ ] **Step 4: Install pinned dependencies**

Run: `npm install pixi.js@6.5.10 pixi-live2d-display@0.4.0`

Expected: both exact versions appear in `package.json` and the lockfile resolves Pixi peer packages at 6.x.

- [ ] **Step 5: Run the policy test**

Run: `node --experimental-strip-types --test tests/live2dPolicy.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the capability slice locally**

```bash
git add package.json package-lock.json src/components/dashboard/live2dPolicy.ts tests/live2dPolicy.test.mjs
git commit -m "Add Live2D capability policy"
```

### Task 2: Official runtime and Haru prototype assets

**Files:**
- Create: `public/vendor/live2d/live2dcubismcore.min.js`
- Create: `public/vendor/live2d/NOTICE.md`
- Create: `public/models/haru/**`
- Create: `public/models/haru/NOTICE.md`

**Interfaces:**
- Produces runtime URL `/vendor/live2d/live2dcubismcore.min.js`.
- Produces model URL `/models/haru/Haru.model3.json` and every file referenced by that manifest.
- Consumers: `Live2DCompanion.tsx` loads both URLs without a cross-origin request.

- [ ] **Step 1: Download Cubism Core from the official hosting endpoint**

Run:

```bash
mkdir -p public/vendor/live2d
curl --fail --location https://cubism.live2d.com/sdk-web/core/live2dcubismcore.min.js \
  --output public/vendor/live2d/live2dcubismcore.min.js
```

Expected: the file is JavaScript, non-empty, and defines `Live2DCubismCore`.

- [ ] **Step 2: Fetch Haru from the official Live2D repository**

Run:

```bash
rm -rf /tmp/CubismWebSamples
git clone --depth 1 --filter=blob:none --sparse https://github.com/Live2D/CubismWebSamples.git /tmp/CubismWebSamples
git -C /tmp/CubismWebSamples sparse-checkout set Samples/Resources/Haru
mkdir -p public/models
cp -R /tmp/CubismWebSamples/Samples/Resources/Haru public/models/haru
```

Expected: `Haru.model3.json`, `Haru.moc3`, both 2048 textures, motions, expressions, physics, pose, display information and user data exist under `public/models/haru`.

- [ ] **Step 3: Remove sound references and unused audio from the prototype copy**

Use a Node script to delete every `Sound` key from `FileReferences.Motions` in `public/models/haru/Haru.model3.json`, then remove `public/models/haru/sounds`.

Expected: tapping a motion never requests or plays WAV files, while every motion JSON remains available.

- [ ] **Step 4: Add provenance and license notices**

`public/vendor/live2d/NOTICE.md` records the official Core source URL and links to the Live2D Proprietary Software License Agreement. `public/models/haru/NOTICE.md` records the official repository path and contains the required notice:

```text
This content uses sample data owned and copyrighted by Live2D Inc. The sample data are utilized in accordance with terms and conditions set by Live2D Inc. This content itself is created at the author's sole discretion.
```

- [ ] **Step 5: Validate every model reference**

Run a Node script that reads `Haru.model3.json`, collects `Moc`, `Textures`, `Physics`, `Pose`, `DisplayInfo`, `UserData`, expression files and motion files, and fails if any referenced path does not exist.

Expected: exit code 0 and no missing paths.

- [ ] **Step 6: Commit official prototype assets locally**

```bash
git add public/vendor/live2d public/models/haru
git commit -m "Add official Live2D Haru prototype assets"
```

### Task 3: Lazy Live2D renderer lifecycle

**Files:**
- Create: `src/components/dashboard/Live2DCompanion.tsx`
- Create: `src/components/dashboard/live2dRuntime.ts`
- Create: `src/types/pixi-live2d-display.d.ts`

**Interfaces:**
- `loadCubismCore(src?: string): Promise<void>` inserts and deduplicates the official Core script.
- `Live2DCompanionProps = { modelUrl: string; className?: string; onReady?: () => void; onUnavailable?: () => void }`.
- `Live2DCompanion` renders only a canvas container and never owns surrounding Dashboard copy.

- [ ] **Step 1: Add Core loader with a shared promise**

Implement `loadCubismCore` so it immediately resolves when `window.Live2DCubismCore` exists, reuses one module-level promise, adds a script with `data-live2d-core="true"`, and rejects on `error`.

- [ ] **Step 2: Declare the Cubism global and adapter module**

Add the minimum TypeScript declaration for `window.Live2DCubismCore` and for imports from `pixi-live2d-display/cubism4` that are not exposed correctly by the package's current type resolution.

- [ ] **Step 3: Build the isolated renderer**

Inside a mount-only effect:

1. Abort to `onUnavailable` when `shouldEnableLive2D(detectLive2DCapabilities())` is false.
2. Wait for the container to intersect with `rootMargin: '120px'`.
3. Wait for idle time using `requestIdleCallback` or a 250 ms fallback.
4. Await `loadCubismCore()`.
5. Dynamically import `pixi.js` and `pixi-live2d-display/cubism4`.
6. Register Pixi's ticker with `Live2DModel.registerTicker(PIXI.Ticker)`.
7. Create a transparent antialiased Pixi application with `resolution: Math.min(devicePixelRatio, 1.5)` and `autoDensity: true`.
8. Load Haru with `autoInteract: false` and add it to the stage.
9. Scale the model to cover the slot height, anchor it at the bottom center, and rerun placement from `ResizeObserver`.
10. Throttle pointer focus to one update per animation frame and clamp pointer coordinates to the canvas bounds.
11. Trigger `TapBody` from a canvas pointer tap without playing sound.
12. Set `app.ticker.maxFPS = 30`, pause/resume from intersection and `visibilitychange`, then call `onReady`.

- [ ] **Step 4: Implement deterministic cleanup**

Cleanup cancels idle/animation callbacks, disconnects both observers, removes pointer and visibility handlers, stops the ticker, destroys the model with textures, removes the canvas, and destroys the Pixi application. Guard every asynchronous continuation with a `disposed` boolean.

- [ ] **Step 5: Type-check and build the lazy chunk**

Run: `npm run build`

Expected: PASS. Vite output contains a separate Pixi/Live2D-related chunk; the main Dashboard chunk does not absorb the complete runtime.

- [ ] **Step 6: Commit the renderer locally**

```bash
git add src/components/dashboard/Live2DCompanion.tsx src/components/dashboard/live2dRuntime.ts src/types/pixi-live2d-display.d.ts
git commit -m "Add lazy Live2D renderer lifecycle"
```

### Task 4: Dashboard slot, fallback and local verification

**Files:**
- Modify: `src/components/dashboard/Dashboard.tsx`
- Modify: `src/index.css`
- Create: `tests/live2dDashboard.browser.mjs`

**Interfaces:**
- Consumes `Live2DCompanion` through `React.lazy`.
- The existing `TodayPostcard` retains its fixed dimensions, text and static card stack until `onReady` fires.

- [ ] **Step 1: Add the lazy companion boundary**

Create a lazy import at module scope and render it inside `TodayPostcard` only after the component requests enhancement. Keep `.dashboard-card-stack` visible during loading and on errors; fade it out only after `onReady`.

- [ ] **Step 2: Add the visual slot styles**

Add a fixed-aspect canvas wrapper, opacity crossfade, pointer cursor only over the model, a soft radial floor shadow, responsive desktop/mobile crops, and a static fallback rule for `.reduced-motion`. The canvas must not change card dimensions.

- [ ] **Step 3: Add a browser smoke test**

The Playwright test opens `/today`, enters guest mode, verifies there is no horizontal overflow at 390 px, confirms the primary study button is available before Live2D reaches ready state, waits for either a Live2D canvas or the fallback, navigates away, and asserts no uncaught page errors.

- [ ] **Step 4: Run all automated checks**

Run:

```bash
npm test
npm run lint
npm run build
node tests/live2dDashboard.browser.mjs
```

Expected: tests and build pass; lint reports no new errors.

- [ ] **Step 5: Inspect the desktop and mobile Dashboard**

Check at 1280×800 and 390×844. Verify Haru stays inside the postcard, pointer focus is subtle, tapping triggers one silent motion, navigating away releases the WebGL canvas, and disabling WebGL or reduced motion keeps the static illustration.

- [ ] **Step 6: Add visible model attribution**

Add the required Live2D sample-data copyright notice to an existing settings/about/legal surface. Keep it one concise line with a link to `public/models/haru/NOTICE.md` in source documentation.

- [ ] **Step 7: Commit the Dashboard integration locally**

```bash
git add src/components/dashboard/Dashboard.tsx src/index.css tests/live2dDashboard.browser.mjs
git commit -m "Integrate Live2D companion with dashboard"
```

Do not push. Leave the local Dashboard running for user review.
