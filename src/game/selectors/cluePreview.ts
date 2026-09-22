import { getVariant } from '../upstream/gameData';
import { ClueType } from '../upstream/enums/ClueType';
import type { GameState } from '../upstream/interfaces/GameState';
import { isCardTouchedByClue } from '../upstream/rules/clues';
import { newColorClue, newRankClue } from '../upstream/types/Clue';
import {
  getHypotheticalTouchedOrders,
  type HypotheticalClueTouchContext,
} from '../client/hypotheticalClueTouch';

export type CluePreview = {
  type: 'color' | 'rank';
  value: number;
  targetPlayerIndex: number;
  touchedOrders: readonly number[];
};

export function getCluePreview(
  game: Pick<GameState, 'hands' | 'deck'>,
  variantName: string,
  targetPlayerIndex: number,
  type: 'color' | 'rank',
  value: number,
  hypothetical: HypotheticalClueTouchContext | undefined = undefined,
): CluePreview | null {
  const hand = game.hands[targetPlayerIndex];
  if (hand === undefined) return null;
  const variant = getVariant(variantName);
  const clue = type === 'color'
    ? (() => {
      const color = variant.clueColors[value];
      return color === undefined ? null : newColorClue(color);
    })()
    : (() => {
      const rank = variant.clueRanks.find((candidate) => candidate === value);
      return rank === undefined ? null : newRankClue(rank);
    })();
  if (clue === null) return null;

  const touchedOrders = hypothetical === undefined ? hand.filter((order) => {
    const card = game.deck[order];
    if (card === undefined || card.suitIndex === null || card.rank === null) return false;
    return isCardTouchedByClue(variant, clue, card.suitIndex, card.rank);
  }) : getHypotheticalTouchedOrders(game, variant, targetPlayerIndex, clue, hypothetical);

  return {
    type: clue.type === ClueType.Color ? 'color' : 'rank',
    value,
    targetPlayerIndex,
    touchedOrders,
  };
}

export function isCluePreviewConfirmable(
  preview: CluePreview | null,
  allowEmptyClues: boolean,
  variantName: string,
): boolean {
  if (preview === null) return false;
  if (preview.touchedOrders.length > 0 || allowEmptyClues) return true;

  const variant = getVariant(variantName);
  return preview.type === 'color'
    ? variant.colorCluesTouchNothing
    : variant.rankCluesTouchNothing;
}
