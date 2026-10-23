import { expect, test } from '@jest/globals';
import { getC17LandscapeLayout } from './c17LandscapeLayout';
import { getHandLabelGeometry } from './handLabelGeometry';

test.each([
  { fontScale: 1, safeHeight: 400, header: 72, required: 404 },
  { fontScale: 1.5, safeHeight: 363, header: 85, required: 447 },
])('PR5 proposed fixed labels fail the existing $safeHeight dp fixture without reducing card floor', ({ fontScale, safeHeight, header, required }) => {
  const labels = getHandLabelGeometry(fontScale);
  expect(3 * (68 + labels.landscapeHeight + 4 + 4) + 8 + header).toBe(required);
  for (const playerCount of [3, 5, 6]) {
    expect(getC17LandscapeLayout({ availableWidth: 860, availableHeight: safeHeight, fontScale,
      playerCount, cardsPerHand: playerCount < 4 ? 5 : playerCount === 6 ? 3 : 4,
      seatingAnchorIndex: 0, ownHandPosition: 'bottom', leftHeaderHeight: header }))
      .toEqual({ fits: false, reason: 'card-floor' });
  }
});
