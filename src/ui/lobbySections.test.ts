import { describe, expect, test } from '@jest/globals';

import type { LobbyTable } from '../protocol/lobbyProtocol';
import { getLobbySections } from './lobbySections';
import { getLobbyFriendContext } from './lobbyTablePresentation';

const tableOptions = {
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

function table(overrides: Partial<LobbyTable> = {}): LobbyTable {
  return {
    id: 1,
    name: 'Table',
    numPlayers: 2,
    maxPlayers: 5,
    running: false,
    variant: 'No Variant',
    options: tableOptions,
    passwordProtected: false,
    joined: false,
    progress: 0,
    players: ['Ada', 'Bob'],
    spectators: [],
    sharedReplay: false,
    ...overrides,
  };
}

describe('lobby presentation sections', () => {
  test('uses authoritative friend names and preserves table spelling and order', () => {
    const normal = table({
      players: ['Ada', 'BOB', 'Cy'],
      spectators: [
        { name: 'Dee', shadowingPlayerIndex: -1, shadowingPlayerUsername: '' },
        { name: 'BOB', shadowingPlayerIndex: 1, shadowingPlayerUsername: 'BOB' },
      ],
    });
    expect(getLobbyFriendContext(normal, ['bob', 'dee'])).toEqual({
      playing: ['BOB'], watching: ['Dee', 'BOB'], hasFriends: true,
    });
    expect(getLobbyFriendContext(normal, ['Eve']).hasFriends).toBe(false);
    expect(getLobbyFriendContext(table({ players: ['Bob'] }), ['bob']).hasFriends).toBe(true);
    expect(getLobbyFriendContext(table({ players: ['Ada'], spectators: normal.spectators }), ['dee']).hasFriends).toBe(true);
    expect(normal.players).toEqual(['Ada', 'BOB', 'Cy']);
  });

  test('ignores replay player names but counts active spectator friends', () => {
    const replay = table({ running: true, sharedReplay: true, players: ['Bob'] });
    expect(getLobbyFriendContext(replay, ['bob'])).toEqual({
      playing: [], watching: [], hasFriends: false,
    });
    expect(getLobbyFriendContext({
      ...replay,
      spectators: [{ name: 'BOB', shadowingPlayerIndex: -1, shadowingPlayerUsername: '' }],
    }, ['bob'])).toEqual({ playing: [], watching: ['BOB'], hasFriends: true });
  });

  test('prioritizes friends stably within discovery sections and leaves own games in place', () => {
    const watcher = [{ name: 'Bob', shadowingPlayerIndex: -1, shadowingPlayerUsername: '' }];
    const tables = [
      table({ id: 1, players: ['Cy'] }),
      table({ id: 2, players: ['Bob'] }),
      table({ id: 3, players: ['Dee'] }),
      table({ id: 4, players: ['BOB'] }),
      table({ id: 5, running: true, players: ['Cy'] }),
      table({ id: 6, running: true, spectators: watcher }),
      table({ id: 7, running: true, players: ['Dee'] }),
      table({ id: 8, running: true, players: ['Bob'] }),
      table({ id: 9, running: true, sharedReplay: true, players: ['Bob'] }),
      table({ id: 10, running: true, sharedReplay: true, players: ['Cy'], spectators: watcher }),
      table({ id: 11, running: true, sharedReplay: true, players: ['Bob'], spectators: watcher }),
      table({ id: 12, running: true, joined: true, players: ['Cy'] }),
    ];
    const ids = (items: LobbyTable[]) => items.map(({ id }) => id);
    const sections = getLobbySections(tables, ['bob']);
    expect(ids(sections.pregameTables)).toEqual([2, 4, 1, 3]);
    expect(ids(sections.runningTables)).toEqual([6, 8, 5, 7]);
    expect(ids(sections.sharedReplays)).toEqual([10, 11, 9]);
    expect(ids(sections.yourRunningGames)).toEqual([12]);
    expect(sections.showCreateTable).toBe(false);
    expect(ids(getLobbySections(tables, []).pregameTables)).toEqual([1, 2, 3, 4]);
  });
  test('keeps own running game in a dedicated top-level group', () => {
    const ownGame = table({ id: 1, running: true, joined: true });
    const otherGame = table({ id: 2, running: true });
    const sections = getLobbySections([otherGame, ownGame]);

    expect(sections.yourRunningGames.map(({ id }) => id)).toEqual([1]);
    expect(sections.runningTables.map(({ id }) => id)).toEqual([2]);
    expect(sections.showCreateTable).toBe(false);
  });

  test('separates pregame, running tables, and shared replays without overlap', () => {
    const pregame = table({ id: 1 });
    const running = table({ id: 2, running: true });
    const replay = table({ id: 3, running: true, sharedReplay: true });
    const sections = getLobbySections([pregame, running, replay]);

    expect(sections.pregameTables.map(({ id }) => id)).toEqual([1]);
    expect(sections.runningTables.map(({ id }) => id)).toEqual([2]);
    expect(sections.sharedReplays.map(({ id }) => id)).toEqual([3]);
    expect(sections.yourRunningGames).toEqual([]);
    expect(sections.showCreateTable).toBe(true);
  });

  test('shared replay never hides Create table by itself', () => {
    const replay = table({ id: 7, running: true, joined: true, sharedReplay: true });
    const sections = getLobbySections([replay]);

    expect(sections.sharedReplays.map(({ id }) => id)).toEqual([7]);
    expect(sections.yourRunningGames).toEqual([]);
    expect(sections.showCreateTable).toBe(true);
  });

  test('unsupported tables do not become actionable through presentation grouping', () => {
    const unsupported = table({
      id: 9,
      running: true,
      options: { ...tableOptions, speedrun: true },
    });
    const sections = getLobbySections([unsupported]);

    expect(sections.runningTables).toEqual([]);
    expect(sections.sharedReplays).toEqual([]);
    expect(sections.pregameTables).toEqual([]);
  });
});
