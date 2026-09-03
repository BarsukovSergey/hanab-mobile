import { describe, expect, test } from '@jest/globals';

import { getBackAction } from './navigationPolicy';

describe('C16A Android Back policy', () => {
  const base = {
    localScreen: 'lobby' as const,
    authenticated: true,
    roomKind: 'none' as const,
    roomRole: null,
    rematchPending: false,
  };

  test('History returns locally to Lobby', () => {
    expect(getBackAction({ ...base, localScreen: 'history' })).toBe('go_to_lobby');
  });

  test('Lobby allows system Back', () => {
    expect(getBackAction(base)).toBe('system');
  });

  test('pregame player consumes Back', () => {
    expect(getBackAction({ ...base, roomKind: 'pregame', roomRole: 'player' })).toBe('consume');
  });

  test('pregame spectator leaves with Back', () => {
    expect(getBackAction({ ...base, roomKind: 'pregame', roomRole: 'spectator' }))
      .toBe('leave_pregame');
  });

  test('awaiting bootstrap consumes Back', () => {
    expect(getBackAction({ ...base, roomKind: 'awaiting_game_bootstrap', roomRole: 'spectator' }))
      .toBe('consume');
  });

  test('live player consumes Back', () => {
    expect(getBackAction({ ...base, roomKind: 'live_game', roomRole: 'player' })).toBe('consume');
  });

  test('live spectator or replay unattends with Back', () => {
    expect(getBackAction({ ...base, roomKind: 'live_game', roomRole: 'spectator' }))
      .toBe('unattend');
  });

  test('authoritative live room remains protected while connection presentation is not ready', () => {
    expect(getBackAction({
      ...base, authenticated: false, roomKind: 'live_game', roomRole: 'player',
    })).toBe('consume');
  });

  test('rematch transition consumes Back', () => {
    expect(getBackAction({ ...base, rematchPending: true })).toBe('consume');
  });

  test('unauthenticated presentation allows system Back', () => {
    expect(getBackAction({ ...base, authenticated: false, localScreen: 'history' }))
      .toBe('system');
  });
});
