import { getDisplayedHandOrders } from './gamePresentation';

describe('getDisplayedHandOrders', () => {
  it('matches the desktop left-to-right hand order without mutating authoritative state', () => {
    const hand = [1, 2, 3, 4] as const;
    expect(getDisplayedHandOrders(hand)).toEqual([4, 3, 2, 1]);
    expect(hand).toEqual([1, 2, 3, 4]);
  });

  it('handles missing hands', () => {
    expect(getDisplayedHandOrders(undefined)).toEqual([]);
  });
});
