import { describe, expect, test } from '@jest/globals';

import type { AppStore } from '../store/store';
import type { LobbyRuntime } from './LobbyRuntime';
import { TerminationRuntime } from './terminationRuntime';

function state(overrides: {
  phase?: 'ready' | 'closed';
  connectionEpoch?: number;
  roomConnectionEpoch?: number;
  role?: 'player' | 'spectator';
  sharedReplay?: boolean;
  finished?: boolean;
  replayActive?: boolean;
  currentPlayerIndex?: number | null;
} = {}) {
  return {
    session: {
      phase: overrides.phase ?? 'ready',
      connectionEpoch: overrides.connectionEpoch ?? 3,
    },
    room: {
      connectionEpoch: overrides.roomConnectionEpoch ?? 3,
      room: {
        kind: 'live_game' as const,
        tableID: 123,
        gameLoadEpoch: 7,
        role: overrides.role ?? 'player',
        sharedReplay: overrides.sharedReplay ?? false,
        clientState: {
          finished: overrides.finished ?? false,
          replay: { active: overrides.replayActive ?? false },
          ongoingGame: {
            turn: { currentPlayerIndex: overrides.currentPlayerIndex === undefined
              ? 0 : overrides.currentPlayerIndex },
          },
        },
      },
    },
  };
}

function harness(overrides: Parameters<typeof state>[0] = {}) {
  const snapshot = state(overrides);
  const calls: Array<[string, unknown]> = [];
  const lobbyRuntime = {
    send(command: string, payload?: unknown) {
      calls.push([command, payload]);
      return true;
    },
  } as Pick<LobbyRuntime, 'send'>;
  const store = {
    getState: () => snapshot,
  } as unknown as Pick<AppStore, 'getState'>;
  return { calls, runtime: new TerminationRuntime(lobbyRuntime, store), snapshot, store };
}

describe('C14-B2 termination runtime', () => {
  test('sends exact one-shot vote and terminate commands without local mutation', () => {
    const { calls, runtime, snapshot, store } = harness();

    expect(runtime.voteForTermination()).toBe(true);
    expect(runtime.terminateGame()).toBe(true);
    expect(calls).toEqual([
      ['tableVoteForTermination', { tableID: 123 }],
      ['tableTerminate', { tableID: 123 }],
    ]);
    expect(store.getState()).toBe(snapshot);
  });

  test.each(['valid', 'rematch', 'same-table load', 'reconnect', 'review', 'finished'] as const)(
    'captured confirmation rechecks ownership and eligibility: %s', (transition) => {
      const { runtime, snapshot, calls } = harness();
      const confirm = runtime.createTerminationConfirmation();
      expect(confirm).not.toBeNull();
      if (transition === 'rematch') snapshot.room.room.tableID = 456;
      if (transition === 'same-table load') snapshot.room.room.gameLoadEpoch += 1;
      if (transition === 'reconnect') {
        snapshot.session.connectionEpoch += 1;
        snapshot.room.connectionEpoch += 1;
      }
      if (transition === 'review') snapshot.room.room.clientState.replay.active = true;
      if (transition === 'finished') snapshot.room.room.clientState.finished = true;
      expect(confirm?.()).toBe(transition === 'valid');
      expect(calls).toEqual(transition === 'valid' ? [['tableTerminate', { tableID: 123 }]] : []);
    },
  );

  test.each([
    ['not ready', { phase: 'closed' as const }],
    ['stale room epoch', { roomConnectionEpoch: 2 }],
    ['spectator', { role: 'spectator' as const }],
    ['shared replay', { sharedReplay: true }],
    ['finished', { finished: true }],
    ['local review', { replayActive: true }],
    ['not running', { currentPlayerIndex: null }],
  ])('%s cannot send termination commands', (_name, overrides) => {
    const { calls, runtime } = harness(overrides);

    expect(runtime.voteForTermination()).toBe(false);
    expect(runtime.terminateGame()).toBe(false);
    expect(runtime.createTerminationConfirmation()).toBeNull();
    expect(calls).toEqual([]);
  });
});
