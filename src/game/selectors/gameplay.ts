import { getVariant } from '../upstream/gameData';
import { ClueType } from '../upstream/enums/ClueType';
import type { GameState } from '../upstream/interfaces/GameState';
import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import { getCharacterNameForPlayer } from '../upstream/reducers/reducerHelpers';
import { getClueName } from '../upstream/rules/clues';
import {
  getAdjustedClueTokens,
  getUnadjustedClueTokens,
} from '../upstream/rules/clueTokens';

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

export function getGameplayClueChoices(
  variantName: string,
  characterName = '',
): GameplayClueChoices {
  const variant = getVariant(variantName);
  return {
    colors: variant.clueColors.map((_color, value) => ({
      value,
      label: getClueName(ClueType.Color, value, variant, characterName),
    })),
    ranks: variant.clueRanks.map((value) => ({
      value,
      label: getClueName(ClueType.Rank, value, variant, characterName),
    })),
  };
}

export function getGameplayClueChoicesForPlayer(
  metadata: Pick<GameMetadata, 'options' | 'ourPlayerIndex' | 'characterAssignments'>,
): GameplayClueChoices {
  return getGameplayClueChoices(
    metadata.options.variantName,
    getCharacterNameForPlayer(metadata.ourPlayerIndex, metadata.characterAssignments),
  );
}

export function hasClueTokenForVariant(clueTokens: number, variantName: string): boolean {
  return clueTokens >= getAdjustedClueTokens(1, getVariant(variantName));
}

export function getDisplayedClueTokens(clueTokens: number, variantName: string): number {
  return getUnadjustedClueTokens(clueTokens, getVariant(variantName));
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
