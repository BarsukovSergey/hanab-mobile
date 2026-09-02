import { describe, expect, test } from '@jest/globals';

import type { State } from '../game/client/types/State';
import type { PregameGame } from '../protocol/lobbyProtocol';
import { lobbyActions } from './lobbySlice';
import { roomActions, roomSlice, type RoomSliceState } from './roomSlice';

const options = {
  variantName: 'No Variant',
  timed: false,
  timeBase: 0,
  timePerTurn: 0,
  speedrun: false,
  cardCycle: false,
  deckPlays: false,
  emptyClues: false,
  oneExtraCard: false,
  oneLessCard: false,
  allOrNothing: false,
  detrimentalCharacters: false,
};

function baseState(): RoomSliceState {
  return roomSlice.reducer(undefined, { type: '@@init' });
}

function sharedReplayState(): RoomSliceState {
  return {
    ...baseState(),
    connectionEpoch: 1,
    room: {
      kind: 'live_game',
      tableID: 123,
      role: 'spectator',
      sharedReplay: true,
      gameLoadEpoch: 7,
      bootstrapPhase: 'live',
      historyActionCount: 0,
      liveActionCount: 0,
      gameHistory: null,
      connected: null,
      clientState: {
        metadata: {
          playerNames: ['Ada', 'Bob'],
          ourUsername: 'Ada',
        },
        replay: {
          shared: { amLeader: true },
        },
      } as unknown as State,
    },
  };
}

function pregame(tableID = 456): PregameGame {
  return {
    tableID,
    name: 'Restarted table',
    owner: 1,
    players: [
      { index: 0, name: 'Ada', you: true, present: true },
      { index: 1, name: 'Bob', you: false, present: true },
    ],
    options,
    passwordProtected: false,
    maxPlayers: 5,
  };
}

describe('C13 restart lifecycle regressions', () => {
  test('idle replay tableGone closes the dead room but preserves the migration candidate', () => {
    let state = sharedReplayState();
    state = roomSlice.reducer(state, roomActions.bootReceived({
      epoch: 1,
      boot: { TableID: 123 },
    }));
    expect(state.room).toMatchObject({ kind: 'live_game', tableID: 123 });
    expect(state.rematchTransition).toMatchObject({
      oldTableID: 123,
      newTableID: null,
      role: 'player',
      hidePregame: null,
    });

    state = roomSlice.reducer(state, lobbyActions.tableGone({ epoch: 1, tableID: 123 }));
    expect(state.room).toEqual({ kind: 'none' });
    expect(state.rematchTransition).toMatchObject({ oldTableID: 123, newTableID: null });
  });

  test('pregame restart accepts real server order game -> own user confirmation -> joined', () => {
    let state: RoomSliceState = {
      ...sharedReplayState(),
      pendingRestartTableID: 123,
      pendingRestartHidePregame: false,
    };
    state = roomSlice.reducer(state, roomActions.bootReceived({
      epoch: 1,
      boot: { TableID: 123 },
    }));

    const game = pregame();
    state = roomSlice.reducer(state, roomActions.gameReceived({ epoch: 1, game }));
    expect(state.room).toMatchObject({ kind: 'live_game', tableID: 123 });
    expect(state.rematchTransition).toMatchObject({
      newTableID: null,
      stagedGame: { tableID: 456 },
      hidePregame: false,
    });

    state = roomSlice.reducer(state, roomActions.restartMigrationConfirmed({
      epoch: 1,
      tableID: 456,
      role: 'player',
    }));
    expect(state.room).toEqual({ kind: 'none' });
    expect(state.rematchTransition).toMatchObject({
      newTableID: 456,
      stagedGame: { tableID: 456 },
    });

    state = roomSlice.reducer(state, roomActions.joinedReceived({
      epoch: 1,
      joined: { tableID: 456 },
    }));
    expect(state.rematchTransition).toBeNull();
    expect(state.room).toMatchObject({
      kind: 'pregame',
      tableID: 456,
      role: 'player',
      data: { tableID: 456 },
    });
  });

  test('warning/error cleanup releases leave, recovery, and stale migration state', () => {
    const game = pregame();
    const state: RoomSliceState = {
      ...sharedReplayState(),
      pendingLeaveTableID: 123,
      pendingRecovery: { tableID: 456, role: 'player' },
      recoveryJoinedConfirmed: true,
      recoveryStagedGame: game,
      rematchTransition: {
        oldTableID: 123,
        originalPlayerNames: ['Ada', 'Bob'],
        role: 'player',
        newTableID: 456,
        joinedConfirmed: false,
        stagedGame: game,
        hidePregame: false,
      },
    };

    const next = roomSlice.reducer(state, roomActions.commandPendingCleared({ epoch: 1 }));
    expect(next.pendingLeaveTableID).toBeNull();
    expect(next.pendingRecovery).toBeNull();
    expect(next.recoveryJoinedConfirmed).toBe(false);
    expect(next.recoveryStagedGame).toBeNull();
    expect(next.rematchTransition).toBeNull();
  });
});
