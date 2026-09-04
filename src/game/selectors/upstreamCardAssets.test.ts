import { describe, expect, it } from '@jest/globals';

import {
  getUpstreamCardKey,
  getUpstreamCardSvg,
  UPSTREAM_CARD_ASSET_COMMIT,
} from './upstreamCardAssets';

describe('upstream card assets', () => {
  it('is tied to the merged upstream renderer commit', () => {
    expect(UPSTREAM_CARD_ASSET_COMMIT).toBe('e78e82bce2ff5d54b9d2ec359530955fd354e9b7');
  });

  it('resolves canonical visible and partial card states', () => {
    const keys = [
      getUpstreamCardKey('Red', 1),
      getUpstreamCardKey(null, 1),
      getUpstreamCardKey('Red', null),
      getUpstreamCardKey(null, null),
      getUpstreamCardKey('Red', 0),
    ];

    for (const key of keys) {
      const svg = getUpstreamCardSvg('No Variant', key);
      expect(svg).not.toBeNull();
      expect(svg).toContain('<svg');
    }
  });

  it('resolves a custom-suit card from a supported variant', () => {
    const svg = getUpstreamCardSvg('Rainbow (6 Suits)', 'card-Rainbow-5');
    expect(svg).not.toBeNull();
    expect(svg).toContain('<svg');
  });

  it('fails closed for unknown variants and card keys', () => {
    expect(getUpstreamCardSvg('Definitely Not A Variant', 'card-Red-1')).toBeNull();
    expect(getUpstreamCardSvg('No Variant', 'not-a-card')).toBeNull();
  });
});
