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
