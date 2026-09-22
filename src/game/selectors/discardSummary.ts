import { getVariant } from '../upstream/gameData';
import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
import type { GameState } from '../upstream/interfaces/GameState';

export type DiscardRankCount = {
  rank: number;
  count: number;
};

export type DiscardSuitSummary = {
  suitIndex: number;
  suitName: string;
  total: number;
  unknownCount: number;
  ranks: readonly DiscardRankCount[];
};

export type DiscardSummary = {
  total: number;
  suits: readonly DiscardSuitSummary[];
};

export function getDiscardSummary(
  variantName: string,
  game: Pick<GameState, 'discardStacks' | 'deck'>,
  cardIdentities?: readonly CardIdentity[],
): DiscardSummary {
  const variant = getVariant(variantName);
  let total = 0;
  const suits = variant.suits.flatMap((suit, suitIndex) => {
    const orders = game.discardStacks[suitIndex] ?? [];
    if (orders.length === 0) return [];

    const counts = new Map<number, number>();
    let unknownCount = 0;
    for (const order of orders) {
      const card = game.deck[order];
      const identity = cardIdentities?.[order];
      const rank = identity?.rank ?? card?.rank ?? null;
      if (rank === null) {
        unknownCount += 1;
        continue;
      }
      counts.set(rank, (counts.get(rank) ?? 0) + 1);
    }

    const suitTotal = orders.length;
    total += suitTotal;
    return [{
      suitIndex,
      suitName: suit.name,
      total: suitTotal,
      unknownCount,
      ranks: [...counts.entries()]
        .sort(([a], [b]) => a - b)
        .map(([rank, count]) => ({ rank, count })),
    }];
  });
  return { total, suits };
}
