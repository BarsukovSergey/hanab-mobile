import { describe, expect, test } from '@jest/globals';

import { GameBootstrapCoordinator } from '../../../game/bootstrap/GameBootstrapCoordinator';
import { cardOrder } from '../../../game/upstream/types/CardOrder';
import { gameActionListSchema, gameInitSchema } from '../../../protocol/gameProtocol';
import { makeInit } from '../../../protocol/gameProtocol.fixtures';
import { roomActions } from '../../../store/roomSlice';
import { sessionActions } from '../../../store/sessionSlice';
import { createAppStore } from '../../../store/store';

const TABLE_ID = 123;
const OPPONENT_ORDER = cardOrder.parse(5);

function deal() {
  return [
    ...Array.from({ length: 5 }, (_, order) => ({
      type: 'draw' as const,
      playerIndex: 0,
      order,
      suitIndex: -1,
      rank: -1,
    })),
    ...Array.from({ length: 5 }, (_, position) => ({
      type: 'draw' as const,
      playerIndex: 1,
      order: position + 5,
      suitIndex: position,
      rank: position + 1,
    })),
  ];
}

function startBootstrap(store: ReturnType<typeof createAppStore>, coordinator: GameBootstrapCoordinator, epoch: number) {
  const gameLoadEpoch = coordinator.startFromAuthoritativeRoom(epoch);
  if (gameLoadEpoch === null) throw new Error('Expected bootstrap to start.');
  const init = gameInitSchema.parse(makeInit({ tableID: TABLE_ID }));
  expect(coordinator.receiveInit(epoch, gameLoadEpoch, init)).toBe(true);
  return gameLoadEpoch;
}

describe('reconnect gameplay restoration', () => {
  test('replaces the old live room and rejects stale connection/load mutations', () => {
    const store = createAppStore();
    const coordinator = new GameBootstrapCoordinator(store, () => true);

    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({
      epoch: 1,
      welcome: { userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [] },
    }));
    store.dispatch(roomActions.joinRequested({ epoch: 1, tableID: TABLE_ID }));
    store.dispatch(roomActions.tableStartReceived({
      epoch: 1,
      tableStart: { tableID: TABLE_ID, replay: false },
    }));

    const firstLoad = startBootstrap(store, coordinator, 1);
    expect(firstLoad).toBe(1);
    expect(coordinator.receiveHistory(1, firstLoad, gameActionListSchema.parse({
      tableID: TABLE_ID,
      list: [...deal(), { type: 'turn', num: 0, currentPlayerIndex: 0 }],
    }))).toBe(true);

    store.dispatch(roomActions.noteActionAccepted({
      connectionEpoch: 1,
      tableID: TABLE_ID,
      gameLoadEpoch: firstLoad,
      noteAction: { type: 'editNote', order: OPPONENT_ORDER, text: 'old connection note' },
    }));
    const beforeReconnect = store.getState().room.room;
    if (beforeReconnect.kind !== 'live_game') throw new Error('Expected first live room.');
    expect(beforeReconnect.clientState.notes.ourNotes[OPPONENT_ORDER]?.text).toBe('old connection note');

    coordinator.invalidateConnection(2);
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().room.room).toEqual({ kind: 'none' });

    store.dispatch(sessionActions.welcomeReceived({
      epoch: 2,
      welcome: { userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [TABLE_ID] },
    }));
    store.dispatch(roomActions.recoveryRequested({ epoch: 2, tableID: TABLE_ID, role: 'player' }));
    store.dispatch(roomActions.tableStartReceived({
      epoch: 2,
      tableStart: { tableID: TABLE_ID, replay: false },
    }));

    const secondLoad = startBootstrap(store, coordinator, 2);
    expect(secondLoad).toBe(2);
    expect(coordinator.receiveHistory(2, secondLoad, gameActionListSchema.parse({
      tableID: TABLE_ID,
      list: [
        ...deal(),
        { type: 'turn', num: 0, currentPlayerIndex: 0 },
        {
          type: 'clue',
          clue: { type: 0, value: 0 },
          giver: 0,
          list: [OPPONENT_ORDER],
          target: 1,
          turn: 0,
        },
      ],
    }))).toBe(true);

    const restored = store.getState().room.room;
    if (restored.kind !== 'live_game') throw new Error('Expected restored live room.');
    expect(restored.gameLoadEpoch).toBe(secondLoad);
    expect(restored.clientState.ongoingGame.turn.currentPlayerIndex).toBe(1);
    expect(restored.clientState.notes.ourNotes[OPPONENT_ORDER]?.text ?? '').toBe('');

    store.dispatch(roomActions.noteActionAccepted({
      connectionEpoch: 1,
      tableID: TABLE_ID,
      gameLoadEpoch: firstLoad,
      noteAction: { type: 'editNote', order: OPPONENT_ORDER, text: 'stale epoch' },
    }));
    store.dispatch(roomActions.noteActionAccepted({
      connectionEpoch: 2,
      tableID: TABLE_ID,
      gameLoadEpoch: firstLoad,
      noteAction: { type: 'editNote', order: OPPONENT_ORDER, text: 'stale load' },
    }));
    const afterStale = store.getState().room.room;
    if (afterStale.kind !== 'live_game') throw new Error('Expected restored live room after stale actions.');
    expect(afterStale.clientState.notes.ourNotes[OPPONENT_ORDER]?.text ?? '').toBe('');

    store.dispatch(roomActions.noteActionAccepted({
      connectionEpoch: 2,
      tableID: TABLE_ID,
      gameLoadEpoch: secondLoad,
      noteAction: { type: 'editNote', order: OPPONENT_ORDER, text: 'current load' },
    }));
    const current = store.getState().room.room;
    if (current.kind !== 'live_game') throw new Error('Expected current live room.');
    expect(current.clientState.notes.ourNotes[OPPONENT_ORDER]?.text).toBe('current load');
  });
});
