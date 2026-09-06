import { describe, expect, test } from '@jest/globals';
import { getC17DenseLayout, getRelativeOpponentIndices } from './c17DenseLayout';

describe('C17-0 dense portrait layout', () => {
  test('keeps server-relative seating stable around the local anchor', () => {
    expect(getRelativeOpponentIndices(6, 0)).toEqual([1, 2, 3, 4, 5]);
    expect(getRelativeOpponentIndices(6, 3)).toEqual([4, 5, 0, 1, 2]);
  });

  test('uses compact overview on the physically validated ordinary phone portrait class', () => {
    const layout = getC17DenseLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      opponentHandSizes: [4, 4, 4, 4, 4],
      ownHandSize: 4,
    });

    expect(layout.mode).toBe('compact-overview');
    expect(layout.opponentCardHeight).toBe(34);
    expect(layout.workbenchHeight).toBeGreaterThan(0);
  });

  test('reserves full ledger for genuinely tall six-player portrait windows', () => {
    const layout = getC17DenseLayout({
      viewportWidth: 390,
      viewportHeight: 932,
      opponentHandSizes: [4, 4, 4, 4, 4],
      ownHandSize: 4,
    });

    expect(layout.mode).toBe('full-ledger');
    expect(layout.opponentCardHeight).toBeGreaterThanOrEqual(46);
  });

  test('uses the smallest compact overview rather than unreadably shrinking narrow short windows', () => {
    const layout = getC17DenseLayout({
      viewportWidth: 320,
      viewportHeight: 568,
      opponentHandSizes: [4, 4, 4, 4, 4],
      ownHandSize: 4,
    });

    expect(layout.mode).toBe('compact-overview');
    expect(layout.opponentCardHeight).toBe(24);
  });
});
