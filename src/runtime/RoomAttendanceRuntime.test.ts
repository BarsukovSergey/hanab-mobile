import { describe, expect, jest, test } from '@jest/globals';

import { GameBootstrapCoordinator } from '../game/bootstrap/GameBootstrapCoordinator';
import { clientGameplayActionSchema, gameActionListSchema, gameInitSchema } from '../protocol/gameProtocol';
import { makeInit } from '../protocol/gameProtocol.fixtures';
import { pregameGameSchema, type LobbyTable } from '../protocol/lobbyProtocol';
import { historyActions } from '../store/historySlice';
import { lobbyActions } from '../store/lobbySlice';
import { roomActions, type RoomSliceState } from '../store/roomSlice';
import { sessionActions } from '../store/sessionSlice';
import { createAppStore } from '../store/store';
import { RoomAttendanceRuntime } from './RoomAttendanceRuntime';

const options = {
  variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
  speedrun: false, cardCycle: false, deckPlays: false, emptyClues: false,
  oneExtraCard: false, oneLessCard: false, allOrNothing: false,
  detrimentalCharacters: false,
};
const table: LobbyTable = {
  id: 123, name: 'Table', numPlayers: 2, maxPlayers: 5, running: false,
  variant: 'No Variant', options, passwordProtected: false, joined: false,
  progress: 0, players: ['Ada', 'Bob'], spectators: [], sharedReplay: false,
};

function makeRuntime(changes: Partial<LobbyTable> = {}) {
  const store = createAppStore();
  store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
  store.dispatch(sessionActions.welcomeReceived({
    epoch: 1, welcome: { userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [] },
  }));
  store.dispatch(lobbyActions.tableReceived({ epoch: 1, table: { ...table, ...changes } }));
  const send = jest.fn<(frame: string) => boolean>().mockReturnValue(true);
  const ready = jest.fn<(tableID: number) => boolean>().mockReturnValue(true);
  const runtime = new RoomAttendanceRuntime(store, send, ready);
  return { store, send, ready, runtime };
}

function makePregame(role: 'player' | 'spectator', changes: Partial<LobbyTable> = {}) {
  const result = makeRuntime(changes);
  const { store } = result;
  store.dispatch(roomActions.joinRequested({ epoch: 1, tableID: 123, role }));
  store.dispatch(roomActions.gameReceived({ epoch: 1, game: pregameGameSchema.parse({
    tableID: 123, name: 'Table', owner: 1, options,
    passwordProtected: changes.passwordProtected ?? false, maxPlayers: changes.maxPlayers ?? 5,
    players: (changes.players ?? ['Ada', 'Bob']).map((name, index) => ({
      index, name, you: role === 'player' && name === 'Ada', present: true,
      stats: { numGames: 0, variant: { numGames: 0, averageScore: 0, numStrikeouts: 0, bestScores: [] } },
    })),
  }) }));
  store.dispatch(roomActions.joinedReceived({ epoch: 1, joined: { tableID: 123 } }));
  expect(store.getState().room.room).toMatchObject({ kind: 'pregame', role });
  return result;
}

function makeLive(role: 'player' | 'spectator', initChanges: Parameters<typeof makeInit>[0] = {}) {
  const result = makeRuntime({ running: true });
  const { store } = result;
  if (role === 'spectator') store.dispatch(roomActions.spectateRequested({ epoch: 1, tableID: 123 }));
  else store.dispatch(roomActions.joinRequested({ epoch: 1, tableID: 123 }));
  store.dispatch(roomActions.tableStartReceived({ epoch: 1, tableStart: { tableID: 123, replay: false } }));
  const bootstrap = new GameBootstrapCoordinator(store, () => true);
  const loadEpoch = bootstrap.startFromAuthoritativeRoom(1)!;
  bootstrap.receiveInit(1, loadEpoch, gameInitSchema.parse(makeInit({
    spectating: role === 'spectator', ...initChanges,
  })));
  bootstrap.receiveHistory(1, loadEpoch, gameActionListSchema.parse({
    tableID: 123, list: [{ type: 'turn', num: 0, currentPlayerIndex: 0 }],
  }));
  expect(store.getState().room.room).toMatchObject({ kind: 'live_game', role });
  return result;
}

