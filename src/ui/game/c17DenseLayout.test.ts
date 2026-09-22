import { describe, expect, test } from '@jest/globals';
import { getC17DenseLayout, getRelativeOpponentIndices } from './c17DenseLayout';

describe('C17-0 dense portrait layout', () => {
  test('keeps server-relative seating stable around the local anchor', () => {
    expect(getRelativeOpponentIndices(6, 0)).toEqual([1, 2, 3, 4, 5]);
    expect(getRelativeOpponentIndices(6, 3)).toEqual([4, 5, 0, 1, 2]);
  });

  test('uses the available height instead of a fixed 34 dp compact card size', () => {
    const layout = getC17DenseLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      opponentHandSizes: [4, 4, 4, 4, 4],
      ownHandSize: 4,
    });

    expect(layout.opponentCardHeight).toBeGreaterThan(34);
    expect(layout.opponentCardHeight).toBeLessThanOrEqual(76);
    expect(layout.workbenchHeight).toBe(56);
  });

  test('larger windows give opponent hands more room without changing the minimum workbench band', () => {
    const ordinary = getC17DenseLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      opponentHandSizes: [4, 4, 4, 4, 4],
      ownHandSize: 4,
    });
    const tall = getC17DenseLayout({
      viewportWidth: 390,
      viewportHeight: 932,
      opponentHandSizes: [4, 4, 4, 4, 4],
      ownHandSize: 4,
    });

    expect(tall.opponentCardHeight).toBeGreaterThan(ordinary.opponentCardHeight);
    expect(tall.workbenchHeight).toBe(ordinary.workbenchHeight);
  });

  test('falls back to compact overview only when the computed cards fall below the readability floor', () => {
    const small = getC17DenseLayout({
      viewportWidth: 320,
      viewportHeight: 568,
      opponentHandSizes: [4, 4, 4, 4, 4],
      ownHandSize: 4,
    });
    const ordinary = getC17DenseLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      opponentHandSizes: [4, 4, 4, 4, 4],
      ownHandSize: 4,
    });

    expect(small.mode).toBe('compact-overview');
    expect(small.opponentCardHeight).toBeLessThan(46);
    expect(ordinary.mode).toBe('full-ledger');
  });
});
