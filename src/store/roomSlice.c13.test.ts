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
      clock: null,
      clientState: {
        finished: true,
        metadata: {
          playerNames: ['Ada', 'Bob'],
          ourUsername: 'Ada',
        },
        replay: {
          states: [{}, {}, {}],
          hypothetical: null,
          shared: {
            amLeader: true, leader: 'Ada', segment: 1, useSharedSegments: true,
          },
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
      { index: 0, name: 'Ada', you: true, present: true, stats: pregameStats },
      { index: 1, name: 'Bob', you: false, present: true, stats: pregameStats },
    ],
    options,
    passwordProtected: false,
    maxPlayers: 5,
  };
}

const pregameStats = {
  numGames: 10,
  variant: {
    numGames: 5,
    averageScore: 20.4,
    numStrikeouts: 1,
    bestScores: [{ numPlayers: 2, score: 25, modifier: 0 }],
  },
};

function pregameState(role: 'player' | 'spectator', tableID = 123): RoomSliceState {
  const game = pregame(tableID);
  return {
    ...baseState(),
    connectionEpoch: 1,
    room: {
      kind: 'pregame',
      tableID,
      role,
      data: role === 'player'
        ? game
        : {
            ...game,
            players: game.players.map((player) => ({ ...player, you: false })),
          },
    },
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

describe('authoritative pregame removal', () => {
  test('matching unsolicited spectator left clears the room and a pending role switch', () => {
    let state = pregameState('spectator');
    state = roomSlice.reducer(state, roomActions.roleSwitchRequested({
      epoch: 1,
      tableID: 123,
      targetRole: 'player',
    }));
    expect(state.pendingRoleSwitch).not.toBeNull();

    state = roomSlice.reducer(state, roomActions.leftReceived({
      epoch: 1,
      left: { TableID: 123 },
    }));

    expect(state.room).toEqual({ kind: 'none' });
    expect(state.pendingRoleSwitch).toBeNull();
  });

  test('matching unsolicited player left remains ignored', () => {
    const state = pregameState('player');
    const next = roomSlice.reducer(state, roomActions.leftReceived({
      epoch: 1,
      left: { TableID: 123 },
    }));

    expect(next).toEqual(state);
  });

  test.each([
    { epoch: 0, tableID: 123 },
    { epoch: 1, tableID: 999 },
  ])('spectator left ignores stale or mismatched event %#', ({ epoch, tableID }) => {
    const state = pregameState('spectator');
    const next = roomSlice.reducer(state, roomActions.leftReceived({
      epoch,
      left: { TableID: tableID },
    }));

    expect(next).toEqual(state);
  });

  test('matching tableGone clears a pregame room and pending state', () => {
    let state = pregameState('spectator');
    state = roomSlice.reducer(state, roomActions.roleSwitchRequested({
      epoch: 1,
      tableID: 123,
      targetRole: 'player',
    }));

    state = roomSlice.reducer(state, lobbyActions.tableGone({ epoch: 1, tableID: 123 }));

    expect(state.room).toEqual({ kind: 'none' });
    expect(state.pendingRoleSwitch).toBeNull();
  });

  test('unrelated tableGone leaves the current pregame room unchanged', () => {
    const state = pregameState('spectator');
    const next = roomSlice.reducer(
      state,
      lobbyActions.tableGone({ epoch: 1, tableID: 999 }),
    );

    expect(next).toEqual(state);
  });
});

describe('shared replay suggestions', () => {
  const receive = (state: RoomSliceState, tableID = 123, userName = 'Alice', segment = 1) => (
    roomSlice.reducer(state, roomActions.replaySuggestionReceived({
      epoch: 1,
      suggestion: { tableID, userName, segment },
    }))
  );

  test('retains a valid leader suggestion and replaces it with the newer valid suggestion', () => {
    let state = receive(sharedReplayState(), 123, 'Alice', 1);
    expect(state.pendingReplaySuggestion).toMatchObject({
      connectionEpoch: 1, gameLoadEpoch: 7, tableID: 123, userName: 'Alice', segment: 1,
    });

    state = receive(state, 123, 'Bob', 3);
    expect(state.pendingReplaySuggestion).toMatchObject({ userName: 'Bob', segment: 3 });
  });

  test('ignores wrong-table, non-leader, hypothetical, and invalid-target suggestions', () => {
    const wrongTable = receive(sharedReplayState(), 999);
    expect(wrongTable.pendingReplaySuggestion).toBeNull();

    const follower = sharedReplayState();
    if (follower.room.kind !== 'live_game' || follower.room.clientState.replay.shared === null) {
      throw new Error('Expected shared replay');
    }
    follower.room.clientState = {
      ...follower.room.clientState,
      replay: {
        ...follower.room.clientState.replay,
        shared: { ...follower.room.clientState.replay.shared, amLeader: false },
      },
    };
    expect(receive(follower).pendingReplaySuggestion).toBeNull();

    const hypothetical = sharedReplayState();
    if (hypothetical.room.kind !== 'live_game') throw new Error('Expected shared replay');
    hypothetical.room.clientState = {
      ...hypothetical.room.clientState,
      replay: { ...hypothetical.room.clientState.replay, hypothetical: {} as never },
    };
    expect(receive(hypothetical).pendingReplaySuggestion).toBeNull();

    expect(receive(sharedReplayState(), 123, 'Alice', 10).pendingReplaySuggestion).toBeNull();
    expect(receive(sharedReplayState(), 123, 'Alice', 2).pendingReplaySuggestion).toBeNull();
  });

});