// Isolate each gate, including pending states normally created in other room kinds.
// These snapshots are read-only: a gated call must never dispatch or send.
const pendingStates = {
  pendingRecovery: { tableID: 456, role: 'player' },
  pendingSpectateTableID: 456,
  pendingJoin: { tableID: 456, role: 'player', joinedConfirmed: false, stagedGame: null },
  pendingCreate: { name: 'Other table', creatorUserID: 1, joinedTableID: null, stagedGame: null },
  pendingLeaveTableID: 456,
  pendingUnattendTableID: 456,
  pendingStart: { tableID: 456, intendedPlayers: ['Ada', 'Bob'] },
  pendingUpdate: { tableID: 456, name: 'Other table', maxPlayers: 5, ...options },
  pendingLeaderName: 'Bob',
  pendingRestartTableID: 456,
  pendingRestartHidePregame: false,
  rematchTransition: {
    oldTableID: 456, originalPlayerNames: ['Ada', 'Bob'], role: 'player', newTableID: null,
    joinedConfirmed: false, stagedGame: null, hidePregame: null,
  },
  pendingRoleSwitch: {
    tableID: 456, targetRole: 'spectator', leaveSent: false, spectateSent: false,
    rejected: false, leftConfirmed: false, joinedConfirmed: false, stagedGame: null,
  },
  pendingGameplayAction: {
    connectionEpoch: 1, tableID: 456, gameLoadEpoch: 1,
    action: clientGameplayActionSchema.parse({ tableID: 456, type: 0, target: 0 }),
  },
  pendingHypotheticalOperation: {
    connectionEpoch: 1, tableID: 456, gameLoadEpoch: 1,
    finalAction: { type: 'turn', num: 1, currentPlayerIndex: 0 },
  },
  pendingReplaySuggestion: { connectionEpoch: 1, tableID: 456, gameLoadEpoch: 1, segment: 0, userName: 'Ada' },
} satisfies Partial<RoomSliceState>;

function withPending(result: ReturnType<typeof makeRuntime>, key: keyof typeof pendingStates) {
  const state = result.store.getState();
  jest.spyOn(result.store, 'getState').mockReturnValue({
    ...state, room: { ...state.room, [key]: pendingStates[key] },
  });
}

