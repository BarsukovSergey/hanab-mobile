import { describe, expect, test } from '@jest/globals';

import { getDiscardSummary } from './discardSummary';

describe('getDiscardSummary', () => {
  test('groups duplicate discarded identities by suit and rank', () => {
    const game = {
      discardStacks: [[0, 1, 2], [3], [], [], []],
      deck: [
        { suitIndex: 0, rank: 1 },
        { suitIndex: 0, rank: 1 },
        { suitIndex: 0, rank: 4 },
        { suitIndex: 1, rank: 2 },
      ],
    } as unknown as Parameters<typeof getDiscardSummary>[1];

    expect(getDiscardSummary('No Variant', game)).toEqual({
      total: 4,
      suits: [
        {
          suitIndex: 0,
          suitName: 'Red',
          total: 3,
          unknownCount: 0,
          ranks: [{ rank: 1, count: 2 }, { rank: 4, count: 1 }],
        },
        {
          suitIndex: 1,
          suitName: 'Yellow',
          total: 1,
          unknownCount: 0,
          ranks: [{ rank: 2, count: 1 }],
        },
      ],
    });
  });

  test('prefers authoritative revealed identity over stale card-state rank', () => {
    const game = {
      discardStacks: [[], [], [], [0], []],
      deck: [{ suitIndex: 3, rank: 1 }],
    } as unknown as Parameters<typeof getDiscardSummary>[1];
    const identities = [{ suitIndex: 3, rank: 4 }] as Parameters<typeof getDiscardSummary>[2];

    expect(getDiscardSummary('No Variant', game, identities)).toEqual({
      total: 1,
      suits: [{
        suitIndex: 3,
        suitName: 'Blue',
        total: 1,
        unknownCount: 0,
        ranks: [{ rank: 4, count: 1 }],
      }],
    });
  });

  test('counts hidden or unavailable discard identities instead of dropping them from the total', () => {
    const game = {
      discardStacks: [[0, 1, 2], [], [], [], []],
      deck: [
        { suitIndex: 0, rank: 1 },
        { suitIndex: 0, rank: null },
      ],
    } as unknown as Parameters<typeof getDiscardSummary>[1];

    expect(getDiscardSummary('No Variant', game)).toEqual({
      total: 3,
      suits: [{
        suitIndex: 0,
        suitName: 'Red',
        total: 3,
        unknownCount: 2,
        ranks: [{ rank: 1, count: 1 }],
      }],
    });
  });

  test('returns an empty summary before the first discard', () => {
    const game = {
      discardStacks: [[], [], [], [], []],
      deck: [],
    } as unknown as Parameters<typeof getDiscardSummary>[1];

    expect(getDiscardSummary('No Variant', game)).toEqual({ total: 0, suits: [] });
  });
});