import { expect, test } from '@jest/globals';
import type { CardIdentity, GameState } from '../bootstrap/types';
import { CardStatus } from '../upstream/enums/CardStatus';
import { getDiscardPresentation } from './discardPresentation';

function game() {
  return { discardStacks: [[3, 1, 2], [0]], deck: [
    { order: 0, suitIndex: 1, rank: 1 },
    { order: 1, suitIndex: 0, rank: 2 },
    { order: 2, suitIndex: 0, rank: 2 },
    { order: 3, suitIndex: 0, rank: 1, numPositiveClues: 1, segmentDiscarded: 4 },
  ], cardStatus: [[0, CardStatus.Trash, CardStatus.NeedsToBePlayed], [0, CardStatus.Critical]] } as unknown as GameState;
}

test('filters only engine Trash, preserving duplicates individually and stack order', () => {
  const result = getDiscardPresentation(game());
  expect(result.cards.map((card) => card.order)).toEqual([3, 1, 2, 0]);
  expect(result.relevantCards.map((card) => card.order)).toEqual([1, 2, 0]);
  expect(result.cards[0]?.faded).toBe(true);
  expect(result.relevantCards.slice(0, 2).map((card) => card.rank)).toEqual([2, 2]);
});

test('handles empty and nonempty all-trash piles separately', () => {
  expect(getDiscardPresentation({ ...game(), discardStacks: [] } as unknown as GameState).cards).toEqual([]);
  const result = getDiscardPresentation({ ...game(), discardStacks: [[3]] } as unknown as GameState);
  expect(result.cards).toHaveLength(1);
  expect(result.relevantCards).toEqual([]);
});

test('uses authoritative revealed identity when deck identity is hidden', () => {
  const identities = [ , { suitIndex: 0, rank: 1 } ] as readonly CardIdentity[];
  expect(getDiscardPresentation(game(), identities).relevantCards.map((card) => card.order)).toEqual([2, 0]);
});