describe('RoomAttendanceRuntime collaborator', () => {
  test.each(['spectate', 'join', 'reattend', 'openLiveGameByID', 'openPregameByID'] as const)(
    '%s sends once, records intent only after sending, and preserves authoritative room', (method) => {
      const result = makeRuntime({
        running: method === 'spectate' || method === 'reattend' || method === 'openLiveGameByID',
        joined: method === 'reattend',
      });
      const { runtime, store, send } = result;
      const before = store.getState().room;
      send.mockImplementationOnce(() => {
        expect(store.getState().room).toBe(before);
        return true;
      });
      expect(runtime[method](123)).toBe(true);
      expect(runtime[method](123)).toBe(false);
      const command = method === 'reattend' ? 'tableReattend'
        : method === 'spectate' || method === 'openLiveGameByID' ? 'tableSpectate' : 'tableJoin';
      expect(send.mock.calls).toEqual([[command === 'tableSpectate'
        ? 'tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}' : `${command} {"tableID":123}`]]);
      expect(store.getState().room.room).toBe(before.room);
      if (method === 'reattend') expect(store.getState().room.pendingRecovery).toEqual({ tableID: 123, role: 'player' });
      else if (command === 'tableSpectate') expect(store.getState().room.pendingSpectateTableID).toBe(123);
      else expect(store.getState().room.pendingJoin).toMatchObject({ tableID: 123, role: 'player' });
    },
  );

  test('pregame spectate records spectator join, including full password-protected tables', () => {
    const { runtime, store, send } = makeRuntime({ numPlayers: 5, passwordProtected: true });
    expect(runtime.spectate(123)).toBe(true);
    expect(send).toHaveBeenCalledWith('tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}');
    expect(store.getState().room.pendingSpectateTableID).toBeNull();
    expect(store.getState().room.pendingJoin).toMatchObject({ tableID: 123, role: 'spectator' });
  });

  test.each(['spectate', 'join', 'reattend'] as const)('%s retains lobby eligibility', (method) => {
    const cases: Partial<LobbyTable>[] = [
      { options: { ...options, variantName: 'Unsupported' } },
      { options: { ...options, speedrun: true } },
      ...(method === 'spectate' ? [{ joined: true }, { running: false, sharedReplay: true }]
        : method === 'join' ? [{ running: true }, { joined: true }, { sharedReplay: true }, { numPlayers: 5 }]
          : [{ running: false }, { joined: false }, { sharedReplay: true }]),
    ];
    for (const changes of cases) {
      const { runtime, store, send } = makeRuntime({
        running: method !== 'join', joined: method === 'reattend', ...changes,
      });
      const before = store.getState();
      expect(runtime[method](123)).toBe(false);
      expect(runtime[method](999)).toBe(false);
      expect(send).not.toHaveBeenCalled();
      expect(store.getState()).toBe(before);
    }
    const replay = makeRuntime({ running: true, joined: true, sharedReplay: true });
    expect(replay.runtime.spectate(123)).toBe(true);
  });

  test.each(Object.keys(pendingStates) as Array<keyof typeof pendingStates>)(
    'open-by-ID rejects %s without sending', (key) => {
      for (const method of ['openLiveGameByID', 'openPregameByID'] as const) {
        const result = makeRuntime({ running: method === 'openLiveGameByID' });
        withPending(result, key);
        const before = result.store.getState();
        expect(result.runtime[method](123)).toBe(false);
        expect(result.send).not.toHaveBeenCalled();
        expect(result.store.getState()).toBe(before);
      }
    },
  );

  test.each(['pendingRecovery', 'pendingSpectateTableID', 'pendingJoin', 'pendingCreate'] as const)(
    'attendance entry rejects %s', (key) => {
      for (const method of ['spectate', 'join', 'reattend'] as const) {
        const result = makeRuntime({ running: method !== 'join', joined: method === 'reattend' });
        withPending(result, key);
        expect(result.runtime[method](123)).toBe(false);
        expect(result.send).not.toHaveBeenCalled();
      }
    },
  );

  test('historical replay creation and an occupied room block all entry paths', () => {
    for (const conflict of ['replay', 'occupied'] as const) {
      for (const method of ['spectate', 'join', 'reattend', 'openLiveGameByID', 'openPregameByID'] as const) {
        const result = conflict === 'occupied' ? makePregame('player') : makeRuntime();
        const { store, runtime, send } = result;
        const targetTableID = conflict === 'occupied' ? 456 : 123;
        store.dispatch(lobbyActions.tableReceived({ epoch: 1, table: {
          ...table, id: targetTableID,
          running: !['join', 'openPregameByID'].includes(method), joined: method === 'reattend',
        } }));
        if (conflict === 'replay') store.dispatch(historyActions.externalReplayCreateRequested({
          connectionEpoch: 1, source: 'id', databaseID: 88, visibility: 'solo',
        }));
        const before = store.getState();
        expect(runtime[method](targetTableID)).toBe(false);
        expect(send).not.toHaveBeenCalled();
        expect(store.getState()).toBe(before);
      }
    }
  });

  test('open live chooses reattend for our table and spectate for a joined shared replay', () => {
    for (const sharedReplay of [false, true]) {
      const { runtime, store, send } = makeRuntime({ running: true, joined: true, sharedReplay });
      expect(runtime.openLiveGameByID(123)).toBe(true);
      expect(send).toHaveBeenCalledWith(sharedReplay
        ? 'tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}' : 'tableReattend {"tableID":123}');
      expect(store.getState().room.pendingRecovery).toEqual(sharedReplay ? null : { tableID: 123, role: 'player' });
    }
  });

  test.each(['join', 'openPregameByID'] as const)('%s requires a protected password and omits unneeded passwords', (method) => {
    const protectedRoom = makeRuntime({ passwordProtected: true });
    expect(protectedRoom.runtime[method](123)).toBe(false);
    expect(protectedRoom.runtime[method](123, '')).toBe(false);
    expect(protectedRoom.send).not.toHaveBeenCalled();
    expect(protectedRoom.runtime[method](123, 'fixture password')).toBe(true);
    expect(protectedRoom.send).toHaveBeenCalledWith('tableJoin {"tableID":123,"password":"fixture password"}');
    expect(JSON.stringify(protectedRoom.store.getState())).not.toContain('fixture password');
    const publicRoom = makeRuntime();
    expect(publicRoom.runtime[method](123, 'unused password')).toBe(true);
    expect(publicRoom.send).toHaveBeenCalledWith('tableJoin {"tableID":123}');
  });

  test.each(['spectate', 'join', 'reattend', 'openLiveGameByID', 'openPregameByID'] as const)(
    '%s failed READY-gated send leaves no intent', (method) => {
      const { runtime, store, send } = makeRuntime({
        running: !['join', 'openPregameByID'].includes(method), joined: method === 'reattend',
      });
      send.mockReturnValue(false);
      const before = store.getState();
      expect(runtime[method](123)).toBe(false);
      expect(store.getState()).toBe(before);
      send.mockReturnValue(true);
      expect(send).toHaveBeenCalledTimes(1);
    },
  );

  test.each(['openLiveGameByID', 'openPregameByID'] as const)('%s explicitly rejects non-READY state', (method) => {
    const { runtime, store, send } = makeRuntime({ running: method === 'openLiveGameByID' });
    store.dispatch(sessionActions.connectionClosed({ epoch: 1, error: null }));
    expect(runtime[method](123)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  test.each(['player', 'spectator'] as const)('pregame %s leave selects the existing frame and waits for authority', (role) => {
    const { runtime, store, send } = makePregame(role);
    const before = store.getState().room.room;
    expect(runtime.leave(999)).toBe(false);
    expect(runtime.unattendLiveGame(123)).toBe(false);
    send.mockReturnValueOnce(false);
    expect(runtime.leave(123)).toBe(false);
    expect(store.getState().room.pendingLeaveTableID).toBeNull();
    expect(runtime.leave(123)).toBe(true);
    expect(runtime.leave(123)).toBe(false);
    expect(send.mock.calls).toEqual(Array.from({ length: 2 }, () => [
      `${role === 'player' ? 'tableLeave' : 'tableUnattend'} {"tableID":123}`,
    ]));
    expect(store.getState().room.room).toBe(before);
    expect(store.getState().room.pendingLeaveTableID).toBe(123);
  });

  test.each(['player', 'spectator'] as const)('live %s unattend sends once without optimistic exit', (role) => {
    const { runtime, store, send } = makeLive(role);
    const before = store.getState().room.room;
    expect(runtime.leave(123)).toBe(false);
    expect(runtime.unattendLiveGame(999)).toBe(false);
    send.mockReturnValueOnce(false);
    expect(runtime.unattendLiveGame(123)).toBe(false);
    expect(store.getState().room.pendingUnattendTableID).toBeNull();
    expect(runtime.unattendLiveGame(123)).toBe(true);
    expect(runtime.unattendLiveGame(123)).toBe(false);
    expect(send.mock.calls).toEqual(Array.from({ length: 2 }, () => ['tableUnattend {"tableID":123}']));
    expect(store.getState().room.room).toBe(before);
    expect(store.getState().room.pendingUnattendTableID).toBe(123);
  });

  test.each(['first-fails', 'second-fails', 'success'] as const)('switchToSpectator preserves ordering (%s)', (outcome) => {
    const { runtime, store, send } = makePregame('player');
    const before = store.getState().room.room;
    send.mockImplementationOnce((frame) => {
      expect(frame).toBe('tableLeave {"tableID":123}');
      expect(store.getState().room.pendingRoleSwitch).toMatchObject({
        targetRole: 'spectator', leaveSent: false, spectateSent: false,
      });
      return outcome !== 'first-fails';
    }).mockImplementationOnce((frame) => {
      expect(frame).toBe('tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}');
      expect(store.getState().room.pendingRoleSwitch).toMatchObject({ leaveSent: true, spectateSent: false });
      return outcome === 'success';
    });
    expect(runtime.switchToSpectator()).toBe(outcome === 'success');
    expect(store.getState().room.room).toBe(before);
    if (outcome === 'first-fails') {
      expect(send).toHaveBeenCalledTimes(1);
      expect(store.getState().room.pendingRoleSwitch).toBeNull();
    } else {
      expect(send).toHaveBeenCalledTimes(2);
      expect(store.getState().room.pendingRoleSwitch).toMatchObject({
        targetRole: 'spectator', leaveSent: true, spectateSent: outcome === 'success',
      });
      const pending = store.getState().room.pendingRoleSwitch;
      expect(runtime.switchToSpectator()).toBe(false);
      expect(runtime.leave(123)).toBe(false);
      expect(send).toHaveBeenCalledTimes(2);
      expect(store.getState().room.pendingRoleSwitch).toBe(pending);
      store.dispatch(roomActions.leftReceived({ epoch: 1, left: { TableID: 123 } }));
      expect(store.getState().room.room.kind).toBe(outcome === 'success' ? 'pregame' : 'none');
      expect(send).toHaveBeenCalledTimes(2);
    }
  });

  test.each([false, true])('joinAsPlayer creates intent before sending and cancels only on failure (sent=%s)', (sent) => {
    const { runtime, store, send } = makePregame('spectator', { passwordProtected: true });
    const before = store.getState().room.room;
    expect(runtime.joinAsPlayer()).toBe(false);
    expect(runtime.joinAsPlayer('')).toBe(false);
    expect(send).not.toHaveBeenCalled();
    send.mockImplementationOnce((frame) => {
      expect(frame).toBe('tableJoin {"tableID":123,"password":"fixture password"}');
      expect(store.getState().room.pendingRoleSwitch).toMatchObject({ targetRole: 'player', leaveSent: false });
      return sent;
    });
    expect(runtime.joinAsPlayer('fixture password')).toBe(sent);
    expect(store.getState().room.room).toBe(before);
    expect(JSON.stringify(store.getState())).not.toContain('fixture password');
    if (sent) {
      expect(store.getState().room.pendingRoleSwitch).toMatchObject({ targetRole: 'player' });
      expect(runtime.joinAsPlayer('fixture password')).toBe(false);
    } else expect(store.getState().room.pendingRoleSwitch).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('joinAsPlayer omits public-table password and rejects full seats; solo players cannot switch', () => {
    const publicRoom = makePregame('spectator');
    expect(publicRoom.runtime.joinAsPlayer('unused password')).toBe(true);
    expect(publicRoom.send).toHaveBeenCalledWith('tableJoin {"tableID":123}');
    const full = makePregame('spectator', { maxPlayers: 2 });
    expect(full.runtime.joinAsPlayer()).toBe(false);
    expect(full.send).not.toHaveBeenCalled();
    const solo = makePregame('player', { players: ['Ada'] });
    expect(solo.runtime.switchToSpectator()).toBe(false);
    expect(solo.send).not.toHaveBeenCalled();
  });

  test.each(['pendingRoleSwitch', 'pendingLeaveTableID', 'pendingStart'] as const)(
    'pregame attendance mutations reject %s', (key) => {
      for (const role of ['player', 'spectator'] as const) {
        const result = makePregame(role);
        withPending(result, key);
        expect(result.runtime.leave(123)).toBe(false);
        expect(result.runtime.switchToSpectator()).toBe(false);
        expect(result.runtime.joinAsPlayer()).toBe(false);
        expect(result.send).not.toHaveBeenCalled();
      }
    },
  );

  test('spectator perspective preserves index validation, readiness, and authoritative state', () => {
    const { runtime, store, send, ready } = makeLive('spectator');
    const before = store.getState();
    for (const index of [-2, 2, 0.5, NaN, -1]) expect(runtime.setSpectatorPerspective(index)).toBe(false);
    expect(send).not.toHaveBeenCalled();
    ready.mockReturnValue(false);
    expect(runtime.setSpectatorPerspective(1)).toBe(false);
    expect(ready).toHaveBeenCalledWith(123);
    expect(send).not.toHaveBeenCalled();
    ready.mockReturnValue(true);
    send.mockReturnValueOnce(false);
    expect(runtime.setSpectatorPerspective(1)).toBe(false);
    expect(runtime.setSpectatorPerspective(1)).toBe(true);
    expect(send.mock.calls).toEqual(Array.from({ length: 2 }, () => ['tableSpectate {"tableID":123,"shadowingPlayerIndex":1}']));
    expect(store.getState()).toBe(before);
    const shadowing = makeLive('spectator', { shadowing: true, ourPlayerIndex: 1 });
    expect(shadowing.runtime.setSpectatorPerspective(1)).toBe(false);
    expect(shadowing.runtime.setSpectatorPerspective(-1)).toBe(true);
    expect(shadowing.send).toHaveBeenCalledWith('tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}');
    const player = makeLive('player');
    expect(player.runtime.setSpectatorPerspective(1)).toBe(false);
    expect(player.send).not.toHaveBeenCalled();
  });

  test.each(['finished', 'database replay', 'shared room', 'shared replay state', 'no turn'] as const)(
    'spectator perspective rejects %s', (mode) => {
      const { runtime, store, send } = makeLive('spectator');
      const state = store.getState();
      const room = state.room.room;
      if (room.kind !== 'live_game') throw new Error('Expected live game');
      jest.spyOn(store, 'getState').mockReturnValue({ ...state, room: { ...state.room, room: {
        ...room,
        sharedReplay: mode === 'shared room',
        clientState: {
          ...room.clientState, finished: mode === 'finished',
          replay: {
            ...room.clientState.replay,
            databaseID: mode === 'database replay' ? 88 : null,
            shared: mode === 'shared replay state' ? {
              segment: 0, leader: 'Bob', amLeader: false, useSharedSegments: true,
            } : null,
          },
          ongoingGame: { ...room.clientState.ongoingGame, turn: {
            ...room.clientState.ongoingGame.turn, currentPlayerIndex: mode === 'no turn' ? null : 0,
          } },
        },
      } } });
      expect(runtime.setSpectatorPerspective(1)).toBe(false);
      expect(send).not.toHaveBeenCalled();
    },
  );
});
