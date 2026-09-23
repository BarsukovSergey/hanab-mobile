import { describe, expect, test } from '@jest/globals';

import { gameHistoryItemSchema } from '../protocol/gameProtocol';
import { historyActions } from './historySlice';
import { sessionActions } from './sessionSlice';
import { createAppStore } from './store';

const options = {
  numPlayers: 2, startingPlayer: 0, variantID: 0, variantName: 'No Variant',
  timed: false, timeBase: 0, timePerTurn: 0, speedrun: false, cardCycle: false,
  deckPlays: false, emptyClues: false, oneExtraCard: false, oneLessCard: false,
  allOrNothing: false, detrimentalCharacters: false,
};

function item(id: number) {
  return gameHistoryItemSchema.parse({
    id, options, seed: `seed-${id}`, score: id, numTurns: 10, endCondition: 1,
    datetimeStarted: '2026-09-01T00:00:00Z',
    datetimeFinished: '2026-09-01T00:10:00Z', numGamesOnThisSeed: 1,
    playerNames: ['Ada', 'Bob'], incrementNumGames: true, tags: '',
  });
}

function readyStore(totalGames = 30) {
  const store = createAppStore();
  store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
  store.dispatch(sessionActions.welcomeReceived({
    epoch: 1,
    welcome: { userID: 1, username: 'Ada', totalGames, playingAtTables: [] },
  }));
  return store;
}

