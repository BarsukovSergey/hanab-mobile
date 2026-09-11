import { describe, expect, test } from '@jest/globals';
import { isC17WorkspaceEligible } from './c17Workspace';

const livePlayerPortrait = {
  isLiveParticipant: true,
  portrait: true,
  finished: false,
  replayActive: false,
};

describe('C17 workspace route', () => {
  test.each([2, 3, 4, 5, 6])('uses C17 for a live %ip player game', (playerCount) => {
    expect(isC17WorkspaceEligible({ ...livePlayerPortrait, playerCount })).toBe(true);
  });

  test('keeps the C17 ledger while locally reviewing a live game', () => {
    expect(isC17WorkspaceEligible({
      ...livePlayerPortrait,
      playerCount: 6,
      replayActive: true,
    })).toBe(true);
  });

  test.each([2, 3, 4, 5, 6])('uses C17 for a live %ip spectator game', (playerCount) => {
    expect(isC17WorkspaceEligible({ ...livePlayerPortrait, playerCount })).toBe(true);
  });

  test.each([
    { ...livePlayerPortrait, playerCount: 6, portrait: false },
    { ...livePlayerPortrait, playerCount: 6, finished: true },
    { ...livePlayerPortrait, playerCount: 6, isLiveParticipant: false },
    { ...livePlayerPortrait, playerCount: 1 },
    { ...livePlayerPortrait, playerCount: 7 },
  ])('leaves ineligible presentations on their existing path', (input) => {
    expect(isC17WorkspaceEligible(input)).toBe(false);
  });
});
