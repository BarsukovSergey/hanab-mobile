import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LobbyTable } from '../protocol/lobbyProtocol';
import {
  isJoinEligible,
  isPregameSpectateEligible,
  isReattendEligible,
  isSpectateEligible,
} from './lobbyEligibility';

const tableOptions = {
  variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
  speedrun: false, cardCycle: false, deckPlays: false, emptyClues: false,
  oneExtraCard: false, oneLessCard: false, allOrNothing: false,
  detrimentalCharacters: false,
};
const runningTable: LobbyTable = {
  id: 123,
  name: 'Running table',
  numPlayers: 3,
  maxPlayers: 5,
  running: true,
  variant: 'No Variant',
  options: tableOptions,
  passwordProtected: false,
  joined: false,
  progress: 7,
  players: ['Ada', 'Bob', 'Cy'],
  spectators: [],
  sharedReplay: false,
};

const joinableTable: LobbyTable = {
  ...runningTable,
  name: 'Pregame table',
  numPlayers: 1,
  running: false,
  progress: 0,
  players: ['Bob'],
};

describe('lobby eligibility', () => {
  test('running shared replays remain spectate eligible even when joined', () => {
    expect(isSpectateEligible(runningTable)).toBe(true);
    expect(isSpectateEligible({ ...runningTable, running: false })).toBe(false);
    expect(isSpectateEligible({ ...runningTable, sharedReplay: true })).toBe(true);
    expect(isSpectateEligible({
      ...runningTable, sharedReplay: true, joined: true,
    })).toBe(true);
    expect(isSpectateEligible({ ...runningTable, joined: true })).toBe(false);
  });

  test('only supported open non-replay non-joined tables with a seat are join eligible', () => {
    expect(isJoinEligible(joinableTable)).toBe(true);
    expect(isJoinEligible({ ...joinableTable, running: true })).toBe(false);
    expect(isJoinEligible({ ...joinableTable, sharedReplay: true })).toBe(false);
    expect(isJoinEligible({ ...joinableTable, joined: true })).toBe(false);
    expect(isJoinEligible({ ...joinableTable, passwordProtected: true })).toBe(true);
    expect(isJoinEligible({ ...joinableTable, numPlayers: 5 })).toBe(false);
    expect(isJoinEligible({
      ...joinableTable,
      options: { ...tableOptions, timed: true, timeBase: 120, timePerTurn: 20 },
    })).toBe(true);
    for (const unsupported of ['speedrun', 'deckPlays', 'detrimentalCharacters'] as const) {
      expect(isJoinEligible({
        ...joinableTable,
        options: { ...tableOptions, [unsupported]: true },
      })).toBe(false);
    }
  });

  test('only own running non-replay tables are reattend eligible', () => {
    const ownRunningTable = { ...runningTable, joined: true };
    expect(isReattendEligible(ownRunningTable)).toBe(true);
    expect(isReattendEligible({ ...ownRunningTable, running: false })).toBe(false);
    expect(isReattendEligible({ ...ownRunningTable, joined: false })).toBe(false);
    expect(isReattendEligible({ ...ownRunningTable, sharedReplay: true })).toBe(false);
    expect(isReattendEligible({
      ...ownRunningTable,
      options: { ...tableOptions, timed: true, timeBase: 120, timePerTurn: 20 },
    })).toBe(true);
  });

  test('pregame spectate requires supported non-running non-replay non-joined tables', () => {
    expect(isPregameSpectateEligible(joinableTable)).toBe(true);
    expect(isPregameSpectateEligible({ ...joinableTable, running: true })).toBe(false);
    expect(isPregameSpectateEligible({ ...joinableTable, sharedReplay: true })).toBe(false);
    expect(isPregameSpectateEligible({ ...joinableTable, joined: true })).toBe(false);
  });

  test('all table predicates reject unsupported options', () => {
    const unsupportedOptions = { ...tableOptions, speedrun: true };
    expect(isSpectateEligible({ ...runningTable, options: unsupportedOptions })).toBe(false);
    expect(isPregameSpectateEligible({ ...joinableTable, options: unsupportedOptions })).toBe(false);
    expect(isJoinEligible({ ...joinableTable, options: unsupportedOptions })).toBe(false);
    expect(isReattendEligible({
      ...runningTable, joined: true, options: unsupportedOptions,
    })).toBe(false);
  });

  test.each([
    'src/ui/lobbySections.ts',
    'src/ui/peoplePresentation.ts',
    'src/ui/game/C17GameScreen.tsx',
  ])('%s imports pure policy without the runtime controller', (path) => {
    const source = readFileSync(resolve(__dirname, '../..', path), 'utf8');
    expect(source).toMatch(/from ['"].*\/lobbyEligibility['"]/);
    expect(source).not.toMatch(/from ['"].*\/LobbyRuntime['"]/);
  });

});