describe('C15 history state', () => {
  test('same-seed results require matching pending context and preserve server order', () => {
    const store = readyStore();
    const source = { ...item(1), numGamesOnThisSeed: 3 };
    store.dispatch(historyActions.pageReceived({ connectionEpoch: 1, history: [source] }));
    store.dispatch(historyActions.friendPageReceived({ connectionEpoch: 1, history: [item(20)] }));
    const result = { games: [{ ...item(9), score: 20 }, { ...item(3), score: 20 }, item(7)], variantName: 'No Variant', friends: false, seed: source.seed };
    store.dispatch(historyActions.otherScoresReceived({ connectionEpoch: 1, result }));
    expect(store.getState().history.otherScores).toBeNull();
    const request = { connectionEpoch: 1, sourceDatabaseID: 1, seed: source.seed, friends: false };
    store.dispatch(historyActions.otherScoresRequested(request));
    store.dispatch(historyActions.otherScoresRequested(request));
    store.dispatch(historyActions.otherScoresReceived({ connectionEpoch: 1, result: { ...result, friends: true } }));
    store.dispatch(historyActions.otherScoresReceived({ connectionEpoch: 1, result: { ...result, seed: 'wrong' } }));
    store.dispatch(historyActions.otherScoresReceived({ connectionEpoch: 0, result }));
    expect(store.getState().history.otherScores).toBeNull();
    store.dispatch(historyActions.otherScoresReceived({ connectionEpoch: 1, result }));
    expect(store.getState().history.otherScores?.games.map(({ id }) => id)).toEqual([9, 3, 7]);
    expect(store.getState().history.items).toEqual([source]);
    expect(store.getState().history.friendItems).toEqual([item(20)]);
    store.dispatch(historyActions.otherScoresDismissed());
    expect(store.getState().history.otherScores).toBeNull();
    store.dispatch(historyActions.otherScoresRequested(request));
    store.dispatch(historyActions.operationFailed({ connectionEpoch: 1, message: 'failed' }));
    expect(store.getState().history.pendingOtherScores).toBeNull();
    expect(store.getState().history.items).toEqual([source]);
    store.dispatch(historyActions.otherScoresRequested(request));
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().history.pendingOtherScores).toBeNull();
  });
  test('friends pages stay independent, preserve order, and stop on a short page', () => {
    const store = readyStore(1);
    store.dispatch(historyActions.pageReceived({ connectionEpoch: 1, history: [item(1)] }));
    store.dispatch(historyActions.friendPageReceived({
      connectionEpoch: 1,
      history: [item(20), item(19), item(20), ...Array.from({ length: 8 }, (_, i) => item(18 - i))],
    }));
    expect(store.getState().history.friendItems.map(({ id }) => id))
      .toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11]);
    expect(store.getState().history).toMatchObject({
      items: [item(1)], totalGames: 1, hasMore: false,
      friendInitialPageReceived: true, friendHasMore: true,
    });
    store.dispatch(historyActions.friendPageReceived({ connectionEpoch: 1, history: [item(99)] }));
    expect(store.getState().history.friendItems.map(({ id }) => id)[0]).toBe(20);
    store.dispatch(historyActions.friendPageRequested({ connectionEpoch: 1, offset: 10, amount: 10 }));
    store.dispatch(historyActions.friendPageReceived({
      connectionEpoch: 1, history: [item(11), item(10)],
    }));
    expect(store.getState().history.friendItems.map(({ id }) => id))
      .toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10]);
    expect(store.getState().history.friendHasMore).toBe(false);
    expect(store.getState().history.totalGames).toBe(1);
    expect(store.getState().history.items.map(({ id }) => id)).toEqual([1]);
  });

  test('friend initial request races the automatic page safely and resets at a new epoch', () => {
    const store = readyStore();
    store.dispatch(historyActions.friendPageRequested({ connectionEpoch: 1, offset: 0, amount: 10 }));
    store.dispatch(historyActions.friendPageReceived({ connectionEpoch: 1, history: [item(5)] }));
    store.dispatch(historyActions.friendPageReceived({ connectionEpoch: 1, history: [item(6)] }));
    expect(store.getState().history.friendItems.map(({ id }) => id)).toEqual([5]);
    expect(store.getState().history.friendPendingRequest).toBeNull();
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    store.dispatch(historyActions.friendPageReceived({ connectionEpoch: 1, history: [item(7)] }));
    expect(store.getState().history).toMatchObject({
      friendItems: [], friendInitialPageReceived: false, friendPendingRequest: null,
      friendHasMore: false,
    });
  });
  test('automatic first page initializes in server order and dedupes by id', () => {
    const store = readyStore();
    const page = [item(30), item(29), item(30), ...Array.from({ length: 8 }, (_, i) => item(28 - i))];
    store.dispatch(historyActions.pageReceived({ connectionEpoch: 1, history: page }));
    expect(store.getState().history).toMatchObject({
      initialPageReceived: true, hasMore: true, pendingRequest: null,
    });
    expect(store.getState().history.items.map(({ id }) => id))
      .toEqual([30, 29, 28, 27, 26, 25, 24, 23, 22, 21]);
  });

  test('requested pages append without reordering and raw shortness is checked before dedupe', () => {
    const store = readyStore(40);
    store.dispatch(historyActions.pageReceived({
      connectionEpoch: 1,
      history: Array.from({ length: 10 }, (_, i) => item(40 - i)),
    }));
    store.dispatch(historyActions.pageRequested({
      connectionEpoch: 1, offset: 10, amount: 10,
    }));
    store.dispatch(historyActions.pageReceived({
      connectionEpoch: 1,
      history: [item(31), ...Array.from({ length: 9 }, (_, i) => item(30 - i))],
    }));
    expect(store.getState().history.items.map(({ id }) => id))
      .toEqual(Array.from({ length: 19 }, (_, i) => 40 - i));
    expect(store.getState().history.hasMore).toBe(true);

    store.dispatch(historyActions.pageRequested({
      connectionEpoch: 1, offset: 19, amount: 10,
    }));
    store.dispatch(historyActions.pageReceived({
      connectionEpoch: 1, history: [item(21), item(20)],
    }));
    expect(store.getState().history.hasMore).toBe(false);
  });

  test('totalGames ends pagination and duplicate pending requests are rejected', () => {
    const store = readyStore(10);
    store.dispatch(historyActions.pageReceived({
      connectionEpoch: 1,
      history: Array.from({ length: 10 }, (_, i) => item(10 - i)),
    }));
    expect(store.getState().history.hasMore).toBe(false);

    const another = readyStore(20);
    another.dispatch(historyActions.pageReceived({
      connectionEpoch: 1,
      history: Array.from({ length: 10 }, (_, i) => item(20 - i)),
    }));
    another.dispatch(historyActions.pageRequested({ connectionEpoch: 1, offset: 10, amount: 10 }));
    another.dispatch(historyActions.pageRequested({ connectionEpoch: 1, offset: 999, amount: 10 }));
    expect(another.getState().history.pendingRequest?.offset).toBe(10);
  });

  test('unsolicited history after the initial page does not mutate paging state', () => {
    const store = readyStore(20);
    const first = Array.from({ length: 10 }, (_, i) => item(20 - i));
    store.dispatch(historyActions.pageReceived({ connectionEpoch: 1, history: first }));
    store.dispatch(historyActions.pageReceived({ connectionEpoch: 1, history: [item(1)] }));
    expect(store.getState().history.items).toEqual(first);
    expect(store.getState().history.hasMore).toBe(true);
  });

  test('new epochs clear all operations and stale responses cannot affect current history', () => {
    const store = readyStore(20);
    store.dispatch(historyActions.pageReceived({
      connectionEpoch: 1,
      history: Array.from({ length: 10 }, (_, i) => item(20 - i)),
    }));
    store.dispatch(historyActions.pageRequested({ connectionEpoch: 1, offset: 10, amount: 10 }));
    store.dispatch(historyActions.replayCreateRequested({ connectionEpoch: 1, databaseID: 20 }));
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().history).toMatchObject({
      connectionEpoch: 2, totalGames: 0, items: [], initialPageReceived: false,
      pendingRequest: null, pendingReplayCreate: null, error: null, hasMore: false,
    });
    store.dispatch(historyActions.pageReceived({ connectionEpoch: 1, history: [item(1)] }));
    expect(store.getState().history.items).toEqual([]);
  });
});
