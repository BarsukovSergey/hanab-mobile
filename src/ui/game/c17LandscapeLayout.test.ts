import { describe, expect, test } from '@jest/globals';
import { getC17LandscapeLayout, getC17LandscapeHandGrid, type C17LandscapeInput } from './c17LandscapeLayout';
import { HANABI_CARD_ASPECT_RATIO } from './gameplayLayout';

const envelope: C17LandscapeInput = { availableWidth: 860, availableHeight: 324, fontScale: 1,
  playerCount: 2, cardsPerHand: 5, seatingAnchorIndex: 0, ownHandPosition: 'bottom' };
const fit = (changes: Partial<C17LandscapeInput> = {}) => {
  const result = getC17LandscapeLayout({ ...envelope, ...changes });
  expect(result.fits).toBe(true);
  if (!result.fits) throw new Error(result.reason);
  return result;
};

describe('deterministic landscape hand templates', () => {
  test('2P standard capacity uses 1x2 and grows equal real hands toward comfort', () => {
    const result = fit();
    expect(result.template).toBe('1x2');
    expect(result.rows).toEqual([[1], [0]]);
    expect(result.cardHeight).toBe(112);
    expect(result.cellWidth).toBeCloseTo(5 * 112 * HANABI_CARD_ASPECT_RATIO + 12 + 8);
    expect(fit({ ownHandPosition: 'top' }).rows).toEqual([[0], [1]]);
  });
  test('3P prefers 1x3 whenever its floor fits, even when 2+1 could enlarge cards', () => {
    const result = fit({ playerCount: 3 });
    expect(result.template).toBe('1x3');
    expect(result.rows).toEqual([[1], [2], [0]]);
    expect(result.cardHeight).toBeGreaterThanOrEqual(68);
    expect(fit({ playerCount: 3, ownHandPosition: 'top' }).rows).toEqual([[0], [1], [2]]);
  });
  test.each(['top', 'bottom'] as const)('3P hand candidate uses centered own row %s only after vertical floor failure', (ownHandPosition) => {
    const input = { ...envelope, playerCount: 3, availableHeight: 276, ownHandPosition };
    const grid = getC17LandscapeHandGrid(input);
    expect(grid.fits).toBe(true);
    if (!grid.fits) throw new Error(grid.reason);
    expect(grid.template).toBe('2+1');
    expect(grid.rows).toEqual(ownHandPosition === 'top' ? [[0], [1, 2]] : [[1, 2], [0]]);
    expect(grid.cardHeight).toBeGreaterThanOrEqual(68);
    // The complete shell still rejects this height: the mandatory right stack needs 294.
    expect(getC17LandscapeLayout(input)).toEqual({ fits: false, reason: 'body-height' });
    expect(getC17LandscapeHandGrid({ ...input, availableWidth: 400 }).fits).toBe(false);
  });
  test('4P standard four-card capacity uses equal 2x2 hands constrained by width', () => {
    const result = fit({ playerCount: 4, cardsPerHand: 4, availableWidth: 720 });
    expect(result.template).toBe('2x2');
    expect(result.rows).toEqual([[1, 2], [3, 0]]);
    expect(result.cardHeight).toBeLessThan(112);
    expect(result.gridWidth + 8 + result.rightMin).toBeLessThanOrEqual(720);
  });
  test.each(['top', 'bottom'] as const)('5P four-card capacity centers own %s, with two paired rows', (ownHandPosition) => {
    const result = fit({ playerCount: 5, cardsPerHand: 4, ownHandPosition, availableWidth: 720 });
    expect(result.template).toBe('2+2+1');
    expect(result.rows).toEqual(ownHandPosition === 'top' ? [[0], [1, 2], [3, 4]] : [[1, 2], [3, 4], [0]]);
    expect(result.cardHeight).toBeLessThan(112);
    expect(result.rows.filter((row) => row.length === 1)).toEqual([[0]]);
  });
  test('6P standard three-card capacity has three rows of two under vertical pressure', () => {
    const result = fit({ playerCount: 6, cardsPerHand: 3, availableHeight: 294 });
    expect(result.template).toBe('3x2');
    expect(result.rows).toEqual([[1, 2], [3, 4], [5, 0]]);
    expect(result.cardHeight).toBe(73);
    expect(result.gridHeight).toBeLessThanOrEqual(294);
    expect(fit({ playerCount: 6, cardsPerHand: 3, ownHandPosition: 'top' }).rows[0]).toEqual([0, 1]);
  });
  test('seating remains relative to the server anchor', () => {
    expect(fit({ playerCount: 6, cardsPerHand: 3, seatingAnchorIndex: 3 }).rows).toEqual([[4, 5], [0, 1], [2, 3]]);
  });
});

