import { describe, expect, test } from '@jest/globals';
import {
  getC17CardLaneWidth,
  getPortraitResourceRailFit,
  getC17DenseLayout,
  getC17AmbientEnvelope,
  getC17HandsRegionHeight,
  getC17WorkbenchHeight,
  C17_SIDE_LABEL_LANE_WIDTH,
  C17_SIDE_LABEL_ROW_GAP,
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
    const result = layout({ opponentCount: 2, opponentCardLaneWidth: 600, ownCardLaneWidth: 300, handsRegionHeight: 700 });
    expect(result.mode).toBe('full-ledger');
    expect(result.opponentCardHeight).toBeGreaterThanOrEqual(76);
    expect(result.ownCardHeight).toBe(result.opponentCardHeight);
    expect(result.opponentRowHeight).toBe(result.opponentCardHeight + result.cardTopHeadroom + 6);
    expect(result.handsHeight).toBeLessThanOrEqual(700);
  });

  test('keeps Full Ledger width limiting and clued-card headroom', () => {
    const narrow = layout({ opponentCount: 2, opponentCardLaneWidth: 360, ownCardLaneWidth: 600, handsRegionHeight: 1400 });
    const wide = layout({ opponentCount: 2, opponentCardLaneWidth: 600, ownCardLaneWidth: 600, handsRegionHeight: 1400 });
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
    expect(result.ownRowHeight).toBe(result.ownCardHeight + result.cardTopHeadroom + 6);
    expect(result.handsHeight).toBeLessThanOrEqual(315);
  });

  test('keeps constrained three-player hands in the Full Ledger below the former readability floor', () => {
    const result = layout({ opponentCount: 2, handsRegionHeight: 214 });

    expect(result.mode).toBe('full-ledger');
    expect(result.opponentCardHeight).toBeLessThan(76);
    expect(result.ownCardHeight).toBe(result.opponentCardHeight);
    expect(result.handsHeight).toBeLessThanOrEqual(214);
  });

  test('returns the removed metadata row height to ordinary two-player and three-player card faces', () => {
    const ordinary = layout({ opponentCount: 2, handsRegionHeight: 214 });

    expect(ordinary.opponentRowHeight).toBe(ordinary.opponentCardHeight + ordinary.cardTopHeadroom + 6);
    expect(ordinary.ownRowHeight).toBe(ordinary.ownCardHeight + ordinary.cardTopHeadroom + 6);
    expect(ordinary.handsHeight).toBeLessThanOrEqual(214);
  });

  test('uses adaptive real opponent cards for ordinary four-, five-, and six-player hands', () => {
    const layouts = [];
    for (const opponentCount of [3, 4, 5]) {
      const result = layout({ opponentCount, handsRegionHeight: 500, opponentCardLaneWidth: 600, ownCardLaneWidth: 300 });
      layouts.push(result);
      expect(result.mode).toBe('full-ledger');
      expect(result.opponentCardHeight).toBeGreaterThanOrEqual(46);
      expect(result.ownCardHeight).toBeGreaterThanOrEqual(result.opponentCardHeight);
      expect(result.handsHeight).toBeLessThanOrEqual(500);
    }
    expect(layouts.some(({ ownCardHeight, opponentCardHeight }) => ownCardHeight !== opponentCardHeight)).toBe(true);
  });

  test('keeps six-player One Extra Card capacity width-safe', () => {
    const result = layout({ opponentCount: 5, cardsPerHand: 4, opponentCardLaneWidth: 600, ownCardLaneWidth: 300, handsRegionHeight: 500 });
    const widthSafeOpponentHeight = Math.floor((600 - 3 * 3) / 4 / (300 / 420));
    expect(result.mode).toBe('full-ledger');
    expect(result.opponentCardHeight).toBeLessThanOrEqual(widthSafeOpponentHeight);
    expect(result.opponentCardHeight).toBeLessThanOrEqual(result.ownCardHeight);
  });

  test('uses authoritative dense hand capacity for a general width stress case', () => {
    const ordinary = layout({ opponentCount: 5, cardsPerHand: 4, opponentCardLaneWidth: 600, ownCardLaneWidth: 300, handsRegionHeight: 500 });
    const oneExtraCard = layout({ opponentCount: 5, cardsPerHand: 5, opponentCardLaneWidth: 600, ownCardLaneWidth: 300, handsRegionHeight: 500 });
    expect(ordinary.mode).toBe('full-ledger');
    expect(oneExtraCard.mode).toBe('full-ledger');
    expect(oneExtraCard.opponentCardHeight).toBeLessThanOrEqual(ordinary.opponentCardHeight);
  });

  test('uses shared headroom for unequal dense card heights and vertical capacity', () => {
    const handsRegionHeight = 500;
    const opponentCount = 5;
    const result = layout({ opponentCount, handsRegionHeight, opponentCardLaneWidth: 600, ownCardLaneWidth: 300 });

    expect(result.mode).toBe('full-ledger');
    expect(result.ownCardHeight).not.toBe(result.opponentCardHeight);
    expect(result.opponentRowHeight).toBe(result.opponentCardHeight + result.cardTopHeadroom + 6);
    expect(result.handsHeight).toBe(
      result.ownRowHeight + opponentCount * result.opponentRowHeight + (opponentCount - 1) * 2 + 5,
    );
    expect(result.handsHeight).toBeLessThanOrEqual(handsRegionHeight);
  });

  test('falls back when dense opponent cards cannot reach the readable floor', () => {
    const result = layout({ opponentCount: 3, handsRegionHeight: 170 });

    expect(result.mode).toBe('compact-overview');
    expect(result.opponentCardHeight).toBe(24);
    expect(result.ownCardHeight).toBeGreaterThanOrEqual(46);
    expect(result.handsHeight).toBeLessThanOrEqual(170);
  });

  test('stabilizes the same-shell ambient envelope while accepting a new shell', () => {
    const workbenchHeight = 156;
    const constrained = layout({
      handsRegionHeight: getC17HandsRegionHeight(481, workbenchHeight),
      workbenchHeight,
    });
    const expanded = layout({
      handsRegionHeight: getC17HandsRegionHeight(866, workbenchHeight),
      opponentCount: 2,
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

  test('reserves 136dp for two-player and three-player Workbenches', () => {
    expect(getC17WorkbenchHeight(915, 1)).toBe(136);
    expect(getC17WorkbenchHeight(600, 2)).toBe(136);
  });

  test('reserves the minimum actionable Workbench for dense four-, five-, and six-player games', () => {
    expect(getC17WorkbenchHeight(915, 3)).toBe(56);
    expect(getC17WorkbenchHeight(640, 4)).toBe(56);
    expect(getC17WorkbenchHeight(600, 5)).toBe(56);
    expect(getC17WorkbenchHeight(915)).toBe(176);
    expect(getC17WorkbenchHeight(640)).toBe(156);
    expect(getC17WorkbenchHeight(600)).toBe(140);
  });

  test('dense shell space restores ordinary six-player real cards on a tight portrait body', () => {
    const workbenchHeight = getC17WorkbenchHeight(600, 5);
    const cardLaneWidth = getC17CardLaneWidth(360, C17_SIDE_LABEL_LANE_WIDTH + C17_SIDE_LABEL_ROW_GAP);
    const beforeChrome = layout({
      opponentCount: 5,
      cardsPerHand: 4,
      opponentCardLaneWidth: cardLaneWidth,
      ownCardLaneWidth: cardLaneWidth,
      handsRegionHeight: getC17HandsRegionHeight(380, workbenchHeight),
      workbenchHeight,
    });
    const handsRegionHeight = getC17HandsRegionHeight(420, workbenchHeight);
    const result = layout({
      opponentCount: 5,
      cardsPerHand: 4,
      opponentCardLaneWidth: cardLaneWidth,
      ownCardLaneWidth: cardLaneWidth,
      handsRegionHeight,
      workbenchHeight,
    });

    expect(workbenchHeight).toBe(56);
    expect(beforeChrome.mode).toBe('compact-overview');
    expect(result.mode).toBe('full-ledger');
    expect(result.opponentCardHeight).toBeGreaterThanOrEqual(46);
    expect(result.ownCardHeight).toBeGreaterThanOrEqual(result.opponentCardHeight);
    expect(result.handsHeight).toBeLessThanOrEqual(handsRegionHeight);
  });
});


describe('Slice 8a portrait geometry', () => {
  test.each([[780, 176], [640, 156], [639, 140]])('2P/3P height %i reserves %i without tool input', (height, expected) => {
    expect(getC17WorkbenchHeight(height, 1, true)).toBe(expected);
    expect(getC17WorkbenchHeight(height, 2, true)).toBe(expected);
  });
  test.each([3, 4, 5])('dense %i opponents reserve 56dp', (opponents) => {
    expect(getC17WorkbenchHeight(900, opponents, true)).toBe(56);
  });
  test.each([1, 2, 3, 4])('%i opponents always retain real cards with no opponent scroll', (opponentCount) => {
    const result = layout({ portraitV2: true, opponentCount, handsRegionHeight: 290 });
    expect(result.mode).toBe('full-ledger');
    expect(result.opponentsScrollable).toBe(false);
    expect(result.handsHeight).toBeLessThanOrEqual(290);
    expect(result.opponentCardHeight).toBeGreaterThan(1);
  });
  test('6P fits normally before using only an opponent viewport', () => {
    const roomy = layout({ portraitV2: true, handsRegionHeight: 400 });
    expect(roomy.opponentsScrollable).toBe(false);
    expect(roomy.opponentCardHeight).toBeGreaterThanOrEqual(46);
    for (const [height, rows] of [[290, 4], [240, 3], [160, 3]]) {
      const result = layout({ portraitV2: true, handsRegionHeight: height });
      expect(result.mode).toBe('full-ledger');
      expect(result.opponentsScrollable).toBe(true);
      expect(result.opponentViewportHeight).toBeGreaterThanOrEqual(rows! * result.opponentRowHeight + (rows! - 1) * 2);
      expect(result.handsHeight).toBeLessThanOrEqual(height!);
      if (height! < 200) expect(result.opponentCardHeight).toBeLessThan(46);
      else expect(result.opponentCardHeight).toBe(46);
    }
  });
  test('rail fit uses the exact suit/deck/resource/font threshold', () => {
    expect(getPortraitResourceRailFit(283, 5, 1)).toBe(false);
    expect(getPortraitResourceRailFit(284, 5, 1)).toBe(true);
    expect(getPortraitResourceRailFit(315, 5, 2)).toBe(false);
    expect(getPortraitResourceRailFit(316, 5, 2)).toBe(true);
    expect(getPortraitResourceRailFit(314, 6, 1)).toBe(true);
  });
});
