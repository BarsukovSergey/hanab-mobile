import { describe, expect, test } from '@jest/globals';

import { isEditableLiveNoteOrder } from './notePolicy';

describe('isEditableLiveNoteOrder', () => {
  const hands = [[0, 1, 2], [5, 6, 7], [10, 11, 12]] as const;

  test('accepts cards in our hand or an opponent hand', () => {
    expect(isEditableLiveNoteOrder(hands, 1)).toBe(true);
    expect(isEditableLiveNoteOrder(hands, 6)).toBe(true);
    expect(isEditableLiveNoteOrder(hands, 12)).toBe(true);
  });

  test('rejects cards that are no longer in a live hand', () => {
    expect(isEditableLiveNoteOrder(hands, 3)).toBe(false);
    expect(isEditableLiveNoteOrder(hands, -1)).toBe(false);
    expect(isEditableLiveNoteOrder(hands, 1.5)).toBe(false);
  });
});
