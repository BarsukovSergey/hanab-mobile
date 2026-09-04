import { getVariant } from '../upstream/gameData';
import { ClueType } from '../upstream/enums/ClueType';
import type { GameState } from '../upstream/interfaces/GameState';
import { isCardTouchedByClue } from '../upstream/rules/clues';
import { newColorClue, newRankClue } from '../upstream/types/Clue';

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
): CluePreview | null {
  const hand = game.hands[targetPlayerIndex];
  if (hand === undefined) return null;
  const variant = getVariant(variantName);
  const clue = type === 'color'
    ? (() => {
      const color = variant.clueColors[value];
      return color === undefined ? null : newColorClue(color);
    })()
    : variant.clueRanks.includes(value)
      ? newRankClue(value)
      : null;
  if (clue === null) return null;

  const touchedOrders = hand.filter((order) => {
    const card = game.deck[order];
    if (card === undefined || card.suitIndex === null || card.rank === null) return false;
    return isCardTouchedByClue(variant, clue, card.suitIndex, card.rank);
  });

  return {
    type: clue.type === ClueType.Color ? 'color' : 'rank',
    value,
    targetPlayerIndex,
    touchedOrders,
  };
}
