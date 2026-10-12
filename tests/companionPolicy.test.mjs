import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCompanionCapabilities, shouldEnableCompanion, watchReducedMotion } from '../src/components/dashboard/companionPolicy.ts';

test('companion runs only when motion, data, network and WebGL policies allow it', () => {
  assert.equal(shouldEnableCompanion({ reducedMotion: false, saveData: false, slowNetwork: false, webgl: true }), true);
  assert.equal(shouldEnableCompanion({ reducedMotion: true, saveData: false, slowNetwork: false, webgl: true }), false);
  assert.equal(shouldEnableCompanion({ reducedMotion: false, saveData: true, slowNetwork: false, webgl: true }), false);
  assert.equal(shouldEnableCompanion({ reducedMotion: false, saveData: false, slowNetwork: true, webgl: true }), false);
  assert.equal(shouldEnableCompanion({ reducedMotion: false, saveData: false, slowNetwork: false, webgl: false }), false);
});

test('browser-only capability helpers are safe during server evaluation', () => {
  assert.deepEqual(detectCompanionCapabilities(), {
    reducedMotion: true,
    saveData: false,
    slowNetwork: false,
    webgl: false,
  });
  assert.doesNotThrow(() => watchReducedMotion(() => undefined)());
});
