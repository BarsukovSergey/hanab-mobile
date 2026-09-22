import { describe, expect, test } from '@jest/globals';

import { getLiveNoteOrders } from './liveNoteOrders';

describe('getLiveNoteOrders', () => {
  test('includes every live hand and excludes cards that only exist elsewhere', () => {
    const game = {
      hands: [[0, 1], [5, 6], [10, 11]],
      playStacks: [[20]],
      discardStacks: [[21]],
      hole: [22],
    };

    expect(getLiveNoteOrders(game)).toEqual([0, 1, 5, 6, 10, 11]);
  });

  test('returns no editable orders without a live game', () => {
    expect(getLiveNoteOrders(null)).toEqual([]);
  });
});
