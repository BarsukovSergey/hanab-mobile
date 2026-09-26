import { describe, expect, test } from '@jest/globals';

import type { LobbyTable, LobbyUser } from '../protocol/lobbyProtocol';
import { getPeopleRows } from './peoplePresentation';

const user = (userID: number, name: string, changes: Partial<LobbyUser> = {}): LobbyUser => ({
  userID,
  name,
  status: 0,
  hyphenated: false,
  inactive: false,
  ...changes,
});

const table = (id: number, changes: Partial<LobbyTable> = {}): LobbyTable => ({
  id,
  name: `Table ${id}`,
  numPlayers: 1,
  maxPlayers: 5,
  running: true,
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
  players: ['Bob'],
  spectators: [],
  sharedReplay: false,
  ...changes,
});

describe('People presentation', () => {
  test('sorts own user first, then friends, then others alphabetically with user ID tie breaks', () => {
    const rows = getPeopleRows(
      [user(8, 'zoe'), user(7, 'bob'), user(3, 'Amy'), user(4, 'cy'), user(5, 'Ada'), user(6, 'ada')],
      ['CY', 'Bob'],
      { userID: 3, username: 'Amy' },
      [],
    );

    expect(rows.map((row) => [row.user.name, row.isFriend])).toEqual([
      ['Amy', false], ['bob', true], ['cy', true], ['Ada', false], ['ada', false], ['zoe', false],
    ]);
    expect(rows.slice(3).map(({ user: item }) => item.userID)).toEqual([5, 6, 8]);
  });

  test('presents authoritative flags and known or unknown table context', () => {
    const rows = getPeopleRows(
      [
        user(1, 'Ada'),
        user(2, 'Bob', { inactive: true, hyphenated: true, tableID: 10 }),
        user(3, 'Cy', { tableID: 99 }),
      ],
      ['Bob'],
      { userID: 1, username: 'Ada' },
      [table(10, { name: 'Useful table' })],
    );

    expect(rows.find((row) => row.user.name === 'Ada')).toMatchObject({
      isOwnUser: true,
      isFriend: false,
      canUseContextActions: false,
      location: 'Online',
      tableAction: null,
    });
    expect(rows.find((row) => row.user.name === 'Bob')).toMatchObject({
      isOwnUser: false,
      isFriend: true,
      canUseContextActions: true,
      location: 'Useful table',
      user: { inactive: true, hyphenated: true },
      tableAction: { label: 'Spectate', tableID: 10 },
    });
    expect(rows.find((row) => row.user.name === 'Cy')).toMatchObject({
      location: 'At table', tableAction: null,
    });
  });

  test('offers table actions only for eligible known normal tables', () => {
    const users = [
      user(2, 'Running', { tableID: 1 }),
      user(3, 'Pregame', { tableID: 2 }),
      user(4, 'Shared', { tableID: 3 }),
      user(5, 'Joined', { tableID: 4 }),
      user(6, 'Unsupported', { tableID: 5 }),
    ];
    const tables = [
      table(1),
      table(2, { running: false }),
      table(3, { sharedReplay: true }),
      table(4, { joined: true }),
      table(5, { options: { ...table(5).options, variantName: 'Unknown Variant' } }),
    ];

    const rows = getPeopleRows(users, [], { userID: 1, username: 'Ada' }, tables);
    expect(Object.fromEntries(rows.map((row) => [row.user.name, row.tableAction]))).toEqual({
      Joined: null,
      Pregame: { label: 'Spectate pregame', tableID: 2 },
      Running: { label: 'Spectate', tableID: 1 },
      Shared: null,
      Unsupported: null,
    });
  });
});
