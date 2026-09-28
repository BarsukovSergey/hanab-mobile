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

  test('opening Settings again does not append another entry', () => {
    const settings = openBrowsingSettings(createBrowsingPresentation('people'));
    expect(openBrowsingSettings(settings)).toBe(settings);
    expect(settings.stack).toHaveLength(2);
  });

  test.each(['history', 'people', 'more'] as const)('root %s goes back to Home', (destination) => {
    expect(backBrowsing(createBrowsingPresentation(destination))).toEqual(createBrowsingPresentation('home'));
  });

  test('root Home leaves system Back available', () => {
    const home = createBrowsingPresentation('home');
    expect(backBrowsing(home)).toBe(home);
  });

  test('changing browsing root is a presentation-only transition', () => {
    const people = navigateBrowsing(createBrowsingPresentation('home'), 'people');
    expect(people).toEqual(createBrowsingPresentation('people'));
  });

});