describe('card, divider and right-column envelopes', () => {
  test.each([2, 3, 4, 5, 6])('%iP successful geometry respects every floor and bound', (playerCount) => {
    for (const fontScale of [0.8, 1, 1.25, 1.5, 2]) {
      const result = fit({ playerCount, cardsPerHand: playerCount < 4 ? 5 : playerCount === 6 ? 3 : 4, fontScale });
      expect(Number.isInteger(result.cardHeight)).toBe(true);
      expect(result.cardHeight).toBeGreaterThanOrEqual(68);
      expect(result.cardHeight).toBeLessThanOrEqual(112);
      expect(result.rightWidth).toBeGreaterThanOrEqual(result.rightMin);
      expect(result.rightWidth).toBeLessThanOrEqual(result.rightComfort);
      expect(result.leftWidth + 8 + result.rightWidth).toBeCloseTo(envelope.availableWidth);
      expect(result.gridWidth).toBeLessThanOrEqual(result.leftWidth);
      expect(result.workbenchHeight).toBeGreaterThanOrEqual(88);
      expect(result.workbenchHeight).toBeLessThanOrEqual(128);
    }
  });
  test('divider reserves minimum then grows right toward comfort without stretching cards', () => {
    const constrained = fit({ playerCount: 4, cardsPerHand: 4, availableWidth: 720 });
    expect(constrained.rightWidth).toBeLessThan(constrained.rightComfort);
    expect(fit({ availableWidth: 1200, availableHeight: 600 }).rightWidth).toBe(320);
    expect(fit({ fontScale: 1.5 }).rightMin).toBe(276);
    expect(fit({ fontScale: 1.5 }).rightComfort).toBe(336);
    expect(fit({ fontScale: 2 })).toEqual(fit({ fontScale: 1.5 }));
    expect(fit({ fontScale: 0.8 })).toEqual(fit({ fontScale: 1 }));
  });
  test('Workbench reserves 88 to 128 and leaves extra height unused', () => {
    expect(fit({ availableHeight: 294 }).workbenchHeight).toBe(88);
    expect(fit({ availableHeight: 600 }).workbenchHeight).toBe(128);
  });
  test('short body, narrow width and capacity pressure fail explicitly', () => {
    expect(getC17LandscapeLayout({ ...envelope, availableHeight: 293 })).toEqual({ fits: false, reason: 'body-height' });
    expect(getC17LandscapeLayout({ ...envelope, availableWidth: 400 }).fits).toBe(false);
    expect(getC17LandscapeLayout({ ...envelope, playerCount: 6, cardsPerHand: 8 }).fits).toBe(false);
    expect(getC17LandscapeLayout({ ...envelope, availableWidth: NaN }).fits).toBe(false);
  });
  test('turn, tool and depletion are absent from the geometry input and cannot reflow it', () => {
    const shell = { ...envelope, playerCount: 6, cardsPerHand: 3 };
    const unrelatedState = { ...shell, turn: 12, tool: 'note', remainingCards: [0, 1, 2, 0, 1, 0] };
    expect(getC17LandscapeLayout(unrelatedState)).toEqual(getC17LandscapeLayout(shell));
    expect(Object.keys(shell).sort()).toEqual(['availableWidth', 'availableHeight', 'cardsPerHand', 'fontScale', 'ownHandPosition', 'playerCount', 'seatingAnchorIndex'].sort());
  });
});
