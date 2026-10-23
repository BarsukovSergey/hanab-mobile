import { expect, test } from '@jest/globals';
import { getC17LandscapeLayout } from './c17LandscapeLayout';
import { getC17DenseLayout, getC17CardLaneWidth } from './c17DenseLayout';
import { getSideClueSize, sideClueFits, sideClueNativeFits } from './sideClueLayout';

test.each([2, 3, 4, 5, 6])('%iP portrait reuses 62dp with a 48dp target and unchanged cards/row heights', playerCount => {
  for (const fontScale of [1, 1.3, 1.5]) {
    const lane = getC17CardLaneWidth(360, 66);
    const layout = getC17DenseLayout({ portraitV2: true, opponentCount: playerCount - 1, cardsPerHand: playerCount < 4 ? 5 : playerCount === 6 ? 3 : 4,
      opponentCardLaneWidth: lane, ownCardLaneWidth: lane, handsRegionHeight: 354 });
    const before = { ...layout };
    expect(sideClueFits({ portrait: true, playerCount, rowHeight: layout.opponentRowHeight, fontScale })).toBe(true);
    const size = getSideClueSize(fontScale);
    expect(size.width).toBe(62); expect(size.height).toBeGreaterThanOrEqual(48);
    expect(size.height).toBeLessThanOrEqual(layout.opponentRowHeight - 6);
    expect(layout).toEqual(before);
  }
});

test.each([2, 3])('%iP landscape only consumes existing surplus; fonts and safe insets never change the allocator', playerCount => {
  for (const fontScale of [1, 1.3, 1.5]) for (const [left, right] of [[28, 48], [48, 28]]) {
    const input = { availableWidth: 1000 - left! - right!, availableHeight: 472, fontScale, playerCount,
      cardsPerHand: 5, seatingAnchorIndex: 0, ownHandPosition: 'bottom' as const, leftHeaderHeight: 72 };
    const layout = getC17LandscapeLayout(input);
    expect(layout.fits).toBe(true); if (!layout.fits) return;
    const before = { ...layout };
    const fits = sideClueFits({ portrait: false, playerCount, rowHeight: layout.rowHeight, fontScale, leftWidth: layout.leftWidth, cardCellWidth: layout.cellWidth });
    if (fits) expect(layout.cellWidth + 66).toBeLessThanOrEqual(layout.leftWidth);
    expect(getC17LandscapeLayout(input)).toEqual(before);
  }
});

test('constrained 2P has zero surplus; enlarged tiny portrait and paired landscape remain outside the side affordance envelope', () => {
  const layout = getC17LandscapeLayout({ availableWidth: 720, availableHeight: 392, fontScale: 1, playerCount: 2, cardsPerHand: 5, leftHeaderHeight: 72, seatingAnchorIndex: 0, ownHandPosition: 'bottom' });
  expect(layout.fits).toBe(true); if (!layout.fits) return;
  expect(layout.leftWidth - layout.cellWidth).toBe(0);
  expect(sideClueFits({ portrait: false, playerCount: 2, rowHeight: layout.rowHeight, fontScale: 1, leftWidth: layout.leftWidth, cardCellWidth: layout.cellWidth })).toBe(false);
  expect(sideClueFits({ portrait: true, playerCount: 6, rowHeight: 55, fontScale: 2 })).toBe(false);
  expect(sideClueFits({ portrait: false, playerCount: 4, rowHeight: 100, fontScale: 1, leftWidth: 900, cardCellWidth: 200 })).toBe(false);
});

test('native touch rectangle and intrinsic label must both fit without hitSlop or scaling text down', () => {
  expect(sideClueNativeFits(49, { width: 62, height: 48 }, { width: 28, height: 14 }, 1)).toBe(true);
  expect(sideClueNativeFits(49, { width: 47, height: 48 }, { width: 28, height: 14 }, 1)).toBe(false);
  expect(sideClueNativeFits(49, { width: 62, height: 50 }, { width: 28, height: 14 }, 1)).toBe(false);
  expect(sideClueNativeFits(49, { width: 62, height: 48 }, { width: 55, height: 14 }, 1)).toBe(false);
  expect(sideClueNativeFits(49, { width: 62, height: 48 }, { width: 28, height: 15 }, 1)).toBe(false);
  expect(sideClueNativeFits(49, { width: 62, height: 48 }, { width: 0, height: 0 }, 1)).toBe(false);
});
