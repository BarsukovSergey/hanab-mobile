import { describe, expect, test } from '@jest/globals';

import { canToggleHypotheticalDrawnCards } from './hypotheticalEligibility';
import type { HypotheticalState } from './types/HypotheticalState';
import type { ActionIncludingHypothetical } from './types/actions';

const draw = { type: 'draw', playerIndex: 0, order: 5, suitIndex: 0, rank: 1 } as ActionIncludingHypothetical;
const discard = { type: 'discard', playerIndex: 0, order: 5, suitIndex: 0, rank: 1, failed: false } as ActionIncludingHypothetical;
const play = { type: 'play', playerIndex: 0, order: 5, suitIndex: 0, rank: 1 } as ActionIncludingHypothetical;
const clue = {
  type: 'clue', clue: { type: 0, value: 0 }, giver: 0, list: [5], target: 1, ignoreNegative: false,
} as unknown as ActionIncludingHypothetical;
const otherDiscard = { ...discard, order: 6 } as ActionIncludingHypothetical;
const otherPlay = { ...play, order: 6 } as ActionIncludingHypothetical;
const otherClue = {
  type: 'clue', clue: { type: 0, value: 0 }, giver: 0, list: [6], target: 1, ignoreNegative: false,
} as unknown as ActionIncludingHypothetical;

function isEligible(
  actions: readonly ActionIncludingHypothetical[],
  drawnCardsInHypothetical: readonly number[] = [],
): boolean {
  return canToggleHypotheticalDrawnCards({
    actions,
    drawnCardsInHypothetical,
  } as HypotheticalState);
}

describe('hypothetical drawn-card reveal eligibility', () => {
  test('allows toggling with an empty retained history', () => {
    expect(isEligible([])).toBe(true);
  });

  test('allows toggling when the retained history contains only a draw', () => {
    expect(isEligible([draw])).toBe(true);
  });

  test('disallows toggling when a retained discard conflicts with its drawn card', () => {
    expect(isEligible([draw, discard])).toBe(false);
  });

  test('disallows toggling when a retained play conflicts with its drawn card', () => {
    expect(isEligible([draw, play])).toBe(false);
  });

  test('disallows toggling when a retained clue touches its drawn card', () => {
    expect(isEligible([draw, clue])).toBe(false);
  });

  test('allows toggling when retained actions involve other orders', () => {
    expect(isEligible([draw, otherDiscard])).toBe(true);
    expect(isEligible([draw, otherPlay])).toBe(true);
    expect(isEligible([draw, otherClue])).toBe(true);
  });

  test('allows toggling after Back-equivalent retained history removes the conflict', () => {
    expect(isEligible([draw])).toBe(true);
  });

  test('allows toggling with empty retained history despite stale drawn-card bookkeeping', () => {
    expect(isEligible([], [5])).toBe(true);
  });
});
