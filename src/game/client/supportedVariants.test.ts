import { describe, expect, test } from '@jest/globals';

import { getVariant, VARIANT_NAMES } from '../upstream/gameData';
import {
  isVariantNameSupported,
  isVariantSupported,
  SUPPORTED_VARIANT_NAMES,
} from './supportedVariants';

describe('mobile variant capabilities', () => {
  test('filters vendored VARIANT_NAMES with one capability predicate', () => {
    expect(SUPPORTED_VARIANT_NAMES).toEqual(
      VARIANT_NAMES.filter((name) => isVariantSupported(getVariant(name))),
    );
    expect(SUPPORTED_VARIANT_NAMES).toEqual(expect.arrayContaining([
      'No Variant', '6 Suits', 'Black (6 Suits)', 'Rainbow (6 Suits)',
    ]));
    expect(SUPPORTED_VARIANT_NAMES.length).toBeGreaterThan(4);
  });

  test('excludes every unsupported rule and suit capability', () => {
    for (const name of SUPPORTED_VARIANT_NAMES) {
      const variant = getVariant(name);
      expect({
        throwItInAHole: variant.throwItInAHole,
        upOrDown: variant.upOrDown,
        sudoku: variant.sudoku,
        cowAndPig: variant.cowAndPig,
        duck: variant.duck,
        inverted: variant.hasInverted,
        reversed: variant.suits.some((suit) => suit.reversed),
      }).toEqual({
        throwItInAHole: false, upOrDown: false, sudoku: false,
        cowAndPig: false, duck: false, inverted: false, reversed: false,
      });
      expect(isVariantNameSupported(name)).toBe(true);
    }
  });
});
