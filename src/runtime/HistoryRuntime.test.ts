import { describe, expect, jest, test } from '@jest/globals';

import { makeInit } from '../protocol/gameProtocol.fixtures';
import { gameHistoryItemSchema, type GameHistory } from '../protocol/gameProtocol';
import { historyActions } from '../store/historySlice';
import { sessionActions } from '../store/sessionSlice';
import { createAppStore } from '../store/store';
import { HistoryRuntime } from './HistoryRuntime';

function historicalGame(id: number) {
  return gameHistoryItemSchema.parse({
    id,
    options: makeInit().options,
    seed: `seed-${id}`, score: 20, numTurns: 30, endCondition: 1,
    datetimeStarted: '2026-09-01T00:00:00Z',
    datetimeFinished: '2026-09-01T00:10:00Z', numGamesOnThisSeed: 3,
    playerNames: ['Ada', 'Bob'], incrementNumGames: true, tags: '',
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

function makeRuntime() {
  const store = createAppStore();
  const send = jest.fn<(frame: string) => boolean>().mockReturnValue(true);
  const http = {
    fetchTaggedGames: jest.fn<(username: string) => Promise<GameHistory>>().mockResolvedValue([]),
    searchTag: jest.fn<(tag: string) => Promise<GameHistory>>().mockResolvedValue([]),
  };
  const runtime = new HistoryRuntime(store, http, send);
  store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
  store.dispatch(sessionActions.welcomeReceived({
    epoch: 1, welcome: { userID: 1, username: 'Ada', totalGames: 30, playingAtTables: [] },
  }));
  return { store, send, http, runtime };
}

function seedPages(runtime: HistoryRuntime) {
  const items = Array.from({ length: 10 }, (_, i) => historicalGame(20 - i));
  runtime.receiveEvent(1, { command: 'gameHistory', data: items });
  runtime.receiveEvent(1, { command: 'gameHistoryFriends', data: items });
}

describe('HistoryRuntime', () => {
  test('pagination waits for initial pages, sends exact offsets once and keeps pending owners separate', () => {
    const { runtime, store, send } = makeRuntime();
    expect(runtime.loadMoreHistory()).toBe(false);
    expect(runtime.loadMoreFriendsHistory()).toBe(false);
    expect(runtime.ensureFriendsHistory()).toBe(false);
    store.dispatch(sessionActions.friendsReceived({ epoch: 1, friends: ['Bob'] }));
    expect(runtime.ensureFriendsHistory()).toBe(true);
    expect(runtime.ensureFriendsHistory()).toBe(false);
    seedPages(runtime);
    expect(runtime.ensureFriendsHistory()).toBe(false);
    expect(runtime.loadMoreHistory()).toBe(true);
    expect(runtime.loadMoreFriendsHistory()).toBe(true);
    expect(runtime.loadMoreHistory()).toBe(false);
    expect(runtime.loadMoreFriendsHistory()).toBe(false);
    expect(send.mock.calls.map(([frame]) => frame)).toEqual([
      'historyFriendsGet {"offset":0,"amount":10}',
      'historyGet {"offset":10,"amount":10}',
      'historyFriendsGet {"offset":10,"amount":10}',
    ]);
    runtime.receiveEvent(1, { command: 'gameHistoryFriends', data: [historicalGame(10)] });
    expect(store.getState().history.pendingRequest).toMatchObject({ offset: 10, connectionEpoch: 1 });
    expect(store.getState().history.friendPendingRequest).toBeNull();
    expect(runtime.loadMoreFriendsHistory()).toBe(false);
    runtime.receiveEvent(1, { command: 'gameHistory', data: [historicalGame(10)] });
    expect(store.getState().history.pendingRequest).toBeNull();
    expect(runtime.loadMoreHistory()).toBe(false);
  });

  test.each(['not ready', 'history epoch mismatch'] as const)('%s blocks all request paths', (gate) => {
    const { runtime, store, send, http } = makeRuntime();
    seedPages(runtime);
    store.dispatch(sessionActions.friendsReceived({ epoch: 1, friends: ['Bob'] }));
    const state = store.getState();
    jest.spyOn(store, 'getState').mockReturnValue({
      ...state,
      session: { ...state.session, phase: gate === 'not ready' ? 'openAwaitingWelcome' : 'ready' },
      history: { ...state.history, connectionEpoch: gate === 'history epoch mismatch' ? 0 : 1 },
    });
    expect(runtime.loadMoreHistory()).toBe(false);
    expect(runtime.ensureFriendsHistory()).toBe(false);
    expect(runtime.loadMoreFriendsHistory()).toBe(false);
    expect(runtime.ensureTaggedGames()).toBe(false);
    expect(runtime.searchTag('tag')).toBe(false);
    expect(runtime.loadOtherScores(20, false)).toBe(false);
    expect(runtime.watchHistoricalGame(20)).toBe(false);
    expect(runtime.watchReplayByID(20, 'solo')).toBe(false);
    expect(runtime.watchJSONReplay({}, 'shared')).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(http.fetchTaggedGames).not.toHaveBeenCalled();
    expect(http.searchTag).not.toHaveBeenCalled();
  });

  test('failed sends create no history, comparison or replay pending intent', () => {
    const { runtime, store, send } = makeRuntime();
    store.dispatch(sessionActions.friendsReceived({ epoch: 1, friends: ['Bob'] }));
    send.mockReturnValue(false);
    expect(runtime.ensureFriendsHistory()).toBe(false);
    seedPages(runtime);
    expect(runtime.loadMoreHistory()).toBe(false);
    expect(runtime.loadMoreFriendsHistory()).toBe(false);
    expect(runtime.loadOtherScores(20, false)).toBe(false);
    expect(runtime.watchHistoricalGame(20)).toBe(false);
    expect(runtime.watchReplayByID(123, 'shared')).toBe(false);
    expect(runtime.watchJSONReplay({ actions: [] }, 'solo')).toBe(false);
    expect(store.getState().history).toMatchObject({
      pendingRequest: null, friendPendingRequest: null, pendingOtherScores: null, pendingReplayCreate: null,
    });
  });

  test('a connection replaced during send cannot acquire pending ownership for the old epoch', () => {
    const { runtime, store, send } = makeRuntime();
    seedPages(runtime);
    send.mockImplementation(() => {
      store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
      return true;
    });
    expect(runtime.loadMoreHistory()).toBe(false);
    expect(store.getState().history).toMatchObject({ connectionEpoch: 2, pendingRequest: null });
    runtime.receiveEvent(1, { command: 'gameHistory', data: [historicalGame(99)] });
    runtime.receiveEvent(1, { command: 'gameHistoryFriends', data: [historicalGame(98)] });
    expect(store.getState().history.items).toEqual([]);
    expect(store.getState().history.friendItems).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test.each([
    'pendingRecovery', 'pendingSpectateTableID', 'pendingJoin', 'pendingCreate',
    'pendingLeaveTableID', 'pendingUnattendTableID', 'pendingStart', 'pendingUpdate',
    'pendingLeaderName', 'pendingRestartTableID', 'rematchTransition', 'pendingGameplayAction',
  ])('all replay entry points reject conflicting %s', (gate) => {
    const { runtime, store, send } = makeRuntime();
    seedPages(runtime);
    const state = store.getState();
    jest.spyOn(store, 'getState').mockReturnValue({ ...state, room: { ...state.room, [gate]: {} } });
    expect(runtime.watchHistoricalGame(20)).toBe(false);
    expect(runtime.watchReplayByID(123, 'solo')).toBe(false);
    expect(runtime.watchJSONReplay({}, 'shared')).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  test('replay eligibility respects room attendance, known supported history and existing intent', () => {
    const { runtime, store, send } = makeRuntime();
    seedPages(runtime);
    const state = store.getState();
    const getState = jest.spyOn(store, 'getState').mockReturnValue({
      ...state, room: { ...state.room, room: {
        kind: 'awaiting_game_bootstrap', tableID: 123, role: 'spectator', replay: false,
        expectedDatabaseID: null, expectedReplaySource: null, expectedReplayVisibility: null,
        tableStartReceived: true, bootstrap: 'pending_c5',
      } },
    });
    expect(runtime.watchHistoricalGame(20)).toBe(false);
    expect(runtime.watchReplayByID(123, 'solo')).toBe(false);
    expect(runtime.watchJSONReplay({}, 'shared')).toBe(false);
    getState.mockRestore();
    expect(runtime.watchHistoricalGame(999)).toBe(false);
    store.dispatch(historyActions.taggedRequested({ connectionEpoch: 1 }));
    store.dispatch(historyActions.taggedReceived({ connectionEpoch: 1, history: [{
      ...historicalGame(99), options: { ...historicalGame(99).options, variantName: 'Unsupported Variant' },
    }] }));
    expect(runtime.watchHistoricalGame(99)).toBe(false);
    expect(runtime.watchReplayByID(0, 'solo')).toBe(false);
    expect(runtime.watchReplayByID(1.5, 'solo')).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(runtime.watchReplayByID(999, 'shared')).toBe(true);
    expect(store.getState().history.pendingReplayCreate).toEqual({
      connectionEpoch: 1, source: 'id', databaseID: 999, visibility: 'shared',
    });
    expect(runtime.watchHistoricalGame(20)).toBe(false);
    expect(runtime.watchReplayByID(998, 'solo')).toBe(false);
    expect(runtime.watchJSONReplay({}, 'solo')).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('same-seed responses belong to their source and dismissal clears the comparison', () => {
    const { runtime, store, send } = makeRuntime();
    seedPages(runtime);
    expect(runtime.loadOtherScores(999, false)).toBe(false);
    expect(runtime.loadOtherScores(20, true)).toBe(true);
    expect(runtime.loadOtherScores(20, false)).toBe(false);
    expect(send).toHaveBeenCalledWith('historyGetSeed {"seed":"seed-20","friends":true}');
    const result = { games: [historicalGame(99)], seed: 'seed-20', variantName: 'No Variant', friends: true };
    runtime.receiveEvent(0, { command: 'gameHistoryOtherScores', data: result });
    expect(store.getState().history.pendingOtherScores).not.toBeNull();
    runtime.receiveEvent(1, { command: 'gameHistoryOtherScores', data: result });
    expect(store.getState().history.pendingOtherScores).toBeNull();
    expect(store.getState().history.otherScores).toEqual(result);
    expect(store.getState().history.items).toHaveLength(10);
    expect(runtime.watchHistoricalGame(99)).toBe(true);
    runtime.dismissOtherScores();
    expect(store.getState().history.otherScores).toBeNull();
  });

  test.each(['resolve', 'reject'] as const)('tagged and search %s results from a stale epoch cannot affect new requests', async (outcome) => {
    const { runtime, store, http } = makeRuntime();
    const tagged = deferred<GameHistory>();
    const search = deferred<GameHistory>();
    http.fetchTaggedGames.mockReturnValueOnce(tagged.promise);
    http.searchTag.mockReturnValueOnce(search.promise);
    expect(runtime.ensureTaggedGames()).toBe(true);
    expect(runtime.ensureTaggedGames()).toBe(false);
    expect(http.fetchTaggedGames).toHaveBeenCalledWith('Ada');
    expect(runtime.searchTag('  ')).toBe(false);
    expect(runtime.searchTag('exact,tag')).toBe(true);
    expect(runtime.searchTag('other')).toBe(false);
    expect(http.searchTag).toHaveBeenCalledWith('exact,tag');
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    store.dispatch(historyActions.taggedRequested({ connectionEpoch: 2 }));
    store.dispatch(historyActions.tagSearchRequested({ connectionEpoch: 2, tag: 'new' }));
    const before = store.getState().history;
    const dispatch = jest.spyOn(store, 'dispatch');
    if (outcome === 'resolve') {
      tagged.resolve([historicalGame(99)]);
      search.resolve([historicalGame(98)]);
    } else {
      tagged.reject(new Error('stale tagged'));
      search.reject(new Error('stale search'));
    }
    await settle();
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.getState().history).toEqual(before);
  });

  test.each(['resolve', 'reject'] as const)('cleared search %s cannot replace a newer same-tag request', async (outcome) => {
    const { runtime, store, http } = makeRuntime();
    const old = deferred<GameHistory>();
    const current = deferred<GameHistory>();
    http.searchTag.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    expect(runtime.searchTag('same')).toBe(true);
    runtime.clearTagSearch();
    expect(runtime.searchTag('same')).toBe(true);
    const before = store.getState().history;
    if (outcome === 'resolve') old.resolve([historicalGame(99)]);
    else old.reject(new Error('old search'));
    await settle();
    expect(store.getState().history).toEqual(before);
    current.resolve([historicalGame(88)]);
    await settle();
    expect(store.getState().history.tagSearchItems?.map(({ id }) => id)).toEqual([88]);
  });

  test('current HTTP successes and errors stay isolated and retain bounded error messages', async () => {
    const { runtime, store, http } = makeRuntime();
    http.fetchTaggedGames.mockRejectedValueOnce(new Error('x'.repeat(300)));
    http.searchTag.mockRejectedValueOnce('transport failure');
    expect(runtime.ensureTaggedGames()).toBe(true);
    expect(runtime.searchTag('tag')).toBe(true);
    await settle();
    expect(store.getState().history).toMatchObject({
      taggedPending: false, taggedError: 'x'.repeat(240),
      tagSearchPending: false, tagSearchError: 'Unable to search this tag.', error: null,
    });
    http.fetchTaggedGames.mockResolvedValueOnce([historicalGame(77)]);
    expect(runtime.ensureTaggedGames()).toBe(true);
    await settle();
    expect(store.getState().history.taggedItems.map(({ id }) => id)).toEqual([77]);
    expect(runtime.ensureTaggedGames()).toBe(false);
    expect(runtime.watchHistoricalGame(77)).toBe(true);
  });

  test('warning/error cleanup clears only current socket request intent, preserving HTTP pending work', () => {
    const { runtime, store, http } = makeRuntime();
    seedPages(runtime);
    http.fetchTaggedGames.mockReturnValue(deferred<GameHistory>().promise);
    http.searchTag.mockReturnValue(deferred<GameHistory>().promise);
    expect(runtime.ensureTaggedGames()).toBe(true);
    expect(runtime.searchTag('tag')).toBe(true);
    runtime.clearCurrentPending(1, 'no socket request');
    expect(store.getState().history.error).toBeNull();
    expect(runtime.loadMoreHistory()).toBe(true);
    expect(runtime.loadMoreFriendsHistory()).toBe(true);
    expect(runtime.loadOtherScores(20, false)).toBe(true);
    expect(runtime.watchJSONReplay({ actions: [] }, 'shared')).toBe(true);
    const before = store.getState().history;
    runtime.clearCurrentPending(0, 'stale warning');
    expect(store.getState().history).toEqual(before);
    runtime.clearCurrentPending(1, 'w'.repeat(300));
    expect(store.getState().history).toMatchObject({
      pendingRequest: null, friendPendingRequest: null, pendingOtherScores: null,
      pendingReplayCreate: null, error: 'w'.repeat(240), taggedPending: true, tagSearchPending: true,
    });
  });
});
