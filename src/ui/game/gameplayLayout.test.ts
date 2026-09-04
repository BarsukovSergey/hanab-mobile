import { describe, expect, test } from '@jest/globals';

import { getGameplayLayout, getHandRowWidth } from './gameplayLayout';

describe('getGameplayLayout', () => {
  test('fits a normal five-card hand across a portrait phone without horizontal scrolling', () => {
    const layout = getGameplayLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      handSizes: [5, 5, 5, 5],
      ourPlayerIndex: 0,
    });

    expect(layout.orientation).toBe('portrait');
    expect(layout.opponentColumns).toBe(1);
    expect(getHandRowWidth(layout.ownCardHeight, 5, layout.cardGap)).toBeLessThanOrEqual(layout.handContentWidth + 0.5);
    expect(getHandRowWidth(layout.opponentCardHeight, 5, layout.cardGap)).toBeLessThanOrEqual(layout.handContentWidth + 0.5);
    expect(layout.ownCardHeight).toBeGreaterThan(layout.opponentCardHeight);
  });

  test('uses two opponent columns in landscape phone geometry', () => {
    const layout = getGameplayLayout({
      viewportWidth: 844,
      viewportHeight: 390,
      handSizes: [5, 5, 5, 5],
      ourPlayerIndex: 0,
    });

    expect(layout.orientation).toBe('landscape');
    expect(layout.opponentColumns).toBe(2);
  });

  test('shrinks rather than overflowing when an extra card modifier produces six cards', () => {
    const normal = getGameplayLayout({
      viewportWidth: 360,
      viewportHeight: 780,
      handSizes: [5, 5, 5],
      ourPlayerIndex: 0,
    });
    const extraCard = getGameplayLayout({
      viewportWidth: 360,
      viewportHeight: 780,
      handSizes: [6, 6, 6],
      ourPlayerIndex: 0,
    });

    expect(extraCard.ownCardHeight).toBeLessThan(normal.ownCardHeight);
    expect(getHandRowWidth(extraCard.ownCardHeight, 6, extraCard.cardGap)).toBeLessThanOrEqual(extraCard.handContentWidth + 0.5);
  });

  test('flags a shared vertical-scroll fallback for very dense small-screen tables', () => {
    const layout = getGameplayLayout({
      viewportWidth: 320,
      viewportHeight: 568,
      handSizes: [5, 5, 5, 5, 5, 5],
      ourPlayerIndex: 0,
    });

    expect(layout.needsSharedVerticalScroll).toBe(true);
  });

  test('does not invent an own-hand section for spectators', () => {
    const layout = getGameplayLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      handSizes: [5, 5, 5],
      ourPlayerIndex: null,
    });

    expect(layout.ownCardHeight).toBe(0);
    expect(layout.opponentCardHeight).toBeGreaterThan(0);
  });
});
