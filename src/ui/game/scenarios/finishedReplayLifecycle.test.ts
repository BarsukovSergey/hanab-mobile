import { describe, expect, test } from '@jest/globals';

import { GameBootstrapCoordinator } from '../../../game/bootstrap/GameBootstrapCoordinator';
import {
  cardIdentitiesSchema,
  gameActionListSchema,
  gameHistorySchema,
  gameInitSchema,
  incrementalGameActionSchema,
} from '../../../protocol/gameProtocol';
import { makeInit } from '../../../protocol/gameProtocol.fixtures';
import { roomActions } from '../../../store/roomSlice';
import { sessionActions } from '../../../store/sessionSlice';
import { createAppStore } from '../../../store/store';
import { getGameplayLayout } from '../gameplayLayout';

const TABLE_ID = 123;
const DATABASE_ID = 456;

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
    { type: 'turn' as const, num: 0, currentPlayerIndex: 0 },
  ];
}

describe('finished and replay gameplay lifecycle', () => {
  test('enters finished shared replay only after authoritative postgame reconciliation', () => {
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

    const load = coordinator.startFromAuthoritativeRoom(1);
    if (load === null) throw new Error('Expected bootstrap.');
    expect(coordinator.receiveInit(1, load, gameInitSchema.parse(makeInit({
      tableID: TABLE_ID,
      playerNames: ['Ada', 'Bob'],
      ourPlayerIndex: 0,
    })))).toBe(true);
    expect(coordinator.receiveHistory(1, load, gameActionListSchema.parse({
      tableID: TABLE_ID,
      list: deal(),
    }))).toBe(true);

    expect(coordinator.receiveIncremental(1, incrementalGameActionSchema.parse({
      tableID: TABLE_ID,
      action: { type: 'gameOver', endCondition: 1, playerIndex: 0, votes: null },
    }))).toBe(true);
    expect(coordinator.receiveIncremental(1, incrementalGameActionSchema.parse({
      tableID: TABLE_ID,
      action: { type: 'playerTimes', playerTimes: [60_000, 60_000], duration: 300_000 },
    }))).toBe(true);

    const afterGameOver = store.getState().room.room;
    if (afterGameOver.kind !== 'live_game') throw new Error('Expected live room before finish reconciliation.');
    expect(afterGameOver.clientState.finished).toBe(false);
    expect(afterGameOver.clientState.replay.databaseID).toBeNull();

    const history = gameHistorySchema.parse([{
      id: DATABASE_ID,
      options: makeInit().options,
      seed: 'p2v0s1',
      score: 0,
      numTurns: 0,
      endCondition: 1,
      datetimeStarted: '2026-08-31T00:00:00Z',
      datetimeFinished: '2026-08-31T00:05:00Z',
      numGamesOnThisSeed: 1,
      playerNames: ['Ada', 'Bob'],
      incrementNumGames: true,
      tags: '',
    }]);
    expect(coordinator.receiveGameHistory(1, history)).toBe(true);
    expect(coordinator.receiveCardIdentities(1, cardIdentitiesSchema.parse({
      tableID: TABLE_ID,
      cardIdentities: Array.from({ length: 10 }, (_, order) => ({
        suitIndex: order % 5,
        rank: (order % 5) + 1,
      })),
    }))).toBe(true);
    expect(coordinator.receiveFinishOngoingGame(1, {
      tableID: TABLE_ID,
      databaseID: DATABASE_ID,
      sharedReplayLeader: 'Ada',
    })).toBe(true);

    const finished = store.getState().room.room;
    if (finished.kind !== 'live_game') throw new Error('Expected finished live room.');
    expect(finished.clientState).toMatchObject({
      playing: false,
      finished: true,
      datetimeFinished: '2026-08-31T00:05:00Z',
      replay: {
        active: true,
        databaseID: DATABASE_ID,
        shared: { leader: 'Ada', amLeader: true, useSharedSegments: true },
      },
    });
    expect(finished.gameHistory).toMatchObject({ id: DATABASE_ID, endCondition: 1 });
    expect(finished.clientState.ongoingGame.deck[0]).toMatchObject({ suitIndex: 0, rank: 1 });
    expect(finished.clientState.replay.actions.at(-2)).toMatchObject({ type: 'gameOver', endCondition: 1 });
    expect(finished.clientState.replay.actions.at(-1)).toMatchObject({
      type: 'playerTimes', duration: 300_000,
    });

    const latestSegment = finished.clientState.ongoingGame.turn.segment;
    expect(latestSegment).not.toBeNull();
    expect(finished.clientState.replay.segment).toBe((latestSegment ?? 1) - 1);

    const portrait = getGameplayLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      handSizes: finished.clientState.visibleState?.hands.map((hand) => hand.length) ?? [],
      ourPlayerIndex: finished.clientState.metadata.ourPlayerIndex,
    });
    const landscape = getGameplayLayout({
      viewportWidth: 720,
      viewportHeight: 360,
      handSizes: finished.clientState.visibleState?.hands.map((hand) => hand.length) ?? [],
      ourPlayerIndex: finished.clientState.metadata.ourPlayerIndex,
    });
    expect(portrait.orientation).toBe('portrait');
    expect(landscape.orientation).toBe('landscape');
  });
});
