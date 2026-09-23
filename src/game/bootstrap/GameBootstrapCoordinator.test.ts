import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  cardIdentitiesSchema,
  gameActionListSchema,
  gameHistorySchema,
  gameInitSchema,
  incrementalGameActionSchema,
} from '../../protocol/gameProtocol';
import { makeInit } from '../../protocol/gameProtocol.fixtures';
import { roomActions } from '../../store/roomSlice';
import { sessionActions } from '../../store/sessionSlice';
import { createAppStore } from '../../store/store';
import { GameBootstrapCoordinator, replayAuthoritativeHistory } from './GameBootstrapCoordinator';

const welcome = {
  userID: 1,
  username: 'Ada',
  totalGames: 0,
  playingAtTables: [],
};

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

function readyStore(role: 'player' | 'spectator') {
  const store = createAppStore();
  store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
  store.dispatch(sessionActions.welcomeReceived({ epoch: 1, welcome }));
  if (role === 'spectator') {
    store.dispatch(roomActions.spectateRequested({ epoch: 1, tableID: 123 }));
  } else {
    store.dispatch(roomActions.joinRequested({ epoch: 1, tableID: 123 }));
  }
  store.dispatch(roomActions.tableStartReceived({
    epoch: 1,
    tableStart: { tableID: 123, replay: false },
  }));
  return store;
}

function initialHistory() {
  return gameActionListSchema.parse({
    tableID: 123,
    list: [
      { type: 'draw', playerIndex: 0, order: 0, suitIndex: -1, rank: -1 },
      { type: 'draw', playerIndex: 0, order: 1, suitIndex: -1, rank: -1 },
      { type: 'draw', playerIndex: 0, order: 2, suitIndex: -1, rank: -1 },
      { type: 'draw', playerIndex: 0, order: 3, suitIndex: -1, rank: -1 },
      { type: 'draw', playerIndex: 0, order: 4, suitIndex: -1, rank: -1 },
      { type: 'draw', playerIndex: 1, order: 5, suitIndex: 0, rank: 1 },
      { type: 'draw', playerIndex: 1, order: 6, suitIndex: 1, rank: 2 },
      { type: 'draw', playerIndex: 1, order: 7, suitIndex: 2, rank: 3 },
      { type: 'draw', playerIndex: 1, order: 8, suitIndex: 3, rank: 4 },
      { type: 'draw', playerIndex: 1, order: 9, suitIndex: 4, rank: 5 },
      { type: 'status', clues: 8, score: 0, maxScore: 25 },
      { type: 'turn', num: 0, currentPlayerIndex: 0 },
    ],
  });
}

