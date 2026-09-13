import { describe, expect, test } from '@jest/globals';

import { canToggleHypotheticalDrawnCards } from './hypotheticalEligibility';
import type { HypotheticalState } from './types/HypotheticalState';
import type { ActionIncludingHypothetical } from './types/actions';

const draw = { type: 'draw', playerIndex: 0, order: 5, suitIndex: 0, rank: 1 } as ActionIncludingHypothetical;
const discard = { type: 'discard', playerIndex: 0, order: 5, suitIndex: 0, rank: 1, failed: false } as ActionIncludingHypothetical;

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
  test('allows toggling when the retained history contains a draw', () => {
    expect(isEligible([draw])).toBe(true);
  });

  test('disallows toggling when a retained action conflicts with its drawn card', () => {
    expect(isEligible([draw, discard])).toBe(false);
  });

  test('allows toggling after Back-equivalent retained history removes the conflict', () => {
    expect(isEligible([draw])).toBe(true);
  });

  test('disallows toggling when retained history has no draw despite stale drawn-card bookkeeping', () => {
    expect(isEligible([], [5])).toBe(false);
  });
});
