import { describe, expect, it } from '@jest/globals';

import { getGameTableSuits } from './gameplay';

describe('getGameTableSuits', () => {
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
});
