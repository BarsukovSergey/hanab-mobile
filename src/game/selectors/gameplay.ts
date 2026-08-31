import { getVariant } from '../upstream/gameData';
import type { GameState } from '../upstream/interfaces/GameState';

export type GameplayClueChoice = {
  value: number;
  label: string;
};

export type GameplayClueChoices = {
  colors: readonly GameplayClueChoice[];
  ranks: readonly GameplayClueChoice[];
};

export type GameTableSuit = {
  suitIndex: number;
  suitName: string;
  topCardLabel: string | null;
  discardCardLabels: readonly string[];
};

type AuthoritativeTableState = Pick<GameState, 'playStacks' | 'discardStacks' | 'deck'>;

export function getGameplayClueChoices(variantName: string): GameplayClueChoices {
  const variant = getVariant(variantName);
  return {
    colors: variant.clueColors.map((color, value) => ({ value, label: color.name })),
    ranks: variant.clueRanks.map((value) => ({ value, label: String(value) })),
  };
}

export function getGameTableSuits(
  variantName: string,
  game: AuthoritativeTableState,
): readonly GameTableSuit[] {
  return getVariant(variantName).suits.map((suit, suitIndex) => {
    const playStack = game.playStacks[suitIndex] ?? [];
    const topCardOrder = playStack[playStack.length - 1];
    const topCard = topCardOrder === undefined ? undefined : game.deck[topCardOrder];
    const discardStack = game.discardStacks[suitIndex] ?? [];

    return {
      suitIndex,
      suitName: suit.name,
      topCardLabel: topCard === undefined
        ? null
        : getVisibleCardIdentityLabel(variantName, topCard.suitIndex, topCard.rank),
      discardCardLabels: discardStack.map((order) => {
        const card = game.deck[order];
        return card === undefined
          ? 'unknown'
          : getVisibleCardIdentityLabel(variantName, card.suitIndex, card.rank);
      }),
    };
  });
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
