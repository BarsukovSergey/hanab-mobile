import { describe, expect, test } from '@jest/globals';

import { getGameplayLayout, getHandRowWidth } from './gameplayLayout';

const OWN_PADDING = 18;
const OPPONENT_PADDING = 14;
const COLUMN_GAP = 7;

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
    expect(getHandRowWidth(layout.ownCardHeight, 5, layout.cardGap) + OWN_PADDING).toBeLessThanOrEqual(layout.ownLaneWidth + 0.5);
    expect(getHandRowWidth(layout.opponentCardHeight, 5, layout.cardGap) + OPPONENT_PADDING).toBeLessThanOrEqual(layout.opponentLaneWidth + 0.5);
    expect(layout.ownCardHeight).toBeGreaterThan(layout.opponentCardHeight);
  });

  test('stacks opponent rows on a normal landscape phone rather than creating unreadable columns', () => {
    const layout = getGameplayLayout({
      viewportWidth: 844,
      viewportHeight: 390,
      handSizes: [5, 5, 5, 5],
      ourPlayerIndex: 0,
    });

    expect(layout.orientation).toBe('landscape');
    expect(layout.opponentColumns).toBe(1);
    expect(layout.ownLaneWidth).toBeGreaterThan(layout.opponentLaneWidth);
    expect(layout.ownLaneWidth + layout.opponentLaneWidth).toBeLessThan(layout.contentWidth);
    expect(layout.ownCardHeight).toBeGreaterThanOrEqual(58);
    expect(layout.opponentCardHeight).toBeGreaterThanOrEqual(42);
    expect(getHandRowWidth(layout.opponentCardHeight, 5, layout.cardGap) + OPPONENT_PADDING).toBeLessThanOrEqual(layout.opponentLaneWidth + 0.5);
  });

  test('uses two opponent columns only when both columns can keep readable cards', () => {
    const layout = getGameplayLayout({
      viewportWidth: 1180,
      viewportHeight: 640,
      handSizes: [5, 5, 5, 5],
      ourPlayerIndex: 0,
    });

    expect(layout.orientation).toBe('landscape');
    expect(layout.opponentColumns).toBe(2);
    const columnWidth = (layout.opponentLaneWidth - COLUMN_GAP) / 2;
    expect(layout.opponentCardHeight).toBeGreaterThanOrEqual(42);
    expect(getHandRowWidth(layout.opponentCardHeight, 5, layout.cardGap) + OPPONENT_PADDING).toBeLessThanOrEqual(columnWidth + 0.5);
  });

  test('never over-allocates the two landscape lanes on a narrow phone', () => {
    const layout = getGameplayLayout({
      viewportWidth: 480,
      viewportHeight: 320,
      handSizes: [5, 5, 5],
      ourPlayerIndex: 0,
    });

    expect(layout.orientation).toBe('landscape');
    expect(layout.ownLaneWidth + layout.opponentLaneWidth + 8).toBeLessThanOrEqual(layout.contentWidth + 0.5);
    expect(getHandRowWidth(layout.ownCardHeight, 5, layout.cardGap) + OWN_PADDING).toBeLessThanOrEqual(layout.ownLaneWidth + 0.5);
    expect(getHandRowWidth(layout.opponentCardHeight, 5, layout.cardGap) + OPPONENT_PADDING).toBeLessThanOrEqual(layout.opponentLaneWidth + 0.5);
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
    expect(getHandRowWidth(extraCard.ownCardHeight, 6, extraCard.cardGap) + OWN_PADDING).toBeLessThanOrEqual(extraCard.ownLaneWidth + 0.5);
  });

  test('never lets hand rows overflow their rendered lane across a phone matrix', () => {
    const viewports = [
      [320, 568], [360, 780], [390, 844], [412, 915],
      [480, 320], [740, 360], [844, 390], [915, 412],
    ] as const;

    for (const [viewportWidth, viewportHeight] of viewports) {
      for (let players = 2; players <= 6; players += 1) {
        for (const cards of [4, 5, 6]) {
          const layout = getGameplayLayout({
            viewportWidth,
            viewportHeight,
            handSizes: Array.from({ length: players }, () => cards),
            ourPlayerIndex: 0,
          });
          const opponentColumnWidth = layout.opponentColumns === 2
            ? (layout.opponentLaneWidth - COLUMN_GAP) / 2
            : layout.opponentLaneWidth;
          expect(getHandRowWidth(layout.ownCardHeight, cards, layout.cardGap) + OWN_PADDING)
            .toBeLessThanOrEqual(layout.ownLaneWidth + 0.5);
          expect(getHandRowWidth(layout.opponentCardHeight, cards, layout.cardGap) + OPPONENT_PADDING)
            .toBeLessThanOrEqual(opponentColumnWidth + 0.5);
        }
      }
    }
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
