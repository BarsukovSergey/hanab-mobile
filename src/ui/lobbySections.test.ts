import { describe, expect, test } from '@jest/globals';

import type { LobbyTable } from '../protocol/lobbyProtocol';
import { getLobbySections } from './lobbySections';

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
    sharedReplay: false,
    ...overrides,
  };
}

describe('lobby presentation sections', () => {
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
