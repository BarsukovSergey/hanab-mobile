import { describe, expect, test } from '@jest/globals';

import { getCluePreview } from './cluePreview';

describe('getCluePreview', () => {
  test('uses upstream color clue touch semantics for the target hand', () => {
    const game = {
      hands: [[0, 1], [2, 3, 4]],
      deck: [
        { suitIndex: 0, rank: 1 },
        { suitIndex: 1, rank: 1 },
        { suitIndex: 0, rank: 2 },
        { suitIndex: 1, rank: 2 },
        { suitIndex: 0, rank: 5 },
      ],
    } as unknown as Parameters<typeof getCluePreview>[0];

    expect(getCluePreview(game, 'No Variant', 1, 'color', 0)).toEqual({
      type: 'color',
      value: 0,
      targetPlayerIndex: 1,
      touchedOrders: [2, 4],
    });
  });

  test('uses variant rank semantics rather than equality-only UI logic', () => {
    const game = {
      hands: [[0], [1, 2, 3]],
      deck: [
        { suitIndex: 0, rank: 5 },
        { suitIndex: 0, rank: 1 },
        { suitIndex: 1, rank: 3 },
        { suitIndex: 2, rank: 4 },
      ],
    } as unknown as Parameters<typeof getCluePreview>[0];

    const preview = getCluePreview(game, 'Odds and Evens (5 Suits)', 1, 'rank', 1);
    expect(preview?.touchedOrders).toEqual([1, 2]);
  });

  test('rejects invalid targets and clue values', () => {
    const game = { hands: [[]], deck: [] } as unknown as Parameters<typeof getCluePreview>[0];
    expect(getCluePreview(game, 'No Variant', 2, 'rank', 1)).toBeNull();
    expect(getCluePreview(game, 'No Variant', 0, 'color', 999)).toBeNull();
  });
});
