import { describe, expect, it } from '@jest/globals';

import { SUPPORTED_VARIANT_NAMES } from '../client/supportedVariants';
import { getVariant } from '../upstream/gameData';
import {
  getRecordedPipVector,
  isUpstreamPipRenderable,
  isVanillaUpstreamPip,
} from './pipVectors';

describe('supported variant pip rendering', () => {
  it('has a canonical vector renderer for every reachable pip', () => {
    const missing = SUPPORTED_VARIANT_NAMES.flatMap((variantName) => {
      const variant = getVariant(variantName);
      return variant.pips.flatMap((pip, suitIndex) => (
        isUpstreamPipRenderable(pip)
          ? []
          : [`${variantName}: suit ${suitIndex} -> ${pip}`]
      ));
    });

    expect(missing).toEqual([]);
  });

  it('records finite non-empty SVG paths for every reachable custom pip', () => {
    const failures: string[] = [];
    for (const variantName of SUPPORTED_VARIANT_NAMES) {
      const variant = getVariant(variantName);
      variant.pips.forEach((pip, suitIndex) => {
        if (isVanillaUpstreamPip(pip)) return;
        const suit = variant.suits[suitIndex];
        if (suit === undefined) {
          failures.push(`${variantName}: missing suit ${suitIndex}`);
          return;
        }
        const fillColors = suit.fill === 'multi' ? suit.fillColors : [suit.fill];
        const vector = getRecordedPipVector(pip, fillColors, suit.name);
        if (vector === null || vector.shapes.length === 0) {
          failures.push(`${variantName}: ${pip} has no vector shapes`);
          return;
        }
        for (const shape of vector.shapes) {
          if (shape.d.length === 0 || /(?:NaN|Infinity)/.test(shape.d)) {
            failures.push(`${variantName}: ${pip} produced invalid path data`);
            break;
          }
        }
      });
    }

    expect(failures).toEqual([]);
  });
});
