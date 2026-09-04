import { getVariant } from '../upstream/gameData';

export type CardSuitVisual = {
  name: string;
  fill: string;
  fillColors: readonly string[];
  colorblindFill: string;
  pip: string;
  duplicatePip: boolean;
};

const suitVisualCache = new Map<string, readonly CardSuitVisual[]>();

export function getCardSuitVisuals(variantName: string): readonly CardSuitVisual[] {
  const cached = suitVisualCache.get(variantName);
  if (cached !== undefined) return cached;

  const variant = getVariant(variantName);
  const visuals = variant.suits.map((suit, suitIndex) => {
    const fillColors = suit.fill === 'multi' && suit.fillColors.length > 0
      ? suit.fillColors
      : [suit.fill.length === 0 ? '#5d6570' : suit.fill];
    const pip = variant.pips[suitIndex] ?? suit.pip;
    return {
      name: suit.name,
      fill: fillColors[0] ?? '#5d6570',
      fillColors,
      colorblindFill: suit.fillColorblind,
      pip,
      duplicatePip: variant.pips.slice(0, suitIndex).some((previousPip) => previousPip === pip),
    };
  });
  suitVisualCache.set(variantName, visuals);
  return visuals;
}
