import { describe, expect, test } from '@jest/globals';
import { getC17LandscapeLayout } from './c17LandscapeLayout';
import { getLandscapeWorkbenchEnvelope } from './landscapeWorkbench';

describe('Clue-defined landscape action envelope', () => {
  test.each([1, 1.3, 1.5, 2])('fontScale %s reserves both rows, sticky footer and a usable secondary viewport', (fontScale) => {
    const envelope = getLandscapeWorkbenchEnvelope(fontScale);
    expect(envelope.choiceHeight).toBeGreaterThanOrEqual(18 * fontScale + 4);
    expect(envelope.footerHeight).toBeGreaterThanOrEqual(14 * fontScale + 6);
    expect(envelope.minimumHeight).toBeGreaterThanOrEqual(
      envelope.secondaryHeight + envelope.composerHeight + envelope.inspectionHeight + 6);
    expect(envelope.inspectionHeight).toBeGreaterThanOrEqual(40);
    for (const playerCount of [2, 3, 4, 5, 6]) {
      const input = { availableWidth: 1200, availableHeight: 600, fontScale, playerCount,
        cardsPerHand: playerCount < 4 ? 5 : playerCount === 6 ? 3 : 4,
        ownHandPosition: 'bottom' as const, seatingAnchorIndex: 0, leftHeaderHeight: 78, suitCount: 8 };
      const layout = getC17LandscapeLayout(input);
      expect(layout.fits).toBe(true);
      if (!layout.fits) throw new Error(layout.reason);
      expect(layout.workbenchHeight).toBeGreaterThanOrEqual(envelope.minimumHeight);
      for (const tool of ['idle', 'card', 'clue', 'note', 'rewind', 'replay', 'shared', 'hypothetical']) {
        expect(getC17LandscapeLayout({ ...input, ...{ tool } })).toEqual(layout);
      }
    }
  });

  test('294dp cannot expose partial mandatory controls; exact normal-font right minimum is 302dp', () => {
    const input = { availableWidth: 860, availableHeight: 294, fontScale: 1, playerCount: 2,
      cardsPerHand: 5, ownHandPosition: 'bottom' as const, seatingAnchorIndex: 0 };
    expect(getC17LandscapeLayout(input)).toEqual({ fits: false, reason: 'body-height' });
    expect(getC17LandscapeLayout({ ...input, availableHeight: 301 })).toEqual({ fits: false, reason: 'body-height' });
    const exact = getC17LandscapeLayout({ ...input, availableHeight: 302 });
    expect(exact.fits).toBe(true);
    if (exact.fits) expect(exact.workbenchHeight).toBe(136);
  });

  test.each([2, 3, 4, 5, 6])('%iP enlarged-font synthetic safe-content fixture fits without shrinking cards or HUD', (playerCount) => {
    const layout = getC17LandscapeLayout({ availableWidth: 860, availableHeight: 363, fontScale: 1.5,
      playerCount, cardsPerHand: playerCount < 4 ? 5 : playerCount === 6 ? 3 : 4,
      ownHandPosition: 'bottom', seatingAnchorIndex: 0, leftHeaderHeight: 85, suitCount: 8 });
    expect(layout.fits).toBe(true);
    if (!layout.fits) throw new Error(layout.reason);
    expect(layout.cardHeight).toBeGreaterThanOrEqual(68);
    expect(layout.workbenchHeight).toBe(154);
    expect(layout.rightMin).toBe(378);
  });
});
