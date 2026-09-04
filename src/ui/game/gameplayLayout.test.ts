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
    expect(layout.ownLaneWidth).toBe(layout.contentWidth);
    expect(layout.opponentLaneWidth).toBe(layout.contentWidth);
    expect(getHandRowWidth(layout.ownCardHeight, 5, layout.cardGap)).toBeLessThanOrEqual(layout.ownLaneWidth + 0.5);
    expect(getHandRowWidth(layout.opponentCardHeight, 5, layout.cardGap)).toBeLessThanOrEqual(layout.opponentLaneWidth + 0.5);
    expect(layout.ownCardHeight).toBeGreaterThan(layout.opponentCardHeight);
  });

  test('uses a wider own lane and readable two-column opponent area on landscape phones', () => {
    const layout = getGameplayLayout({
      viewportWidth: 844,
      viewportHeight: 390,
      handSizes: [5, 5, 5, 5],
      ourPlayerIndex: 0,
    });

    expect(layout.orientation).toBe('landscape');
    expect(layout.opponentColumns).toBe(2);
    expect(layout.ownLaneWidth).toBeGreaterThan(layout.opponentLaneWidth);
    expect(layout.ownLaneWidth + layout.opponentLaneWidth).toBeLessThan(layout.contentWidth);
    expect(layout.ownCardHeight).toBeGreaterThanOrEqual(58);
    expect(layout.ownCardHeight).toBeLessThanOrEqual(88);
    expect(layout.opponentCardHeight).toBeGreaterThanOrEqual(42);
    expect(layout.opponentCardHeight).toBeLessThanOrEqual(60);
  });

  test('never over-allocates the two landscape lanes on a narrow phone', () => {
    const layout = getGameplayLayout({
      viewportWidth: 480,
      viewportHeight: 320,
      handSizes: [5, 5, 5],
      ourPlayerIndex: 0,
    });

    expect(layout.orientation).toBe('landscape');
    expect(layout.ownLaneWidth + layout.opponentLaneWidth + 10).toBeLessThanOrEqual(layout.contentWidth + 0.5);
    expect(getHandRowWidth(layout.ownCardHeight, 5, layout.cardGap)).toBeLessThanOrEqual(layout.ownLaneWidth + 0.5);
    expect(getHandRowWidth(layout.opponentCardHeight, 5, layout.cardGap)).toBeLessThanOrEqual(layout.opponentLaneWidth + 0.5);
  });

  test('keeps two opponent hands stacked instead of squeezing them side-by-side', () => {
    const layout = getGameplayLayout({
      viewportWidth: 780,
      viewportHeight: 390,
      handSizes: [5, 5, 5],
      ourPlayerIndex: 0,
    });

    expect(layout.orientation).toBe('landscape');
    expect(layout.opponentColumns).toBe(1);
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
    expect(getHandRowWidth(extraCard.ownCardHeight, 6, extraCard.cardGap)).toBeLessThanOrEqual(extraCard.ownLaneWidth + 0.5);
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
