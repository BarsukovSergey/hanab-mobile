import { describe, expect, it } from '@jest/globals';

import { SUPPORTED_VARIANT_NAMES } from '../client/supportedVariants';
import { getVariant } from '../upstream/gameData';
import { isUpstreamPipRenderable } from './pipVectors';

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
});
