import { getVariant } from '../upstream/gameData';
import type { GameState } from '../upstream/interfaces/GameState';

export type DiscardRankCount = {
  rank: number;
  count: number;
};

export type DiscardSuitSummary = {
  suitIndex: number;
  suitName: string;
  total: number;
  ranks: readonly DiscardRankCount[];
};

export type DiscardSummary = {
  total: number;
  suits: readonly DiscardSuitSummary[];
};

export function getDiscardSummary(
  variantName: string,
  game: Pick<GameState, 'discardStacks' | 'deck'>,
): DiscardSummary {
  const variant = getVariant(variantName);
  let total = 0;
  const suits = variant.suits.flatMap((suit, suitIndex) => {
    const counts = new Map<number, number>();
    for (const order of game.discardStacks[suitIndex] ?? []) {
      const card = game.deck[order];
      if (card === undefined || card.rank === null) continue;
      counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
    }
    const suitTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);
    if (suitTotal === 0) return [];
    total += suitTotal;
    return [{
      suitIndex,
      suitName: suit.name,
      total: suitTotal,
      ranks: [...counts.entries()]
        .sort(([a], [b]) => a - b)
        .map(([rank, count]) => ({ rank, count })),
    }];
  });
  return { total, suits };
}
