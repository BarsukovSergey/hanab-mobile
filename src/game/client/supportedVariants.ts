import { getVariant, VARIANT_NAMES } from '../upstream/gameData';
import type { Variant } from '../upstream/interfaces/Variant';

export function isVariantSupported(variant: Variant): boolean {
  return !variant.throwItInAHole
    && !variant.upOrDown
    && !variant.sudoku
    && !variant.cowAndPig
    && !variant.duck
    && !variant.hasInverted
    && !variant.alternatingClues
    && !variant.suits.some((suit) => suit.reversed);
}

export const SUPPORTED_VARIANT_NAMES = VARIANT_NAMES.filter((name) => (
  isVariantSupported(getVariant(name))
));

const supportedVariantNames = new Set<string>(SUPPORTED_VARIANT_NAMES);

export function isVariantNameSupported(name: string): boolean {
  return supportedVariantNames.has(name);
}

export type CompatibilityOptions = {
  variantName: string;
  timed: boolean;
  speedrun: boolean;
  deckPlays: boolean;
  detrimentalCharacters: boolean;
};

export function areTableOptionsSupported(options: CompatibilityOptions): boolean {
  return isVariantNameSupported(options.variantName)
    && !options.speedrun
    && !options.deckPlays
    && !options.detrimentalCharacters;
}
