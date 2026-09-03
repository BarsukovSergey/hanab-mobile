import { describe, expect, test } from '@jest/globals';

import { getBackAction } from './navigationPolicy';

describe('C16A Android Back policy', () => {
  const base = {
    localScreen: 'lobby' as const,
    authenticated: true,
    roomKind: 'none' as const,
    rematchPending: false,
  };

  test('History returns locally to Lobby', () => {
    expect(getBackAction({ ...base, localScreen: 'history' })).toBe('go_to_lobby');
  });

  test('Lobby allows system Back', () => {
    expect(getBackAction(base)).toBe('system');
  });

  test.each(['pregame', 'awaiting_game_bootstrap', 'live_game'] as const)(
    '%s consumes Back',
    (roomKind) => expect(getBackAction({ ...base, roomKind })).toBe('consume'),
  );

  test('authoritative room remains protected while connection presentation is not ready', () => {
    expect(getBackAction({ ...base, authenticated: false, roomKind: 'live_game' }))
      .toBe('consume');
  });

  test('rematch transition consumes Back', () => {
    expect(getBackAction({ ...base, rematchPending: true })).toBe('consume');
  });

  test('unauthenticated presentation allows system Back', () => {
    expect(getBackAction({ ...base, authenticated: false, localScreen: 'history' }))
      .toBe('system');
  });
});
