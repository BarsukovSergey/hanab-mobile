import { describe, expect, it } from '@jest/globals';

import { getDisplayedHandOrders } from './gamePresentation';

describe('getDisplayedHandOrders', () => {
  it('preserves the current reversed direction when reverseHands is false without mutating state', () => {
    const hand = [1, 2, 3, 4] as const;
    expect(getDisplayedHandOrders(hand, false)).toEqual([4, 3, 2, 1]);
    expect(hand).toEqual([1, 2, 3, 4]);
  });

  it('uses authoritative order when reverseHands is true without mutating state', () => {
    const hand = [1, 2, 3, 4] as const;
    expect(getDisplayedHandOrders(hand, true)).toEqual([1, 2, 3, 4]);
    expect(hand).toEqual([1, 2, 3, 4]);
  });

  it('handles missing hands', () => {
    expect(getDisplayedHandOrders(undefined, false)).toEqual([]);
  });
});
