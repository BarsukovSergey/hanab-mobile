import { describe, expect, test } from '@jest/globals';
import {
  reconcilePresentationFocus,
  type PresentationFocus,
  type PresentationFocusMemory,
  type PresentationFocusObservation,
} from './presentationFocus';

const memory = (previousRoomKind: PresentationFocusMemory['previousRoomKind'] = 'none'): PresentationFocusMemory => ({
  previousConnectionEpoch: 1,
  previousRoomKind,
  preserveNextRoomEntry: false,
});

const observation = (
  roomKind: PresentationFocusObservation['roomKind'],
  changes: Partial<PresentationFocusObservation> = {},
): PresentationFocusObservation => ({
  connectionEpoch: 1,
  roomKind,
  roomMigrationPending: false,
  stableNoOwnedRoom: false,
  ...changes,
});

const step = (
  focus: PresentationFocus,
  prior: PresentationFocusMemory,
  roomKind: PresentationFocusObservation['roomKind'],
  changes: Partial<PresentationFocusObservation> = {},
) => reconcilePresentationFocus(focus, prior, observation(roomKind, changes));

describe('presentation focus reconciliation', () => {
  test('fresh none to room focuses room', () => {
    const result = step('browsing', memory(), 'pregame');
    expect(result.focus).toBe('room');
    expect(result.enteredRoom).toBe(true);
  });

  test('Pregame to bootstrap to Live preserves browsing focus', () => {
    const bootstrap = step('browsing', memory('pregame'), 'awaiting_game_bootstrap');
    const live = step(bootstrap.focus, bootstrap.memory, 'live_game');
    expect(bootstrap.focus).toBe('browsing');
    expect(live.focus).toBe('browsing');
    expect(bootstrap.enteredRoom).toBe(false);
    expect(live.enteredRoom).toBe(false);
  });

  test('reconnect room to none arms preservation', () => {
    const result = step('browsing', memory('live_game'), 'none', { connectionEpoch: 2 });
    expect(result.focus).toBe('browsing');
    expect(result.memory.preserveNextRoomEntry).toBe(true);
    expect(result.memory.previousConnectionEpoch).toBe(2);
  });

  test.each<PresentationFocus>(['browsing', 'room'])('recovered none to room preserves %s focus', (focus) => {
    const lost = step(focus, memory('live_game'), 'none', { connectionEpoch: 2 });
    const recovered = step(lost.focus, lost.memory, 'live_game', { connectionEpoch: 2 });
    expect(recovered.focus).toBe(focus);
    expect(recovered.enteredRoom).toBe(true);
    expect(recovered.memory.preserveNextRoomEntry).toBe(false);
  });

  test('rematch room to none to room preserves focus', () => {
    const pending = step('browsing', memory('live_game'), 'none', { roomMigrationPending: true });
    const next = step(pending.focus, pending.memory, 'pregame');
    expect(pending.memory.preserveNextRoomEntry).toBe(true);
    expect(next.focus).toBe('browsing');
    expect(next.memory.preserveNextRoomEntry).toBe(false);
  });

  test('stable authoritative no-room resets focus and clears preservation', () => {
    const lost = step('room', memory('live_game'), 'none', { connectionEpoch: 2 });
    const settled = step(lost.focus, lost.memory, 'none', { connectionEpoch: 2, stableNoOwnedRoom: true });
    expect(settled.focus).toBe('browsing');
    expect(settled.memory.preserveNextRoomEntry).toBe(false);
  });

  test('a recovered room later reaching stable authoritative none returns to browsing', () => {
    const lost = step('room', memory('live_game'), 'none', { connectionEpoch: 2 });
    const recovered = step(lost.focus, lost.memory, 'live_game', { connectionEpoch: 2 });
    const left = step(recovered.focus, recovered.memory, 'none', {
      connectionEpoch: 2,
      stableNoOwnedRoom: true,
    });
    expect(recovered.focus).toBe('room');
    expect(left.focus).toBe('browsing');
    expect(left.memory.preserveNextRoomEntry).toBe(false);
  });

  test('initial startup recovery still focuses room', () => {
    const startup = step('browsing', memory(), 'none', { connectionEpoch: 2 });
    const recovered = step(startup.focus, startup.memory, 'live_game', { connectionEpoch: 2 });
    expect(recovered.focus).toBe('room');
    expect(recovered.enteredRoom).toBe(true);
  });
});