describe('authoritative game bootstrap coordinator', () => {
  test('stages only the latest matching pause after init and normalizes unpause sentinel', () => {
    const store = readyStore('player');
    const coordinator = new GameBootstrapCoordinator(store, () => true);
    expect(coordinator.startFromAuthoritativeRoom(1)).toBe(1);
    expect(coordinator.receivePause(1, {
      tableID: 123, active: true, playerIndex: 0,
    }, 1_000)).toBe(false);
    expect(coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit({
      paused: true, pausePlayerIndex: 1,
    })))).toBe(true);
    expect(coordinator.receivePause(1, {
      tableID: 999, active: true, playerIndex: 0,
    }, 2_000)).toBe(false);
    expect(coordinator.receivePause(1, {
      tableID: 123, active: true, playerIndex: 0,
    }, 3_000)).toBe(true);
    expect(coordinator.receivePause(1, {
      tableID: 123, active: false, playerIndex: -1,
    }, 4_000)).toBe(true);
    expect(coordinator.receiveHistory(1, 1, initialHistory())).toBe(true);
    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected LIVE');
    expect(room.clientState.pause).toEqual({ active: false, playerIndex: 1, queued: false });
  });

  test('shared replay bootstraps through spectator semantics without loaded', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({ epoch: 1, welcome }));
    store.dispatch(roomActions.spectateRequested({ epoch: 1, tableID: 123 }));
    store.dispatch(roomActions.tableStartReceived({
      epoch: 1,
      tableStart: { tableID: 123, replay: true },
    }));
    const frames: string[] = [];
    const coordinator = new GameBootstrapCoordinator(store, (frame) => {
      frames.push(frame);
      return true;
    });

    expect(coordinator.startFromAuthoritativeRoom(1)).toBe(1);
    const init = gameInitSchema.parse(makeInit({
      replay: true,
      sharedReplay: true,
      databaseID: 77,
      datetimeFinished: '2026-08-31T00:10:00Z',
      sharedReplayLeader: 'Ada',
      sharedReplaySegment: 0,
    }));
    expect(coordinator.receiveInit(1, 1, init)).toBe(true);
    expect(coordinator.receiveHistory(1, 1, initialHistory())).toBe(true);

    expect(frames).toEqual([
      'getGameInfo1 {"tableID":123}',
      'getGameInfo2 {"tableID":123}',
    ]);
    expect(store.getState().room.room).toMatchObject({
      kind: 'live_game',
      role: 'spectator',
      sharedReplay: true,
      clientState: {
        finished: true,
        replay: {
          active: true,
          shared: { leader: 'Ada', amLeader: true, useSharedSegments: true },
        },
      },
    });
  });

  test.each(['player', 'spectator'] as const)(
    '%s enters through the shared boundary and info commands are ordered exactly once',
    (role) => {
      const store = readyStore(role);
      const frames: string[] = [];
      const coordinator = new GameBootstrapCoordinator(store, (frame) => {
        frames.push(frame);
        return true;
      });

      const loadEpoch = coordinator.startFromAuthoritativeRoom(1);
      expect(loadEpoch).toBe(1);
      expect(frames).toEqual(['getGameInfo1 {"tableID":123}']);
      expect(coordinator.startFromAuthoritativeRoom(1)).toBeNull();

      const init = gameInitSchema.parse(makeInit({ spectating: role === 'spectator' }));
      expect(coordinator.receiveInit(1, 1, init)).toBe(true);
      expect(coordinator.receiveInit(1, 1, init)).toBe(false);
      expect(frames).toEqual([
        'getGameInfo1 {"tableID":123}',
        'getGameInfo2 {"tableID":123}',
      ]);
      expect(store.getState().room.room.kind).toBe('awaiting_game_bootstrap');
    },
  );

  test('player sends loaded only after full history reduces and only then reaches LIVE', () => {
    const store = readyStore('player');
    const frames: string[] = [];
    const coordinator = new GameBootstrapCoordinator(store, (frame) => {
      if (frame.startsWith('loaded ')) {
        expect(store.getState().room.room.kind).toBe('awaiting_game_bootstrap');
      }
      frames.push(frame);
      return true;
    });
    coordinator.startFromAuthoritativeRoom(1);

    const wrong = gameInitSchema.parse(makeInit({ tableID: 999 }));
    expect(coordinator.receiveInit(1, 1, wrong)).toBe(false);
    expect(frames).toEqual(['getGameInfo1 {"tableID":123}']);

    const init = gameInitSchema.parse(makeInit());
    expect(coordinator.receiveInit(1, 1, init)).toBe(true);
    expect(store.getState().room.room.kind).toBe('awaiting_game_bootstrap');
    expect(frames).toEqual([
      'getGameInfo1 {"tableID":123}',
      'getGameInfo2 {"tableID":123}',
    ]);
    expect(coordinator.receiveHistory(1, 1, { ...initialHistory(), tableID: 999 })).toBe(false);
    expect(store.getState().room.room.kind).toBe('awaiting_game_bootstrap');
    expect(frames).toHaveLength(2);
    expect(coordinator.receiveHistory(1, 1, initialHistory())).toBe(true);
    expect(frames).toEqual([
      'getGameInfo1 {"tableID":123}',
      'getGameInfo2 {"tableID":123}',
      'loaded {"tableID":123}',
    ]);

    const room = store.getState().room.room;
    expect(room.kind).toBe('live_game');
    if (room.kind === 'live_game') {
      expect(room.bootstrapPhase).toBe('live');
      expect(room.historyActionCount).toBe(12);
      expect(room.clientState.replay.actions).toHaveLength(initialHistory().list.length);
      expect(room.clientState.ongoingGame.hands[0]).toEqual([0, 1, 2, 3, 4]);
      expect(room.clientState.visibleState).toBe(room.clientState.ongoingGame);
      expect(room.clientState.ongoingGame.deck.slice(0, 5).every((card) => (
        card?.suitIndex === null && card.rank === null
      ))).toBe(true);
    }
  });

  test('player cannot reach LIVE when the post-history loaded handshake cannot be sent', () => {
    const store = readyStore('player');
    const frames: string[] = [];
    const coordinator = new GameBootstrapCoordinator(store, (frame) => {
      frames.push(frame);
      return !frame.startsWith('loaded ');
    });
    coordinator.startFromAuthoritativeRoom(1);
    coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit()));

    expect(coordinator.receiveHistory(1, 1, initialHistory())).toBe(false);
    expect(frames).toEqual([
      'getGameInfo1 {"tableID":123}',
      'getGameInfo2 {"tableID":123}',
      'loaded {"tableID":123}',
    ]);
    const room = store.getState().room.room;
    expect(room.kind).toBe('awaiting_game_bootstrap');
    if (room.kind === 'awaiting_game_bootstrap' && room.bootstrap !== 'pending_c5') {
      expect(room.bootstrap.phase).toBe('failed');
    }
  });

  test('spectator bootstrap remains unchanged and sends no loaded handshake', () => {
    const store = readyStore('spectator');
    const frames: string[] = [];
    const coordinator = new GameBootstrapCoordinator(store, (frame) => {
      frames.push(frame);
      return true;
    });
    coordinator.startFromAuthoritativeRoom(1);
    coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit({ spectating: true })));

    expect(coordinator.receiveHistory(1, 1, initialHistory())).toBe(true);
    expect(frames).toEqual([
      'getGameInfo1 {"tableID":123}',
      'getGameInfo2 {"tableID":123}',
    ]);
    expect(store.getState().room.room).toMatchObject({
      kind: 'live_game',
      role: 'spectator',
    });
    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected LIVE');
    expect(room.clientState.shadowing).toBe(false);
  });

  test('shadowed spectator bootstrap preserves the authoritative perspective', () => {
    const store = readyStore('spectator');
    const coordinator = new GameBootstrapCoordinator(store, () => true);
    expect(coordinator.startFromAuthoritativeRoom(1)).toBe(1);
    expect(coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit({
      spectating: true, shadowing: true, ourPlayerIndex: 1,
    })))).toBe(true);
    expect(coordinator.receiveHistory(1, 1, initialHistory())).toBe(true);
    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected LIVE');
    expect(room.clientState.shadowing).toBe(true);
    expect(room.clientState.metadata.ourPlayerIndex).toBe(1);
  });

  test('shadowing init cannot bootstrap a player or an unshadowed spectator', () => {
    for (const role of ['player', 'spectator'] as const) {
      const store = readyStore(role);
      const coordinator = new GameBootstrapCoordinator(store, () => true);
      expect(coordinator.startFromAuthoritativeRoom(1)).toBe(1);
      expect(coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit({
        spectating: false, shadowing: true, ourPlayerIndex: 1,
      })))).toBe(false);
      expect(store.getState().room.room.kind).toBe('awaiting_game_bootstrap');
    }
  });

  test('full-history replay is deterministic and preserves hidden source actions', () => {
    const store = readyStore('player');
    const frames: string[] = [];
    const coordinator = new GameBootstrapCoordinator(store, (frame) => {
      frames.push(frame);
      return true;
    });
    coordinator.startFromAuthoritativeRoom(1);
    coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit()));
    const history = initialHistory();
    expect(history.list[0]).toEqual({
      type: 'draw', playerIndex: 0, order: 0, suitIndex: -1, rank: -1,
    });

    const roomBefore = store.getState().room.room;
    if (roomBefore.kind !== 'awaiting_game_bootstrap' || roomBefore.bootstrap === 'pending_c5') {
      throw new Error('Expected waiting history');
    }
    expect(coordinator.receiveHistory(1, 1, history)).toBe(true);
    const live = store.getState().room.room;
    if (live.kind !== 'live_game') throw new Error('Expected LIVE');
    const again = replayAuthoritativeHistory(
      live.clientState.metadata,
      'player',
      history.list,
    );
    expect(again).toEqual(live.clientState.ongoingGame);
  });

  test('premature incremental actions are ignored without buffering or extra commands', () => {
    const store = readyStore('player');
    const frames: string[] = [];
    const coordinator = new GameBootstrapCoordinator(store, (frame) => {
      frames.push(frame);
      return true;
    });
    coordinator.startFromAuthoritativeRoom(1);
    const incremental = incrementalGameActionSchema.parse({
      tableID: 123,
      action: { type: 'draw', playerIndex: 0, order: 0, suitIndex: -1, rank: -1 },
    });
    expect(coordinator.receiveIncrementalDetailed(1, incremental)).toEqual({
      accepted: false,
      rejectionReason: 'active-bootstrap',
    });
    coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit()));
    expect(coordinator.receiveIncremental(1, incremental)).toBe(false);
    expect(frames).toEqual([
      'getGameInfo1 {"tableID":123}',
      'getGameInfo2 {"tableID":123}',
    ]);
  });

  test('spectator LIVE reduction matches replay except upstream note-derived stat timing', () => {
    const store = readyStore('spectator');
    const coordinator = new GameBootstrapCoordinator(store, () => true);
    coordinator.startFromAuthoritativeRoom(1);
    coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit({ spectating: true })));
    const history = initialHistory();
    coordinator.receiveHistory(1, 1, history);
    const event = incrementalGameActionSchema.parse({
      tableID: 123,
      action: { type: 'draw', playerIndex: 0, order: 10, suitIndex: -1, rank: -1 },
    });

    expect(coordinator.receiveIncremental(1, event)).toBe(true);
    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected LIVE');
    expect(room.liveActionCount).toBe(1);
    expect(room.clientState.replay.actions).toHaveLength(history.list.length + 1);
    const replayed = replayAuthoritativeHistory(
      room.clientState.metadata,
      'spectator',
      [...history.list, event.action],
    );
    expect(replayed.stats.cardsGottenByNotes).toBeNull();
    expect(room.clientState.ongoingGame.stats.cardsGottenByNotes).toBe(0);
    expect(room.clientState.ongoingGame).toEqual({
      ...replayed,
      stats: { ...replayed.stats, cardsGottenByNotes: 0 },
    });
  });

  test('authoritative live state and history advance while an old segment stays selected', () => {
    const store = readyStore('player');
    const coordinator = new GameBootstrapCoordinator(store, () => true);
    coordinator.startFromAuthoritativeRoom(1);
    coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit()));
    coordinator.receiveHistory(1, 1, initialHistory());
    store.dispatch(roomActions.reviewSegmentSelected({
      tableID: 123,
      gameLoadEpoch: 1,
      segment: 0,
    }));
    const clue = incrementalGameActionSchema.parse({
      tableID: 123,
      action: {
        type: 'clue', clue: { type: 1, value: 1 }, giver: 0, list: [5], target: 1, turn: 0,
      },
    });

    expect(coordinator.receiveIncremental(1, clue)).toBe(true);
    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected LIVE');
    expect(room.clientState.replay).toMatchObject({ active: true, segment: 0 });
    expect(room.clientState.ongoingGame.turn.segment).toBe(1);
    expect(room.clientState.visibleState?.turn.segment).toBe(0);
    expect(room.clientState.replay.actions.at(-1)).toEqual({
      ...clue.action,
      ignoreNegative: false,
    });
  });

  test('postgame wire rehydrates history, reveals own hand, and records result metadata', () => {
    const store = readyStore('player');
    const coordinator = new GameBootstrapCoordinator(store, () => true);
    coordinator.startFromAuthoritativeRoom(1);
    coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit()));
    coordinator.receiveHistory(1, 1, initialHistory());
    expect(coordinator.receiveIncremental(1, incrementalGameActionSchema.parse({
      tableID: 123,
      action: { type: 'gameOver', endCondition: 1, playerIndex: 0, votes: null },
    }))).toBe(true);
    expect(coordinator.receiveIncremental(1, incrementalGameActionSchema.parse({
      tableID: 123,
      action: { type: 'playerTimes', playerTimes: [60_000, 60_000], duration: 300_000 },
    }))).toBe(true);

    const historyItem = gameHistorySchema.parse([{
      id: 456,
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
    }])[0]!;
    expect(coordinator.receiveGameHistory(1, [historyItem])).toBe(true);
    expect(coordinator.receiveCardIdentities(1, cardIdentitiesSchema.parse({
      tableID: 123,
      cardIdentities: Array.from({ length: 10 }, (_, order) => ({
        suitIndex: order % 5,
        rank: (order % 5) + 1,
      })),
    }))).toBe(true);
    const beforeFinish = store.getState().room.room;
    if (beforeFinish.kind !== 'live_game') throw new Error('Expected LIVE');
    expect(beforeFinish.clientState.replay.actions[0]).toMatchObject({
      suitIndex: 0,
      rank: 1,
    });
    expect(beforeFinish.clientState.ongoingGame.deck[0]).toMatchObject({
      suitIndex: null,
      rank: null,
    });
    expect(coordinator.receiveFinishOngoingGame(1, {
      tableID: 123,
      databaseID: 456,
      sharedReplayLeader: 'Ada',
    })).toBe(true);

    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected LIVE');
    expect(room.clientState.replay.actions[0]).toMatchObject({ suitIndex: 0, rank: 1 });
    expect(room.clientState.ongoingGame.deck[0]).toMatchObject({ suitIndex: 0, rank: 1 });
    expect(room.clientState).toMatchObject({
      playing: false,
      finished: true,
      datetimeFinished: '2026-08-31T00:05:00Z',
      replay: {
        databaseID: 456,
        shared: { leader: 'Ada', amLeader: true },
      },
    });
    expect(room.gameHistory).toMatchObject({ id: 456 });
  });

  test('stale and wrong-table postgame events are rejected', () => {
    const store = readyStore('player');
    const coordinator = new GameBootstrapCoordinator(store, () => true);
    coordinator.startFromAuthoritativeRoom(1);
    coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit()));
    coordinator.receiveHistory(1, 1, initialHistory());
    coordinator.receiveIncremental(1, incrementalGameActionSchema.parse({
      tableID: 123,
      action: { type: 'gameOver', endCondition: 1, playerIndex: 0, votes: null },
    }));
    const before = store.getState().room.room;

    expect(coordinator.receiveCardIdentities(1, {
      tableID: 999,
      cardIdentities: [],
    })).toBe(false);
    expect(coordinator.receiveFinishOngoingGame(2, {
      tableID: 123,
      databaseID: 456,
      sharedReplayLeader: 'Ada',
    })).toBe(false);
    expect(coordinator.receiveFinishOngoingGame(1, {
      tableID: 999,
      databaseID: 456,
      sharedReplayLeader: 'Ada',
    })).toBe(false);
    const unrelatedHistory = gameHistorySchema.parse([{
      id: 999,
      options: makeInit().options,
      seed: 'different-seed',
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
    expect(coordinator.receiveGameHistory(1, unrelatedHistory)).toBe(false);
    expect(store.getState().room.room).toBe(before);
  });

  test('wrong-table, stale, and failed live actions cannot corrupt state; player actions reduce', () => {
    const makeLive = (role: 'player' | 'spectator') => {
      const store = readyStore(role);
      const coordinator = new GameBootstrapCoordinator(store, () => true);
      coordinator.startFromAuthoritativeRoom(1);
      coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit({
        spectating: role === 'spectator',
      })));
      coordinator.receiveHistory(1, 1, initialHistory());
      return { store, coordinator };
    };
    const event = incrementalGameActionSchema.parse({
      tableID: 123,
      action: { type: 'turn', num: 1, currentPlayerIndex: 1 },
    });

    const spectator = makeLive('spectator');
    const before = spectator.store.getState().room.room;
    expect(spectator.coordinator.receiveIncrementalDetailed(
      1,
      { ...event, tableID: 999 },
    )).toEqual({ accepted: false, rejectionReason: 'wrong-room-table' });
    expect(spectator.coordinator.receiveIncrementalDetailed(2, event)).toEqual({
      accepted: false,
      rejectionReason: 'stale-connection-session',
    });
    const metadataMismatch = incrementalGameActionSchema.parse({
      tableID: 123,
      action: { type: 'turn', num: 1, currentPlayerIndex: 2 },
    });
    expect(spectator.coordinator.receiveIncremental(1, metadataMismatch)).toBe(false);
    const reducerFailure = incrementalGameActionSchema.parse({
      tableID: 123,
      action: { type: 'play', playerIndex: 0, order: 0, suitIndex: -1, rank: 1 },
    });
    expect(spectator.coordinator.receiveIncrementalDetailed(1, reducerFailure)).toEqual({
      accepted: false,
      rejectionReason: 'reducer-failure',
    });
    expect(spectator.store.getState().room.room).toBe(before);

    const player = makeLive('player');
    const playerBefore = player.store.getState().room.room;
    expect(player.coordinator.receiveIncremental(1, event)).toBe(true);
    const playerAfter = player.store.getState().room.room;
    expect(playerAfter).not.toBe(playerBefore);
    expect(playerAfter).toMatchObject({
      kind: 'live_game', role: 'player', liveActionCount: 1,
    });
  });

  test('stale connection/load epochs cannot advance and a second load invalidates the first', () => {
    const store = readyStore('player');
    const frames: string[] = [];
    const coordinator = new GameBootstrapCoordinator(store, (frame) => {
      frames.push(frame);
      return true;
    });
    expect(coordinator.startFromAuthoritativeRoom(1)).toBe(1);
    store.dispatch(roomActions.tableStartReceived({
      epoch: 1,
      tableStart: { tableID: 123, replay: false },
    }));
    expect(coordinator.startFromAuthoritativeRoom(1)).toBe(2);

    const init = gameInitSchema.parse(makeInit());
    expect(coordinator.receiveInit(1, 1, init)).toBe(false);
    expect(coordinator.receiveInit(2, 2, init)).toBe(false);
    expect(coordinator.receiveInit(1, 2, init)).toBe(true);
    expect(coordinator.receiveHistory(1, 1, initialHistory())).toBe(false);
    expect(coordinator.receiveHistory(1, 2, initialHistory())).toBe(true);
    expect(frames).toEqual([
      'getGameInfo1 {"tableID":123}',
      'getGameInfo1 {"tableID":123}',
      'getGameInfo2 {"tableID":123}',
      'loaded {"tableID":123}',
    ]);
  });

  test('a loading watchdog fails only the current load without sending retries', () => {
    const store = readyStore('player');
    const frames: string[] = [];
    const coordinator = new GameBootstrapCoordinator(store, (frame) => {
      frames.push(frame);
      return true;
    });
    coordinator.startFromAuthoritativeRoom(1);
    jest.advanceTimersByTime(15_000);

    const room = store.getState().room.room;
    expect(room.kind).toBe('awaiting_game_bootstrap');
    if (room.kind === 'awaiting_game_bootstrap' && room.bootstrap !== 'pending_c5') {
      expect(room.bootstrap.phase).toBe('failed');
    }
    expect(frames).toEqual(['getGameInfo1 {"tableID":123}']);
  });
});
