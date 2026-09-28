import { describe, expect, test } from '@jest/globals';

import {
  backBrowsing,
  createBrowsingPresentation,
  isBrowsingSettings,
  navigateBrowsing,
  openBrowsingSettings,
} from './browsingNavigationState';

describe('browsing presentation state', () => {
  test.each(['home', 'history', 'people', 'more'] as const)('represents %s as a browsing root', (destination) => {
    const state = createBrowsingPresentation(destination);
    expect(state.destination).toBe(destination);
    expect(state.stack).toEqual([{ kind: 'root', destination }]);
  });

  test('settings is nested and retains the browsing origin', () => {
    const state = openBrowsingSettings(createBrowsingPresentation('more'));
    expect(isBrowsingSettings(state)).toBe(true);
    expect(state.destination).toBe('more');
    expect(backBrowsing(state)).toEqual(createBrowsingPresentation('more'));
  });

  test('changing browsing root is a presentation-only transition', () => {
    const people = navigateBrowsing(createBrowsingPresentation('home'), 'people');
    expect(people).toEqual(createBrowsingPresentation('people'));
  });

  test('room foreground ownership does not mutate browsing presentation state', () => {
    const browsing = openBrowsingSettings(createBrowsingPresentation('people'));
    const roomForeground = { kind: 'live_game', tableID: 12 };
    expect(roomForeground.kind).toBe('live_game');
    expect(browsing).toEqual({
      destination: 'people',
      stack: [{ kind: 'root', destination: 'people' }, { kind: 'settings', origin: 'people' }],
    });
  });
});
