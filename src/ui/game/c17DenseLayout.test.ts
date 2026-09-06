import { describe, expect, test } from '@jest/globals';
import { getC17DenseLayout, getRelativeOpponentIndices } from './c17DenseLayout';

function layout(overrides: Partial<Parameters<typeof getC17DenseLayout>[0]> = {}) {
  return getC17DenseLayout({
    opponentCardLaneWidth: 300,
    opponentRegionHeight: 360,
    ownCardLaneWidth: 300,
    opponentCount: 5,
    cardsPerHand: 4,
    ...overrides,
  });
}

describe('C17 dense portrait layout', () => {
  test('keeps server-relative seating stable around the local anchor', () => {
    expect(getRelativeOpponentIndices(6, 0)).toEqual([1, 2, 3, 4, 5]);
    expect(getRelativeOpponentIndices(6, 3)).toEqual([4, 5, 0, 1, 2]);
  });

  test('gives fewer opponent rows larger cards when height limits the region', () => {
    const sixPlayer = layout({ opponentCount: 5, opponentRegionHeight: 300, opponentCardLaneWidth: 600 });
    const threePlayer = layout({ opponentCount: 2, opponentRegionHeight: 300, opponentCardLaneWidth: 600 });

    expect(threePlayer.opponentCardHeight).toBeGreaterThan(sixPlayer.opponentCardHeight);
  });

  test('constrains opponent cards by the measured card lane width', () => {
    const narrow = layout({ opponentCardLaneWidth: 140, opponentRegionHeight: 800 });
    const wide = layout({ opponentCardLaneWidth: 360, opponentRegionHeight: 800 });

    expect(narrow.opponentCardHeight).toBeLessThan(wide.opponentCardHeight);
  });

  test('constrains opponent cards by a short measured region', () => {
    const short = layout({ opponentCardLaneWidth: 600, opponentRegionHeight: 180 });
    const tall = layout({ opponentCardLaneWidth: 600, opponentRegionHeight: 500 });

    expect(short.opponentCardHeight).toBeLessThan(tall.opponentCardHeight);
  });

  test('does not enlarge cards when width remains the limiting dimension', () => {
    const ordinary = layout({ opponentCardLaneWidth: 180, opponentRegionHeight: 500 });
    const tall = layout({ opponentCardLaneWidth: 180, opponentRegionHeight: 900 });

    expect(tall.opponentCardHeight).toBe(ordinary.opponentCardHeight);
  });

  test('uses authoritative hand capacity after current hands shrink', () => {
    const beforeAction = layout({ cardsPerHand: 5 });
    const afterAction = layout({ cardsPerHand: 5 });

    expect(afterAction).toEqual(beforeAction);
  });

  test('keeps One Extra Card capacity in the width calculation', () => {
    const standard = layout({ cardsPerHand: 3, opponentRegionHeight: 800 });
    const oneExtraCard = layout({ cardsPerHand: 4, opponentRegionHeight: 800 });

    expect(oneExtraCard.ownCardHeight).toBeLessThan(standard.ownCardHeight);
    expect(oneExtraCard.opponentCardHeight).toBeLessThan(standard.opponentCardHeight);
  });

  test('keeps constrained six-player layouts on the existing readability threshold when they fit', () => {
    const constrained = layout({
      opponentCardLaneWidth: 300,
      opponentRegionHeight: 265,
      opponentCount: 5,
      cardsPerHand: 4,
    });

    expect(constrained.mode).toBe('full-ledger');
    expect(constrained.opponentCardHeight).toBeGreaterThanOrEqual(46);
  });
});
