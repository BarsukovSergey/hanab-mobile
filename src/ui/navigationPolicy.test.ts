import { describe, expect, test } from '@jest/globals';

import { getBrowsingBackAction, getRoomAttendanceBackAction, isPregameLandscape } from './navigationPolicy';
import { createBrowsingPresentation } from './browsingNavigationState';

describe('browsing and room attendance Back ownership', () => {
  test('browsing Back returns from nested/non-home browsing surfaces', () => {
    expect(getBrowsingBackAction(createBrowsingPresentation('home'))).toBe('system');
    expect(getBrowsingBackAction(createBrowsingPresentation('history'))).toBe('back');
  });

  test('room attendance Back policy remains outside browsing policy', () => {
    expect(getRoomAttendanceBackAction({ kind: 'pregame', role: 'spectator' })).toBe('consume');
    expect(getRoomAttendanceBackAction({ kind: 'pregame', role: 'player' })).toBe('consume');
    expect(getRoomAttendanceBackAction({ kind: 'live_game', role: 'spectator' })).toBe('unattend');
    expect(getRoomAttendanceBackAction({ kind: 'live_game', role: 'player' })).toBe('consume');
    expect(getRoomAttendanceBackAction({ kind: 'awaiting_game_bootstrap', role: 'spectator' })).toBe('consume');
  });

  test('Pregame composition follows actual landscape bounds, including short-wide windows', () => {
    expect(isPregameLandscape(400, 800)).toBe(false);
    expect(isPregameLandscape(800, 400)).toBe(true);
    expect(isPregameLandscape(900, 600)).toBe(true);
  });

  test('unauthenticated browsing allows system Back', () => {
    expect(getBrowsingBackAction(createBrowsingPresentation('history'), false)).toBe('system');
  });
});
