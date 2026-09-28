import { describe, expect, test } from '@jest/globals';

import { getBrowsingBackAction, getRoomAttendanceBackAction, isPregameLandscape } from './navigationPolicy';
import { createBrowsingPresentation } from './browsingNavigationState';
import { legacyResponsiveHints, measureWindow } from './responsiveSurface';

describe('browsing and room attendance Back ownership', () => {
  test('browsing Back returns from nested/non-home browsing surfaces', () => {
    expect(getBrowsingBackAction(createBrowsingPresentation('home'))).toBe('system');
    expect(getBrowsingBackAction(createBrowsingPresentation('history'))).toBe('back');
  });

  test('room attendance Back policy remains outside browsing policy', () => {
    expect(getRoomAttendanceBackAction({ kind: 'pregame', role: 'spectator' })).toBe('consume');
    expect(getRoomAttendanceBackAction({ kind: 'pregame', role: 'player' })).toBe('consume');
    expect(getRoomAttendanceBackAction({ kind: 'live_game', role: 'spectator' })).toBe('consume');
    expect(getRoomAttendanceBackAction({ kind: 'live_game', role: 'player' })).toBe('consume');
    expect(getRoomAttendanceBackAction({ kind: 'awaiting_game_bootstrap', role: 'spectator' })).toBe('consume');
    expect(getRoomAttendanceBackAction({ kind: 'awaiting_game_bootstrap', role: 'player' })).toBe('consume');
  });

  test('Pregame composition follows actual landscape bounds, including short-wide windows', () => {
    expect(isPregameLandscape(400, 800)).toBe(false);
    expect(isPregameLandscape(800, 400)).toBe(true);
    expect(isPregameLandscape(900, 600)).toBe(true);
  });

  test('Pregame orientation uses safe-area available geometry, not raw size or legacy wide', () => {
    const window = measureWindow({ width: 820, height: 800 }, { top: 0, right: 40, bottom: 0, left: 40 });
    expect(legacyResponsiveHints(window.rawWindow, window.windowClass).wide).toBe(true);
    expect(window.rawWindow.width).toBeGreaterThan(window.rawWindow.height);
    expect(window.availableWidth).toBeLessThan(window.availableHeight);
    expect(isPregameLandscape(window.availableWidth, window.availableHeight)).toBe(false);
  });

  test('unauthenticated browsing allows system Back', () => {
    expect(getBrowsingBackAction(createBrowsingPresentation('history'), false)).toBe('system');
  });
});
