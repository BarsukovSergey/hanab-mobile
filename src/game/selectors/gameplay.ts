import { getVariant } from '../upstream/gameData';

export type GameplayClueChoice = {
  value: number;
  label: string;
};

export type GameplayClueChoices = {
  colors: readonly GameplayClueChoice[];
  ranks: readonly GameplayClueChoice[];
};

export function getGameplayClueChoices(variantName: string): GameplayClueChoices {
  const variant = getVariant(variantName);
  return {
    colors: variant.clueColors.map((color, value) => ({ value, label: color.name })),
    ranks: variant.clueRanks.map((value) => ({ value, label: String(value) })),
  };
}

export function isCurrentVariantColorClueValue(
  variantName: string,
  value: number,
): boolean {
  const variant = getVariant(variantName);
  return Number.isInteger(value) && value >= 0 && value < variant.clueColors.length;
}

export function isCurrentVariantRankClueValue(
  variantName: string,
  value: number,
): boolean {
  return getVariant(variantName).clueRanks.some((rank) => rank === value);
}

export function getVisibleCardIdentityLabel(
  variantName: string,
  suitIndex: number | null,
  rank: number | null,
): string {
  if (suitIndex === null || rank === null) return 'hidden';
  const suit = getVariant(variantName).suits[suitIndex];
  return suit === undefined ? 'unknown' : `${suit.name} ${rank}`;
}
