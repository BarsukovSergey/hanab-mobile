import { expect, test } from '@jest/globals';
import { measureWindow } from '../responsiveSurface';
import { getC17LandscapeLayout } from './c17LandscapeLayout';
import { getNotePaneGeometry } from './notePaneGeometry';

test.each([2, 6])('%sP keeps its allocation in either rotation and subtracts IME only once', (playerCount) => {
  for (const [left, right, bottom] of [[28, 0, 0], [0, 28, 0], [24, 0, 16], [0, 24, 16]] as const) {
    const safe = measureWindow({ width: 960, height: 440 }, { left, right, top: 0, bottom });
    const input = { availableWidth: safe.availableWidth - 24, availableHeight: safe.availableHeight,
      fontScale: 1, playerCount, cardsPerHand: 5, seatingAnchorIndex: 0, ownHandPosition: 'bottom' as const, leftHeaderHeight: 72 };
    const layout = getC17LandscapeLayout(input);
    expect(layout.fits).toBe(true);
    if (!layout.fits) throw new Error('fixture must fit');
    const pane = { width: layout.rightWidth, height: safe.availableHeight };
    expect(getNotePaneGeometry(pane, 0, bottom)).toEqual(pane);
    expect(getNotePaneGeometry(pane, 260, bottom)).toEqual({ width: pane.width, height: 180 });
    expect(getC17LandscapeLayout(input)).toEqual(layout);
    expect(layout.cardHeight).toBeGreaterThanOrEqual(68);
  }
});
