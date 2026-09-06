import { getCharacter, getVariant } from '../upstream/gameData';
import { ClueType } from '../upstream/enums/ClueType';
import type { GameState } from '../upstream/interfaces/GameState';
import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import { getCharacterNameForPlayer } from '../upstream/reducers/reducerHelpers';
import { getClueName } from '../upstream/rules/clues';
import {
  getAdjustedClueTokens,
  getUnadjustedClueTokens,
} from '../upstream/rules/clueTokens';
import { getCardsPerHand } from '../upstream/rules/hand';
import { getEfficiency } from '../upstream/rules/stats';
import { millisecondsToClockString } from '../upstream/rules/text';

export type LiveClock = {
  readonly times: readonly number[];
  readonly activePlayerIndex: number;
  readonly timeTaken: number;
  readonly receivedAtMs: number;
};

export function getDisplayedClockTime(
  clock: LiveClock,
  playerIndex: number,
  paused: boolean,
  nowMs: number,
): number | null {
  const serverTime = clock.times[playerIndex];
  if (serverTime === undefined) return null;
  if (paused || playerIndex !== clock.activePlayerIndex) return serverTime;
  return Math.max(0, serverTime - Math.max(0, nowMs - clock.receivedAtMs));
}

export function getDisplayedClockString(
  clock: LiveClock,
  playerIndex: number,
  paused: boolean,
  nowMs: number,
): string | null {
  const time = getDisplayedClockTime(clock, playerIndex, paused, nowMs);
  return time === null ? null : millisecondsToClockString(time);
}

export type GameplayClueChoice = {
  value: number;
  label: string;
};

export type GameplayClueChoices = {
  colors: readonly GameplayClueChoice[];
  ranks: readonly GameplayClueChoice[];
  allowEmptyClues: boolean;
};

export type GameTableSuit = {
  suitIndex: number;
  suitName: string;
  topCardLabel: string | null;
  discardCardLabels: readonly string[];
};

type AuthoritativeTableState = Pick<GameState, 'playStacks' | 'discardStacks' | 'deck'>;
type ClueMetadata = Pick<GameMetadata, 'options' | 'ourPlayerIndex' | 'characterAssignments'>;
type OptionsMetadata = Pick<GameMetadata, 'options'>;

const clueChoiceCache = new Map<string, GameplayClueChoices>();

export function getGameplayCardsPerHand(metadata: OptionsMetadata): number {
  return getCardsPerHand(metadata.options);
}

export function getGameplayClueChoices(
  variantName: string,
  characterName = '',
  allowEmptyClues = false,
): GameplayClueChoices {
  const cacheKey = `${variantName}\u0000${characterName}\u0000${allowEmptyClues ? '1' : '0'}`;
  const cached = clueChoiceCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const variant = getVariant(variantName);
  const choices = {
    colors: variant.clueColors.map((_color, value) => ({
      value,
      label: getClueName(ClueType.Color, value, variant, characterName),
    })),
    ranks: variant.clueRanks.map((value) => ({
      value,
      label: getClueName(ClueType.Rank, value, variant, characterName),
    })),
    allowEmptyClues,
  } satisfies GameplayClueChoices;
  clueChoiceCache.set(cacheKey, choices);
  return choices;
}

export function getGameplayClueChoicesForPlayer(metadata: ClueMetadata): GameplayClueChoices {
  return getGameplayClueChoices(
    metadata.options.variantName,
    getCharacterNameForPlayer(metadata.ourPlayerIndex, metadata.characterAssignments),
    metadata.options.emptyClues,
  );
}

export function getGameplayClueChoicesForPlayerIndex(
  metadata: ClueMetadata,
  playerIndex: number,
): GameplayClueChoices {
  const characterID = Number.isInteger(playerIndex) && playerIndex >= 0
    ? metadata.characterAssignments[playerIndex]
    : undefined;
  const characterName = characterID === undefined || characterID === null
    ? ''
    : getCharacter(characterID).name;
  return getGameplayClueChoices(metadata.options.variantName, characterName, metadata.options.emptyClues);
}

export function getClueColorFill(variantName: string, value: number): string | null {
  return getVariant(variantName).clueColors[value]?.fill ?? null;
}

export function hasClueTokenForVariant(clueTokens: number, variantName: string): boolean {
  return clueTokens >= getAdjustedClueTokens(1, getVariant(variantName));
}

export function getDisplayedClueTokens(clueTokens: number, variantName: string): number {
  return getUnadjustedClueTokens(clueTokens, getVariant(variantName));
}

/** Matches the pinned web client's live FRE display, including note and manual efficiency adjustments. */
export function getDisplayedLiveFutureEfficiency(
  game: Pick<GameState, 'stats'>,
  efficiencyModifier: number,
): number | null {
  const cluesStillUsable = game.stats.cluesStillUsableNotRounded === null
    ? null
    : Math.floor(game.stats.cluesStillUsableNotRounded);
  if (cluesStillUsable === null) return null;

  const cardsGotten = game.stats.cardsGotten
    + efficiencyModifier
    + (game.stats.cardsGottenByNotes ?? 0);
  const cardsNotGotten = Math.max(game.stats.maxScore - cardsGotten, 0);
  const futureEfficiency = getEfficiency(cardsNotGotten, cluesStillUsable);
  return Number.isFinite(futureEfficiency) ? futureEfficiency : null;
}

export function getGameTableSuits(
  variantName: string,
  game: AuthoritativeTableState,
): readonly GameTableSuit[] {
  return getVariant(variantName).suits.map((suit, suitIndex) => {
    const playStack = game.playStacks[suit.suitIndex] ?? [];
    const topCardOrder = playStack[playStack.length - 1];
    const topCard = topCardOrder === undefined ? undefined : game.deck[topCardOrder];
    const discardStack = game.discardStacks[suit.suitIndex] ?? [];

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
