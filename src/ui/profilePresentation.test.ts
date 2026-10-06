import { expect, test } from '@jest/globals';
import type { LobbyTable, LobbyUser } from '../protocol/lobbyProtocol';
import { getProfilePresentation } from './profilePresentation';
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


test('Profile contains only known identity, presence, friend and table data', () => {
  const users = [user(2, 'Bob', { inactive: true, tableID: 10 })];
  const tables = [table(10)];
  expect(getProfilePresentation('bob', users, ['BOB'], null, tables)).toEqual({
    username: 'Bob', presence: 'Online (inactive)', location: 'Table 10',
    isFriend: true, isOwnUser: false, tableAction: { label: 'Spectate', tableID: 10 },
  });
  expect(getProfilePresentation('bob', users, [], null, tables).tableAction)
    .toEqual(getPeopleRows(users, [], null, tables)[0]?.tableAction);
});

test('a departed user keeps known identity and Friend state without invented presence or table', () => {
  expect(getProfilePresentation('Bob', [], ['bob'], null, [])).toEqual({
    username: 'Bob', presence: 'Presence unknown', location: null,
    isFriend: true, isOwnUser: false, tableAction: null,
  });
});

test('My Profile uses authenticated identity even when absent from the directory', () => {
  expect(getProfilePresentation('Ada', [], [], { userID: 1, username: 'Ada' }, []))
    .toMatchObject({ username: 'Ada', isOwnUser: true, presence: 'Presence unknown', tableAction: null });
});

test('Profile updates from current authoritative users, tables and friends', () => {
  const users = [user(2, 'Bob', { tableID: 10 })];
  expect(getProfilePresentation('Bob', users, [], null, [table(10, { sharedReplay: true })]).tableAction).toBeNull();
  expect(getProfilePresentation('Bob', users, [], null, []).location).toBe('At table');
  expect(getProfilePresentation('Bob', [user(2, 'Bob')], [], null, [])).toMatchObject({ location: 'Online', isFriend: false });
});
