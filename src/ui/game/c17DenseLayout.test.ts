import { describe, expect, test } from '@jest/globals';
import { getC17DenseLayout, getRelativeOpponentIndices } from './c17DenseLayout';

describe('C17-0 dense portrait layout', () => {
  test('keeps server-relative seating stable around the local anchor', () => {
    expect(getRelativeOpponentIndices(6, 0)).toEqual([1, 2, 3, 4, 5]);
    expect(getRelativeOpponentIndices(6, 3)).toEqual([4, 5, 0, 1, 2]);
  });

  test('uses the available height instead of a fixed 34 dp compact card size', () => {
    const layout = getC17DenseLayout({
      workspaceWidth: 370,
      workspaceHeight: 710,
      opponentCount: 5,
      cardsPerHand: 4,
    });

    expect(layout.opponentCardHeight).toBeGreaterThan(34);
    expect(layout.opponentCardHeight).toBeLessThanOrEqual(76);
    expect(layout.workbenchHeight).toBe(56);
  });

  test('larger windows give opponent hands more room without changing the minimum workbench band', () => {
    const ordinary = getC17DenseLayout({
      workspaceWidth: 370,
      workspaceHeight: 710,
      opponentCount: 5,
      cardsPerHand: 4,
    });
    const tall = getC17DenseLayout({
      workspaceWidth: 370,
      workspaceHeight: 798,
      opponentCount: 5,
      cardsPerHand: 4,
    });

    expect(tall.opponentCardHeight).toBeGreaterThan(ordinary.opponentCardHeight);
    expect(tall.workbenchHeight).toBe(ordinary.workbenchHeight);
  });

  test('falls back to compact overview only when the computed cards fall below the readability floor', () => {
    const small = getC17DenseLayout({
      workspaceWidth: 300,
      workspaceHeight: 434,
      opponentCount: 5,
      cardsPerHand: 4,
    });
    const ordinary = getC17DenseLayout({
      workspaceWidth: 370,
      workspaceHeight: 710,
      opponentCount: 5,
      cardsPerHand: 4,
    });

    expect(small.mode).toBe('compact-overview');
    expect(small.opponentCardHeight).toBeLessThan(46);
    expect(ordinary.mode).toBe('full-ledger');
  });

  test('uses authoritative hand capacity after current hands shrink', () => {
    const beforeAction = getC17DenseLayout({
      workspaceWidth: 370,
      workspaceHeight: 710,
      opponentCount: 5,
      cardsPerHand: 5,
    });
    const afterAction = getC17DenseLayout({
      workspaceWidth: 370,
      workspaceHeight: 710,
      opponentCount: 5,
      cardsPerHand: 5,
    });

    expect(afterAction).toEqual(beforeAction);
  });

  test('keeps One Extra Card capacity in the width calculation', () => {
    const standard = getC17DenseLayout({
      workspaceWidth: 280,
      workspaceHeight: 710,
      opponentCount: 5,
      cardsPerHand: 3,
    });
    const oneExtraCard = getC17DenseLayout({
      workspaceWidth: 280,
      workspaceHeight: 710,
      opponentCount: 5,
      cardsPerHand: 4,
    });

    expect(oneExtraCard.ownCardHeight).toBeLessThan(standard.ownCardHeight);
  });

  test('reserves the player-name lane when fitting cards', () => {
    const layout = getC17DenseLayout({
      workspaceWidth: 320,
      workspaceHeight: 900,
      opponentCount: 5,
      cardsPerHand: 5,
    });

    expect(layout.opponentCardHeight).toBeLessThan(layout.ownCardHeight);
  });
});
