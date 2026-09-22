import { describe, expect, test } from '@jest/globals';

import { getLastCluePresentation } from './lastClue';

describe('getLastCluePresentation', () => {
  test('keeps the latest clue through trailing bookkeeping records', () => {
    expect(getLastCluePresentation([
      { type: 'play' },
      { type: 'clue', clue: { type: 1, value: 3 }, giver: 0, list: [12, 14], target: 1 },
      { type: 'turn' },
      { type: 'status' },
      { type: 'draw' },
    ])).toEqual({
      giverPlayerIndex: 0,
      targetPlayerIndex: 1,
      clueType: 'rank',
      value: 3,
      touchedOrders: [12, 14],
    });
  });

  test('clears the previous clue after the next play or discard action', () => {
    const clue = { type: 'clue' as const, clue: { type: 0 as const, value: 2 }, giver: 0, list: [9], target: 1 };
    expect(getLastCluePresentation([clue, { type: 'play' }, { type: 'turn' }])).toBeNull();
    expect(getLastCluePresentation([clue, { type: 'discard' }, { type: 'status' }])).toBeNull();
  });

  test('returns the newer clue when clues happen consecutively', () => {
    expect(getLastCluePresentation([
      { type: 'clue', clue: { type: 0, value: 0 }, giver: 0, list: [1], target: 1 },
      { type: 'turn' },
      { type: 'clue', clue: { type: 1, value: 5 }, giver: 1, list: [4], target: 0 },
    ])?.value).toBe(5);
  });
});
