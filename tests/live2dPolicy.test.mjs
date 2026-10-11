import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldEnableLive2D } from '../src/components/dashboard/live2dPolicy.ts';

test('Live2D runs only when motion, data and WebGL policies allow it', () => {
  assert.equal(shouldEnableLive2D({ reducedMotion: false, saveData: false, webgl: true }), true);
  assert.equal(shouldEnableLive2D({ reducedMotion: true, saveData: false, webgl: true }), false);
  assert.equal(shouldEnableLive2D({ reducedMotion: false, saveData: true, webgl: true }), false);
  assert.equal(shouldEnableLive2D({ reducedMotion: false, saveData: false, webgl: false }), false);
});
