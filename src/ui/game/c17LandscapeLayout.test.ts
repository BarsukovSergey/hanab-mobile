import { describe, expect, test } from '@jest/globals';
import { getC17LandscapeLayout, getLandscapeMetricHeight, landscapeMetricsFit, type C17LandscapeInput } from './c17LandscapeLayout';
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
  test('3P uses 1x3 at the minimum valid complete-shell height', () => {
    const result = fit({ playerCount: 3, availableHeight: 294 });
    expect(result.template).toBe('1x3');
    expect(result.rows).toEqual([[1], [2], [0]]);
    expect(result.cardHeight).toBeGreaterThanOrEqual(68);
    expect(fit({ playerCount: 3, availableHeight: 294, ownHandPosition: 'top' }).rows).toEqual([[0], [1], [2]]);
  });
  test.each(['top', 'bottom'] as const)('3P own hand %s fails below the 294dp complete-shell floor', (ownHandPosition) => {
    for (const availableHeight of [276, 293]) {
      expect(getC17LandscapeLayout({ ...envelope, playerCount: 3, availableHeight, ownHandPosition }))
        .toEqual({ fits: false, reason: 'body-height' });
    }
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
  test.each([2, 3, 4, 5, 6])('%iP measured left header uses only left height; safe edges are subtracted once', (playerCount) => {
    for (const fontScale of [1, 1.3, 1.5]) {
      for (const [left, right] of [[28, 48], [48, 28], [0, 24]]) {
        const input = { ...envelope, availableWidth: 1000 - left! - right!, availableHeight: 440 - 24 - 24,
          playerCount, cardsPerHand: playerCount < 4 ? 5 : playerCount === 6 ? 3 : 4,
          fontScale, leftHeaderHeight: 72 };
        const result = getC17LandscapeLayout(input);
        expect(result.fits).toBe(true);
        if (!result.fits) throw new Error(result.reason);
        expect(result.gridHeight + input.leftHeaderHeight).toBeLessThanOrEqual(input.availableHeight);
        expect(result.leftWidth + result.rightWidth + 8).toBeCloseTo(input.availableWidth);
        expect(result.rightMin).toBe(Math.ceil(252 * fontScale));
        expect(result.rightWidth).toBeGreaterThanOrEqual(result.rightMin);
        expect(result.workbenchHeight).toBeGreaterThanOrEqual(88);
      }
    }
  });

  test('reports impossible left height and expanded capacity without inventing a topology', () => {
    // Three rows at the 68dp floor need 278dp; a 48dp header needs 326dp total.
    expect(getC17LandscapeLayout({ ...envelope, playerCount: 3, availableHeight: 324, leftHeaderHeight: 48 }))
      .toEqual({ fits: false, reason: 'card-floor' });
    expect(getC17LandscapeLayout({ ...envelope, playerCount: 6, cardsPerHand: 8, leftHeaderHeight: 48 }).fits).toBe(false);
    expect(getC17LandscapeLayout({ ...envelope, leftHeaderHeight: NaN }).fits).toBe(false);
  });

  test('requires complete native intrinsic metrics within the row in both dimensions', () => {
    expect(landscapeMetricsFit(252, 252, 34, 1)).toBe(true);
    expect(landscapeMetricsFit(252, 252.1, 34, 1)).toBe(false);
    expect(landscapeMetricsFit(252, 240, 35, 1)).toBe(false);
    expect(landscapeMetricsFit(252, 0, 0, 1)).toBe(false);
    expect(landscapeMetricsFit(378, 377.5, 51, 1.5)).toBe(true);
    expect(getLandscapeMetricHeight(2)).toBe(68);
  });

  test('reserves a measured fixed-probe width only when the readable cards can fit beside it', () => {
    const measured = fit({ metricRowWidth: 350.4 });
    expect(measured.rightMin).toBe(351);
    expect(measured.rightWidth).toBeGreaterThanOrEqual(351);
    expect(getC17LandscapeLayout({ ...envelope, availableWidth: 500, metricRowWidth: 351 }).fits).toBe(false);
  });

  test('reserves native header actions and readable identity, failing before buttons can overlap metrics', () => {
    const roomy = fit({ leftHeaderMinWidth: 500, leftHeaderHeight: 78 });
    expect(roomy.leftWidth).toBeGreaterThanOrEqual(500);
    expect(roomy.gridWidth).toBeLessThanOrEqual(roomy.leftWidth);
    expect(getC17LandscapeLayout({ ...envelope, availableWidth: 720, leftHeaderMinWidth: 480 }))
      .toEqual({ fits: false, reason: 'card-floor' });
    // The 480dp action/identity fixture models enlarged labels and multi-digit unread;
    // these are supplied native dimensions, not claimed Android font measurements.
    expect(getC17LandscapeLayout({ ...envelope, leftHeaderMinWidth: NaN }).fits).toBe(false);
  });
  test.each([2, 3, 4, 5, 6])('%iP successful geometry respects every floor and bound', (playerCount) => {
    for (const fontScale of [0.8, 1, 1.25, 1.5, 2]) {
      const result = fit({ playerCount, cardsPerHand: playerCount < 4 ? 5 : playerCount === 6 ? 3 : 4, fontScale, availableWidth: 1200, availableHeight: 420 });
      expect(Number.isInteger(result.cardHeight)).toBe(true);
      expect(result.cardHeight).toBeGreaterThanOrEqual(68);
      expect(result.cardHeight).toBeLessThanOrEqual(112);
      expect(result.rightWidth).toBeGreaterThanOrEqual(result.rightMin);
      expect(result.rightWidth).toBeLessThanOrEqual(result.rightComfort);
      expect(result.leftWidth + 8 + result.rightWidth).toBeCloseTo(1200);
      expect(result.gridWidth).toBeLessThanOrEqual(result.leftWidth);
      expect(result.workbenchHeight).toBeGreaterThanOrEqual(88);
      expect(result.workbenchHeight).toBeLessThanOrEqual(128);
    }
  });
  test('divider reserves minimum then grows right toward comfort without stretching cards', () => {
    const constrained = fit({ playerCount: 4, cardsPerHand: 4, availableWidth: 720 });
    expect(constrained.rightWidth).toBeLessThan(constrained.rightComfort);
    expect(fit({ availableWidth: 1200, availableHeight: 600 }).rightWidth).toBe(320);
    expect(fit({ fontScale: 1.5 }).rightMin).toBe(378);
    expect(fit({ fontScale: 1.5 }).rightComfort).toBe(378);
    expect(fit({ fontScale: 2, availableHeight: 420 }).rightMin).toBe(504);
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
