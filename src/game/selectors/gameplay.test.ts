import { describe, expect, it } from '@jest/globals';

import {
  getClueColorFill,
  getDisplayedClueTokens,
  getDisplayedLiveFutureEfficiency,
  getGameTableSuits,
  getGameplayClueChoices,
  getGameplayClueChoicesForPlayerIndex,
  hasClueTokenForVariant,
  canDiscardForVariant,
  getDisplayedClockTime,
} from './gameplay';

describe('getGameTableSuits', () => {
  it('counts down only the active clock and ignores timeTaken', () => {
    const clock = {
      times: [12_000, 9_000], activePlayerIndex: 0, timeTaken: 8_000, receivedAtMs: 1_000,
    };
    expect(getDisplayedClockTime(clock, 0, false, 4_500)).toBe(8_500);
    expect(getDisplayedClockTime(clock, 1, false, 4_500)).toBe(9_000);
    expect(getDisplayedClockTime(clock, 0, true, 99_000)).toBe(12_000);
    expect(getDisplayedClockTime(clock, 0, false, 0)).toBe(12_000);
  });
  it('uses upstream clue names for variant and character semantics', () => {
    expect(getGameplayClueChoices('Odds and Evens (5 Suits)').ranks).toEqual([
      { value: 1, label: 'Odd' }, { value: 2, label: 'Even' },
    ]);
    expect(getGameplayClueChoices('No Variant', 'Quacker').colors[0]?.label).toBe('Quack');
  });

  it('carries the Empty Clues modifier through clue presentation data', () => {
    expect(getGameplayClueChoices('No Variant').allowEmptyClues).toBe(false);
    expect(getGameplayClueChoices('No Variant', '', true).allowEmptyClues).toBe(true);
  });

  it('uses the actual clue giver character when presenting an authoritative clue', () => {
    const metadata = {
      options: { variantName: 'No Variant', emptyClues: false },
      ourPlayerIndex: 0,
      characterAssignments: [null, 34],
    } as unknown as Parameters<typeof getGameplayClueChoicesForPlayerIndex>[0];
    expect(getGameplayClueChoicesForPlayerIndex(metadata, 1).colors[0]?.label).toBe('Quack');
    expect(getGameplayClueChoicesForPlayerIndex(metadata, 0).colors[0]?.label).toBe('Red');
  });

  it('exposes exact variant clue fills without leaking upstream imports into UI', () => {
    expect(getClueColorFill('No Variant', 0)).toBe('#e60000');
    expect(getClueColorFill('No Variant', 99)).toBeNull();
  });

  it('maps authoritative play and discard orders to visible suit labels', () => {
    const game = {
      playStacks: [[0, 1], [], [], [], []],
      discardStacks: [[2], [3, 4], [], [], []],
      deck: [
        { suitIndex: 0, rank: 1 },
        { suitIndex: 0, rank: 2 },
        { suitIndex: 0, rank: 3 },
        { suitIndex: 1, rank: 1 },
        { suitIndex: 1, rank: 4 },
      ],
    } as unknown as Parameters<typeof getGameTableSuits>[1];

    const suits = getGameTableSuits('No Variant', game);

    expect(suits[0]).toEqual({
      suitIndex: 0,
      suitName: 'Red',
      topCardLabel: 'Red 2',
      discardCardLabels: ['Red 3'],
    });
    expect(suits[1]).toEqual({
      suitIndex: 1,
      suitName: 'Yellow',
      topCardLabel: null,
      discardCardLabels: ['Yellow 1', 'Yellow 4'],
    });
  });

  it('uses adjusted Clue Starved thresholds and unadjusted display values', () => {
    const variantName = 'Clue Starved (5 Suits)';
    expect(hasClueTokenForVariant(1, variantName)).toBe(false);
    expect(hasClueTokenForVariant(2, variantName)).toBe(true);
    expect(getDisplayedClueTokens(1, variantName)).toBe(0.5);
    expect(getDisplayedClueTokens(2, variantName)).toBe(1);
  });

  it('permits discards only below the upstream maximum clue-token threshold', () => {
    expect(canDiscardForVariant(7, 'No Variant')).toBe(true);
    expect(canDiscardForVariant(8, 'No Variant')).toBe(false);
    expect(canDiscardForVariant(15, 'Clue Starved (5 Suits)')).toBe(true);
    expect(canDiscardForVariant(16, 'Clue Starved (5 Suits)')).toBe(false);
  });

  it('matches pinned web live FRE semantics, including note and manual adjustments', () => {
    const game = {
      stats: {
        maxScore: 25,
        cardsGotten: 3,
        cardsGottenByNotes: 2,
        cluesStillUsableNotRounded: 20.9,
      },
    } as unknown as Parameters<typeof getDisplayedLiveFutureEfficiency>[0];

    expect(getDisplayedLiveFutureEfficiency(game, 1)).toBeCloseTo(19 / 20);
  });

  it('hides live FRE when no finite future efficiency exists', () => {
    const unavailable = {
      stats: {
        maxScore: 25,
        cardsGotten: 3,
        cardsGottenByNotes: 0,
        cluesStillUsableNotRounded: null,
      },
    } as unknown as Parameters<typeof getDisplayedLiveFutureEfficiency>[0];
    const noClues = {
      stats: {
        maxScore: 25,
        cardsGotten: 3,
        cardsGottenByNotes: 0,
        cluesStillUsableNotRounded: 0,
      },
    } as unknown as Parameters<typeof getDisplayedLiveFutureEfficiency>[0];

    expect(getDisplayedLiveFutureEfficiency(unavailable, 0)).toBeNull();
    expect(getDisplayedLiveFutureEfficiency(noClues, 0)).toBeNull();
  });
});
