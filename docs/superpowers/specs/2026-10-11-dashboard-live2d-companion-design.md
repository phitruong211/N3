# Dashboard Live2D Companion Design

## Objective

Add a small interactive Live2D study companion to the Dashboard without delaying the Dashboard's useful content or making the character compete with the primary study action. The first implementation uses Live2D's official Haru sample model as a replaceable prototype.

## User experience

- The companion appears inside the existing blue "Bưu thiếp hôm nay" area, at roughly 220–280 px on desktop and a smaller crop on mobile.
- The Dashboard initially renders its current lightweight card illustration. Live2D replaces it only after the page is interactive and the companion area is visible.
- Idle motion is subtle. Pointer movement controls head and eye focus within a limited range.
- A pointer tap may trigger one short `TapBody` motion. The prototype does not autoplay sound.
- The companion reflects the Dashboard state through the surrounding copy. Goal completion may trigger one celebration motion if the model supports it; it must not loop.
- The current static illustration remains the fallback for loading, unsupported WebGL, errors, reduced motion, save-data mode, and constrained devices.

## Technical architecture

### Isolated component

Create `src/components/dashboard/Live2DCompanion.tsx`. It owns the canvas, renderer, model, pointer listeners, visibility observers, and cleanup. `Dashboard.tsx` only provides the visible state and fallback markup.

### Runtime loading

- Pin PixiJS 6.x because `pixi-live2d-display` 0.4 targets PixiJS 6.
- Import only `pixi-live2d-display/cubism4`.
- Load the Live2D component with `React.lazy` so Pixi and the adapter stay out of the initial Dashboard chunk.
- Begin the import after the browser becomes idle. If `requestIdleCallback` is unavailable, use a short timeout after first render.
- Use `IntersectionObserver` so model files and textures are fetched only when the postcard is near the viewport.
- Load the official Cubism Core script once before importing a model. A failed script load returns the component to its static fallback.

### Rendering lifecycle

- Render with transparent background and antialiasing enabled.
- Limit renderer resolution to `min(devicePixelRatio, 1.5)`.
- Target approximately 30 FPS by throttling or using a reduced ticker rate.
- Pause the ticker while `document.hidden` or while the companion is outside the viewport.
- Resize from a `ResizeObserver`; scale and anchor the model relative to the container instead of fixed screen coordinates.
- On unmount, remove observers and event listeners, stop the ticker, detach the model, destroy textures/model resources, and destroy the Pixi application.

## Interaction boundaries

- Pointer movement only applies while the pointer is over the companion region.
- Clamp focus coordinates so the character does not make abrupt head turns.
- Tapping the canvas triggers a motion only when the model reports an applicable hit area.
- The canvas uses an accessible label but is decorative to keyboard navigation; no essential action depends on the character.
- No audio is loaded or played in the prototype.

## Performance and accessibility policy

Keep the static fallback when any of these conditions applies:

- `prefers-reduced-motion: reduce`
- `navigator.connection.saveData === true`
- WebGL is unavailable
- the Core script, model, or texture fails to load
- the component has not entered the viewport

The companion must not cause horizontal scrolling, layout shift, or block the primary "Ôn ngay" / "Học tự do" button. The canvas has a fixed aspect-ratio container before loading.

## Assets and licensing

- `live2dcubismcore.min.js` must come from the official Cubism SDK for Web distribution, not an unofficial CDN. It is stored as a public runtime asset with its required notices.
- The Haru runtime folder is sourced from Live2D's official Cubism Web Samples repository.
- Include Live2D's required copyright notice for the sample character in the application's legal/about surface and retain upstream notices in the asset directory.
- Haru is a prototype dependency. The component accepts a model URL so a licensed custom Sổ Nhật model can replace it without changing rendering code.

## Error handling

- Loading and runtime errors are caught inside the companion boundary and reported only in development logs.
- Users continue to see the static Dashboard illustration; no blocking toast is shown for a decorative enhancement.
- Repeated Core script insertion and repeated model initialization are guarded.

## Verification

- Production build keeps Pixi/Live2D in a separate lazy chunk.
- The initial Dashboard remains usable while network requests for the model are delayed or blocked.
- Test desktop and 390 px mobile layouts for overflow and layout shift.
- Test pointer focus, tap motion, route changes, tab visibility pause/resume, and repeated Dashboard mounts.
- Test WebGL disabled, reduced motion, save-data mode, and model 404 fallbacks.
- Confirm renderer/model destruction after leaving the Dashboard.

## Out of scope

- Creating or rigging a custom character
- Speech, lip-sync, microphone, webcam, or face tracking
- Persistent dialogue history
- Character selection or downloadable model packs
- Showing Live2D outside the Dashboard
