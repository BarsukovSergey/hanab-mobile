import { describe, expect, test } from '@jest/globals';

import type { LobbyTable, LobbyUser, Welcome } from '../protocol/lobbyProtocol';
import { lobbyActions } from './lobbySlice';
import { sessionActions } from './sessionSlice';
import {
  createAppStore,
  selectLobbyHydrated,
  tableSelectors,
  userSelectors,
} from './store';

const user = (userID: number, name = `user-${userID}`): LobbyUser => ({
  userID,
  name,
  status: 0,
  hyphenated: false,
  inactive: false,
});

const table = (id: number, name = `table-${id}`): LobbyTable => ({
  id,
  name,
  numPlayers: 1,
  maxPlayers: 5,
  running: false,
  variant: 'No Variant',
  options: {
    variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
    speedrun: false, cardCycle: false, deckPlays: false, emptyClues: false,
    oneExtraCard: false, oneLessCard: false, allOrNothing: false,
    detrimentalCharacters: false,
  },
  passwordProtected: false,
  joined: false,
  progress: 0,
  players: ['Ada'],
  sharedReplay: false,
});

const welcome: Welcome = {
  userID: 1,
  username: 'Ada',
  totalGames: 0,
  playingAtTables: [],
};

describe('lobby Redux state', () => {
  test('a new epoch clears entities and snapshot flags', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(lobbyActions.userReceived({ epoch: 1, user: user(1) }));
    store.dispatch(lobbyActions.tableReceived({ epoch: 1, table: table(1) }));
    store.dispatch(lobbyActions.userListReceived({ epoch: 1, users: [] }));
    store.dispatch(lobbyActions.tableListReceived({ epoch: 1, tables: [] }));

    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));

    expect(userSelectors.selectTotal(store.getState())).toBe(0);
    expect(tableSelectors.selectTotal(store.getState())).toBe(0);
    expect(store.getState().lobby.userListReceived).toBe(false);
    expect(store.getState().lobby.tableListReceived).toBe(false);
  });

  test('list events upsert and do not replace incremental entities', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(lobbyActions.userReceived({ epoch: 1, user: user(2) }));
    store.dispatch(lobbyActions.tableReceived({ epoch: 1, table: table(2) }));
    store.dispatch(lobbyActions.userListReceived({ epoch: 1, users: [user(1)] }));
    store.dispatch(lobbyActions.tableListReceived({ epoch: 1, tables: [table(1)] }));

    expect(userSelectors.selectIds(store.getState())).toEqual([2, 1]);
    expect(tableSelectors.selectIds(store.getState())).toEqual([2, 1]);
  });

  test('incremental upsert and delete work', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(lobbyActions.userReceived({ epoch: 1, user: user(1) }));
    store.dispatch(lobbyActions.userReceived({ epoch: 1, user: user(1, 'updated') }));
    store.dispatch(lobbyActions.tableReceived({ epoch: 1, table: table(1) }));
    expect(userSelectors.selectById(store.getState(), 1)?.name).toBe('updated');
    store.dispatch(lobbyActions.userLeft({ epoch: 1, userID: 1 }));
    store.dispatch(lobbyActions.tableGone({ epoch: 1, tableID: 1 }));
    expect(userSelectors.selectTotal(store.getState())).toBe(0);
    expect(tableSelectors.selectTotal(store.getState())).toBe(0);
  });

  test('hydration requires welcome and both snapshots', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({ epoch: 1, welcome }));
    expect(selectLobbyHydrated(store.getState())).toBe(false);
    store.dispatch(lobbyActions.userListReceived({ epoch: 1, users: [] }));
    expect(selectLobbyHydrated(store.getState())).toBe(false);
    store.dispatch(lobbyActions.tableListReceived({ epoch: 1, tables: [] }));
    expect(selectLobbyHydrated(store.getState())).toBe(true);
  });
});
