import { expect, it } from 'vitest';
import { launchPhase } from '../src/ui/launch-state';

it('settles and hands off to a ready app within 1.6 seconds without a five-second delay', () => {
  expect(launchPhase(0, true, false)).toBe('brand');
  expect(launchPhase(1439, true, false)).toBe('brand');
  expect(launchPhase(1440, true, false)).toBe('handoff');
  expect(launchPhase(1600, true, false)).toBe('complete');
});
it('finishes decoration while real initialization is still pending, then hands off without stretching animation', () => {
  expect(launchPhase(1440, false, false)).toBe('initializing');
  expect(launchPhase(6000, false, false)).toBe('initializing');
  expect(launchPhase(6000, true, false)).toBe('complete');
});
it('reduced motion is a short static/fade handoff and still waits truthfully for data', () => {
  expect(launchPhase(119, true, true)).toBe('brand');
  expect(launchPhase(120, true, true)).toBe('handoff');
  expect(launchPhase(280, true, true)).toBe('complete');
  expect(launchPhase(280, false, true)).toBe('initializing');
});
