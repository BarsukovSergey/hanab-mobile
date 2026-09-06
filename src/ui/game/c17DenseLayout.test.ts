import { describe, expect, test } from '@jest/globals';
import { getC17DenseLayout, getRelativeOpponentIndices } from './c17DenseLayout';

function layout(overrides: Partial<Parameters<typeof getC17DenseLayout>[0]> = {}) {
  return getC17DenseLayout({
    opponentCardLaneWidth: 300,
    handsRegionHeight: 500,
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

  test('uses one shared card height for opponents and YOUR HAND', () => {
    const result = layout({ opponentCardLaneWidth: 600, ownCardLaneWidth: 300, handsRegionHeight: 400 });

    expect(result.ownCardHeight).toBe(result.opponentCardHeight);
  });

  test('gives fewer opponent rows larger cards when height limits the hands region', () => {
    const sixPlayer = layout({ opponentCount: 5, handsRegionHeight: 400, opponentCardLaneWidth: 600, ownCardLaneWidth: 600 });
    const threePlayer = layout({ opponentCount: 2, handsRegionHeight: 400, opponentCardLaneWidth: 600, ownCardLaneWidth: 600 });

    expect(threePlayer.opponentCardHeight).toBeGreaterThan(sixPlayer.opponentCardHeight);
  });

  test('constrains the shared size by the opponent card lane', () => {
    const narrowOpponent = layout({ opponentCardLaneWidth: 140, ownCardLaneWidth: 600, handsRegionHeight: 900 });
    const wideOpponent = layout({ opponentCardLaneWidth: 360, ownCardLaneWidth: 600, handsRegionHeight: 900 });

    expect(narrowOpponent.opponentCardHeight).toBeLessThan(wideOpponent.opponentCardHeight);
    expect(narrowOpponent.ownCardHeight).toBe(narrowOpponent.opponentCardHeight);
  });

  test('constrains the shared size by the own card lane', () => {
    const narrowOwn = layout({ opponentCardLaneWidth: 600, ownCardLaneWidth: 140, handsRegionHeight: 900 });
    const wideOwn = layout({ opponentCardLaneWidth: 600, ownCardLaneWidth: 360, handsRegionHeight: 900 });

    expect(narrowOwn.ownCardHeight).toBeLessThan(wideOwn.ownCardHeight);
    expect(narrowOwn.ownCardHeight).toBe(narrowOwn.opponentCardHeight);
  });

  test('does not enlarge cards when width remains the limiting dimension', () => {
    const ordinary = layout({ opponentCardLaneWidth: 180, ownCardLaneWidth: 180, handsRegionHeight: 500 });
    const tall = layout({ opponentCardLaneWidth: 180, ownCardLaneWidth: 180, handsRegionHeight: 900 });

    expect(tall.opponentCardHeight).toBe(ordinary.opponentCardHeight);
  });

  test('uses authoritative hand capacity after current hands shrink', () => {
    const beforeAction = layout({ cardsPerHand: 5 });
    const afterAction = layout({ cardsPerHand: 5 });

    expect(afterAction).toEqual(beforeAction);
  });

  test('keeps One Extra Card capacity in the shared width calculation', () => {
    const standard = layout({ cardsPerHand: 3, handsRegionHeight: 900 });
    const oneExtraCard = layout({ cardsPerHand: 4, handsRegionHeight: 900 });

    expect(oneExtraCard.opponentCardHeight).toBeLessThan(standard.opponentCardHeight);
    expect(oneExtraCard.ownCardHeight).toBeLessThan(standard.ownCardHeight);
  });

  test('keeps constrained six-player layouts on the existing readability threshold when they fit', () => {
    const constrained = layout({
      opponentCardLaneWidth: 300,
      ownCardLaneWidth: 300,
      handsRegionHeight: 315,
      opponentCount: 5,
      cardsPerHand: 4,
    });

    expect(constrained.mode).toBe('full-ledger');
    expect(constrained.opponentCardHeight).toBeGreaterThanOrEqual(46);
  });

  test('keeps shared cards and real row chrome inside the measured hands region', () => {
    const result = layout({ handsRegionHeight: 360 });

    expect(result.handsHeight).toBeLessThanOrEqual(360);
  });
});
