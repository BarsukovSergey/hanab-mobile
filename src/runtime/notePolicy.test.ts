import { describe, expect, test } from '@jest/globals';

import { isEditableLiveNoteOrder } from './notePolicy';

describe('isEditableLiveNoteOrder', () => {
  const notes = [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}] as const;

  test('accepts card orders in the authoritative notes domain', () => {
    expect(isEditableLiveNoteOrder(notes, 1)).toBe(true);
    expect(isEditableLiveNoteOrder(notes, 6)).toBe(true);
    expect(isEditableLiveNoteOrder(notes, 12)).toBe(true);
  });

  test('accepts a historical card no longer in a current hand', () => {
    expect(isEditableLiveNoteOrder(notes, 3)).toBe(true);
  });

  test('rejects orders outside the authoritative notes domain', () => {
    expect(isEditableLiveNoteOrder(notes, 13)).toBe(false);
    expect(isEditableLiveNoteOrder(notes, -1)).toBe(false);
    expect(isEditableLiveNoteOrder(notes, 1.5)).toBe(false);
  });
});
