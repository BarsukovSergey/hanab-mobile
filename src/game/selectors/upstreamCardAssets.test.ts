import { describe, expect, it } from '@jest/globals';

import {
  getUpstreamCardKey,
  getUpstreamCardSvg,
  resolveUpstreamCardPresentationMode,
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

  it('resolves presentation preferences with colorblind precedence', () => {
    expect(resolveUpstreamCardPresentationMode({ colorblindMode: false, styleNumbers: false })).toBe('default');
    expect(resolveUpstreamCardPresentationMode({ colorblindMode: false, styleNumbers: true })).toBe('styled');
    expect(resolveUpstreamCardPresentationMode({ colorblindMode: true, styleNumbers: false })).toBe('colorblind');
    expect(resolveUpstreamCardPresentationMode({ colorblindMode: true, styleNumbers: true })).toBe('colorblind');
  });

  it('resolves the same card in every canonical presentation mode', () => {
    const defaults = getUpstreamCardSvg('No Variant', 'card-Red-1');
    const colorblind = getUpstreamCardSvg('No Variant', 'card-Red-1', 'colorblind');
    const styled = getUpstreamCardSvg('No Variant', 'card-Red-1', 'styled');
    expect(defaults).toContain('<svg');
    expect(colorblind).toContain('<svg');
    expect(styled).toContain('<svg');
    expect(new Set([defaults, colorblind, styled]).size).toBeGreaterThan(1);
  });

  it('includes every canonical mode in the generated manifest', () => {
    const generatedManifest = require('../../../assets/cards/upstream/manifest.json') as {
      modes: Record<string, Record<string, readonly (readonly [number, number])[]>>;
    };
    expect(Object.keys(generatedManifest.modes).sort()).toEqual(['colorblind', 'default', 'styled']);
  });

  it('fails closed for unknown keys in an explicitly selected mode', () => {
    expect(getUpstreamCardSvg('No Variant', 'not-a-card', 'styled')).toBeNull();
  });
});
