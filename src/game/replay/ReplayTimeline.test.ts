import { describe, expect, test } from '@jest/globals';

import {
  cardIdentitiesSchema,
  gameActionListSchema,
  gameInitSchema,
  type WireGameAction,
} from '../../protocol/gameProtocol';
import { makeInit } from '../../protocol/gameProtocol.fixtures';
import { createAppStore } from '../../store/store';
import { roomActions } from '../../store/roomSlice';
import { sessionActions } from '../../store/sessionSlice';
import { GameBootstrapCoordinator } from '../bootstrap/GameBootstrapCoordinator';
import { buildReplayTimeline, rehydrateScrubbedActions } from './ReplayTimeline';

function bootstrappedHistory(): WireGameAction[] {
  return gameActionListSchema.parse({ tableID: 123, list: [
    ...Array.from({ length: 5 }, (_, order) => ({
      type: 'draw' as const, playerIndex: 0, order, suitIndex: -1 as const, rank: -1 as const,
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      type: 'draw' as const,
      playerIndex: 1,
      order: index + 5,
      suitIndex: index,
      rank: index + 1,
    })),
    { type: 'turn', num: 0, currentPlayerIndex: 0 },
    { type: 'clue', clue: { type: 1, value: 1 }, giver: 0, list: [5], target: 1, turn: 0 },
    { type: 'turn', num: 1, currentPlayerIndex: 1 },
  ] }).list;
}

function liveMetadata() {
  const store = createAppStore();
  store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
  store.dispatch(sessionActions.welcomeReceived({
    epoch: 1,
    welcome: { userID: 1, username: 'Ada', playingAtTables: [] },
  }));
  store.dispatch(roomActions.joinRequested({ epoch: 1, tableID: 123 }));
  store.dispatch(roomActions.tableStartReceived({
    epoch: 1,
    tableStart: { tableID: 123, replay: false },
  }));
  const coordinator = new GameBootstrapCoordinator(store, () => true);
  coordinator.startFromAuthoritativeRoom(1);
  coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit()));
  coordinator.receiveHistory(1, 1, { tableID: 123, list: bootstrappedHistory() });
  const room = store.getState().room.room;
  if (room.kind !== 'live_game') throw new Error('Expected live game');
  return room.metadata;
}

describe('replay timeline', () => {
  test('stores intermediate states at upstream replay segment boundaries', () => {
    const timeline = buildReplayTimeline(liveMetadata(), 'player-live', bootstrappedHistory());
    expect(timeline.snapshots.map((snapshot) => snapshot.segment)).toEqual([0, 1]);
    expect(timeline.snapshots[0]?.game.turn.turnNum).toBe(0);
    expect(timeline.snapshots[1]?.game.turn.turnNum).toBe(1);
    expect(timeline.finalGame).toEqual(timeline.snapshots[1]?.game);
  });

  test('rehydrates only scrubbed draw/play/discard identities', () => {
    const actions = bootstrappedHistory();
    const identities = cardIdentitiesSchema.parse({
      tableID: 123,
      cardIdentities: Array.from({ length: 10 }, (_, order) => ({
        suitIndex: order % 5,
        rank: (order % 5) + 1,
      })),
    });
    const revealed = rehydrateScrubbedActions(actions, identities.cardIdentities);
    expect(revealed[0]).toMatchObject({ suitIndex: 0, rank: 1 });
    expect(revealed[10]).toEqual(actions[10]);
  });
});
