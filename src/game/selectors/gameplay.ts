import { getCharacter, getVariant } from '../upstream/gameData';
import { ClueType } from '../upstream/enums/ClueType';
import { PaceRisk } from '../upstream/enums/PaceRisk';
import type { GameState } from '../upstream/interfaces/GameState';
import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import { getCharacterNameForPlayer } from '../upstream/reducers/reducerHelpers';
import { getClueName } from '../upstream/rules/clues';
import {
  getAdjustedClueTokens,
  getUnadjustedClueTokens,
  isAtMaxClueTokens,
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
  timed: boolean,
): number | null {
  const serverTime = clock.times[playerIndex];
  if (serverTime === undefined) return null;
  const rawTime = paused || playerIndex !== clock.activePlayerIndex
    ? serverTime
    : serverTime - Math.max(0, nowMs - clock.receivedAtMs);
  return timed ? Math.max(0, rawTime) : Math.max(0, -rawTime);
}

export function getDisplayedClockString(
  clock: LiveClock,
  playerIndex: number,
  paused: boolean,
  nowMs: number,
  timed: boolean,
): string | null {
  const time = getDisplayedClockTime(clock, playerIndex, paused, nowMs, timed);
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

export function canDiscardForVariant(clueTokens: number, variantName: string): boolean {
  return !isAtMaxClueTokens(clueTokens, getVariant(variantName));
}

export function getDisplayedClueTokens(clueTokens: number, variantName: string): number {
  return getUnadjustedClueTokens(clueTokens, getVariant(variantName));
}

export type GameplayPresentation = {
  readonly pace: string;
  readonly paceRisk: GameplayPaceRisk | null;
  readonly futureRequiredEfficiency: number | null;
  readonly minimumRequiredEfficiency: number;
  readonly currentEfficiency: number | null;
  readonly rawCardsGotten: number;
  readonly cardsGottenByNotes: number | null;
  readonly efficiencyModifier: number | null;
  readonly cardsRemainingToGet: number;
  readonly remainingPossibleClues: number | null;
  readonly potentialCluesLost: number;
  readonly appliesEfficiencyModifier: boolean;
  readonly shouldModifyEfficiency: boolean;
  readonly finessesRequired: number | null;
};

export type GameplayPaceRisk = 'low' | 'medium' | 'high' | 'zero';

/** Shared mobile presentation semantics for Pace and efficiency in the game HUD. */
export function getGameplayPresentation(
  game: Pick<GameState, 'stats'>,
  options: Pick<GameMetadata['options'], 'allOrNothing'>,
  minimumRequiredEfficiency: number,
  efficiencyModifier: number,
  context: {
    finished: boolean;
    viewingOngoingGame: boolean;
    sharedReplayUseSharedSegments: boolean;
  },
): GameplayPresentation {
  const stats = game.stats;
  const paceUnavailable = stats.pace === null
    || stats.finalRoundEffectivelyStarted
    || options.allOrNothing;
  const shouldModifyEfficiency = context.finished
    ? context.sharedReplayUseSharedSegments
    : context.viewingOngoingGame;
  const appliedModifier = shouldModifyEfficiency ? efficiencyModifier : null;
  const appliedNotes = shouldModifyEfficiency ? stats.cardsGottenByNotes : null;
  const adjustedCardsGotten = stats.cardsGotten
    + (appliedModifier ?? 0)
    + (appliedNotes ?? 0);
  const cardsRemainingToGet = Math.max(stats.maxScore - adjustedCardsGotten, 0);
  const remainingPossibleClues = stats.cluesStillUsableNotRounded;
  const cluesStillUsable = remainingPossibleClues === null
    ? null
    : Math.floor(remainingPossibleClues);
  const futureRequiredEfficiency = cluesStillUsable === null
    ? null
    : getEfficiency(cardsRemainingToGet, cluesStillUsable);
  const currentEfficiency = stats.finalRoundEffectivelyStarted
    ? null
    : getEfficiency(adjustedCardsGotten, stats.potentialCluesLost);

  return {
    pace: paceUnavailable ? '-' : stats.pace > 0 ? `+${stats.pace}` : String(stats.pace),
    paceRisk: paceUnavailable ? null : toGameplayPaceRisk(stats.paceRisk),
    futureRequiredEfficiency: futureRequiredEfficiency !== null
      && Number.isFinite(futureRequiredEfficiency) ? futureRequiredEfficiency : null,
    minimumRequiredEfficiency,
    currentEfficiency: currentEfficiency !== null && Number.isFinite(currentEfficiency)
      ? currentEfficiency : null,
    rawCardsGotten: stats.cardsGotten,
    cardsGottenByNotes: appliedNotes,
    efficiencyModifier: appliedModifier,
    cardsRemainingToGet,
    remainingPossibleClues,
    potentialCluesLost: stats.potentialCluesLost,
    appliesEfficiencyModifier: appliedModifier !== null && appliedModifier !== 0,
    shouldModifyEfficiency,
    finessesRequired: futureRequiredEfficiency === null
      || !Number.isFinite(futureRequiredEfficiency)
      || remainingPossibleClues === null
      ? null
      : Math.max(cardsRemainingToGet - Math.floor(remainingPossibleClues), 0),
  };
}

function toGameplayPaceRisk(risk: PaceRisk): GameplayPaceRisk {
  switch (risk) {
    case PaceRisk.Low: return 'low';
    case PaceRisk.Medium: return 'medium';
    case PaceRisk.High: return 'high';
    case PaceRisk.Zero: return 'zero';
  }
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
