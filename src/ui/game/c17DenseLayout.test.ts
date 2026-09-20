import { describe, expect, test } from '@jest/globals';
import {
  getC17CardLaneWidth,
  getC17DenseLayout,
  getC17AmbientEnvelope,
  getC17HandsRegionHeight,
  getC17WorkbenchHeight,
  getRelativeOpponentIndices,
  hasC17AmbientRegionChanged,
} from './c17DenseLayout';

function layout(overrides: Partial<Parameters<typeof getC17DenseLayout>[0]> = {}) {
  return getC17DenseLayout({ opponentCardLaneWidth: 300, handsRegionHeight: 500, ownCardLaneWidth: 300, opponentCount: 5, cardsPerHand: 4, workbenchHeight: 156, ...overrides });
}

describe('C17 dense portrait layout', () => {
  test('keeps server-relative seating stable around the local anchor', () => {
    expect(getRelativeOpponentIndices(6, 0)).toEqual([1, 2, 3, 4, 5]);
    expect(getRelativeOpponentIndices(6, 3)).toEqual([4, 5, 0, 1, 2]);
  });

  test('uses the Full Ledger when full cards meet the 76dp readability floor', () => {
    const result = layout({ opponentCardLaneWidth: 600, ownCardLaneWidth: 300, handsRegionHeight: 700 });
    expect(result.mode).toBe('full-ledger');
    expect(result.opponentCardHeight).toBeGreaterThanOrEqual(76);
    expect(result.ownCardHeight).toBe(result.opponentCardHeight);
    expect(result.opponentRowHeight).toBe(result.opponentCardHeight + result.cardTopHeadroom + 22);
    expect(result.handsHeight).toBeLessThanOrEqual(700);
  });

  test('keeps Full Ledger width limiting and clued-card headroom', () => {
    const narrow = layout({ opponentCardLaneWidth: 360, ownCardLaneWidth: 600, handsRegionHeight: 1400 });
    const wide = layout({ opponentCardLaneWidth: 600, ownCardLaneWidth: 600, handsRegionHeight: 1400 });
    expect(narrow.mode).toBe('full-ledger');
    expect(wide.mode).toBe('full-ledger');
    expect(narrow.opponentCardHeight).toBeLessThan(wide.opponentCardHeight);
    expect(narrow.ownCardHeight).toBe(narrow.opponentCardHeight);
    expect(narrow.cardTopHeadroom).toBeGreaterThanOrEqual(3);
    expect(narrow.cardTopHeadroom).toBeLessThanOrEqual(6);
  });

  test('keeps the authoritative hand capacity in the Full Ledger width calculation', () => {
    const standard = layout({ opponentCardLaneWidth: 600, ownCardLaneWidth: 600, opponentCount: 2, cardsPerHand: 3, handsRegionHeight: 900 });
    const oneExtraCard = layout({ opponentCardLaneWidth: 600, ownCardLaneWidth: 600, opponentCount: 2, cardsPerHand: 4, handsRegionHeight: 900 });
    expect(standard.mode).toBe('full-ledger');
    expect(oneExtraCard.mode).toBe('full-ledger');
    expect(oneExtraCard.ownCardHeight).toBeLessThan(standard.ownCardHeight);
  });

  test('uses Compact Overview with fixed opponent summaries and a readable own hand', () => {
    const result = layout({ handsRegionHeight: 315, opponentCount: 5, cardsPerHand: 4 });
    expect(result.mode).toBe('compact-overview');
    expect(result.opponentCardHeight).toBe(24);
    expect(result.opponentRowHeight).toBe(32);
    expect(result.ownCardHeight).toBeGreaterThan(result.opponentCardHeight);
    expect(result.ownCardHeight).toBeGreaterThanOrEqual(76);
    expect(result.ownRowHeight).toBe(result.ownCardHeight + result.cardTopHeadroom + 22);
    expect(result.handsHeight).toBeLessThanOrEqual(315);
  });

  test('keeps constrained three-player hands in the Full Ledger down to the lower density floor', () => {
    const result = layout({ opponentCount: 2, handsRegionHeight: 232 });

    expect(result.mode).toBe('full-ledger');
    expect(result.opponentCardHeight).toBeGreaterThanOrEqual(46);
    expect(result.opponentCardHeight).toBeLessThan(76);
    expect(result.ownCardHeight).toBe(result.opponentCardHeight);
    expect(result.handsHeight).toBeLessThanOrEqual(232);
  });

  test('keeps the higher Full Ledger floor for constrained four-player hands', () => {
    const result = layout({ opponentCount: 3, handsRegionHeight: 309 });

    expect(result.mode).toBe('compact-overview');
    expect(result.opponentCardHeight).toBe(24);
  });

  test('stabilizes the same-shell ambient envelope while accepting a new shell', () => {
    const workbenchHeight = 156;
    const constrained = layout({
      handsRegionHeight: getC17HandsRegionHeight(481, workbenchHeight),
      workbenchHeight,
    });
    const expanded = layout({
      handsRegionHeight: getC17HandsRegionHeight(866, workbenchHeight),
      workbenchHeight,
    });

    expect(getC17AmbientEnvelope(
      { width: 300, height: 481 },
      { width: 300, height: 866 },
      true,
    )).toEqual({ width: 300, height: 866 });
    expect(getC17AmbientEnvelope(
      { width: 300, height: 866 },
      { width: 300, height: 481 },
      true,
    )).toEqual({ width: 300, height: 866 });
    expect(getC17AmbientEnvelope(
      { width: 300, height: 866 },
      { width: 300, height: 481 },
      false,
    )).toEqual({ width: 300, height: 481 });
    expect(hasC17AmbientRegionChanged(
      { width: 300, height: 866 },
      { width: 300, height: 481 },
    )).toBe(true);
    expect(constrained.mode).toBe('compact-overview');
    expect(expanded.mode).toBe('full-ledger');
    expect(expanded.opponentCardHeight).toBeGreaterThanOrEqual(76);
  });

  test('does not let the opponent lane shrink compact own cards', () => {
    const ordinaryCompact = layout({ opponentCardLaneWidth: 300, ownCardLaneWidth: 300, handsRegionHeight: 315 });
    const narrowOpponent = layout({ opponentCardLaneWidth: 140, ownCardLaneWidth: 300, handsRegionHeight: 315 });
    expect(ordinaryCompact.mode).toBe('compact-overview');
    expect(narrowOpponent.mode).toBe('compact-overview');
    expect(narrowOpponent.ownCardHeight).toBe(ordinaryCompact.ownCardHeight);
  });

  test('does not stretch ordinary roomy two-player and three-player hands into dead space', () => {
    const twoPlayer = layout({ opponentCount: 1, cardsPerHand: 5, handsRegionHeight: 500 });
    const twoPlayerTall = layout({ opponentCount: 1, cardsPerHand: 5, handsRegionHeight: 900 });
    const threePlayer = layout({ opponentCount: 2, cardsPerHand: 5, handsRegionHeight: 900 });
    expect(twoPlayer.mode).toBe('full-ledger');
    expect(threePlayer.mode).toBe('full-ledger');
    expect(twoPlayerTall.ownCardHeight).toBe(twoPlayer.ownCardHeight);
    expect(twoPlayerTall.handsHeight).toBe(twoPlayer.handsHeight);
  });

  test('keeps ordinary portrait five-card hands readable', () => {
    const cardLaneWidth = getC17CardLaneWidth(370);
    const result = layout({ opponentCardLaneWidth: cardLaneWidth, ownCardLaneWidth: cardLaneWidth, opponentCount: 1, cardsPerHand: 5, handsRegionHeight: 1000 });
    expect(result.mode).toBe('full-ledger');
    expect(result.ownCardHeight).toBeGreaterThanOrEqual(90);
  });

  test('selects a fixed Workbench height from the window class rather than tool content', () => {
    expect(getC17WorkbenchHeight(915)).toBe(176);
    expect(getC17WorkbenchHeight(640)).toBe(156);
    expect(getC17WorkbenchHeight(600)).toBe(140);
  });
});
