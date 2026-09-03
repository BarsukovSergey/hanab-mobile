import { getVariant } from '../upstream/gameData';
import type { CardState } from '../upstream/interfaces/CardState';

export type KnowledgePipState = 'hidden' | 'visible' | 'eliminated';

export type SuitKnowledgePip = {
  suitIndex: number;
  label: string;
  state: KnowledgePipState;
  positive: boolean;
};

export type RankKnowledgePip = {
  rank: number;
  state: KnowledgePipState;
  positive: boolean;
};

export type CardKnowledgeViewModel = {
  order: number;
  hasClueApplied: boolean;
  positiveColorLabels: readonly string[];
  positiveRanks: readonly number[];
  possibleSuitLabels: readonly string[];
  possibleRanks: readonly number[];
  suitPips: readonly SuitKnowledgePip[];
  rankPips: readonly RankKnowledgePip[];
  suitDetermined: boolean;
  rankDetermined: boolean;
};

export function getCardKnowledgeViewModel(
  variantName: string,
  card: CardState,
): CardKnowledgeViewModel {
  const variant = getVariant(variantName);
  const clueSuitIndexes = new Set<number>(
    card.possibleCardsFromClues.map(([suitIndex]) => suitIndex),
  );
  const clueRanks = new Set<number>(
    card.possibleCardsFromClues.map(([, rank]) => rank),
  );
  const possibleSuitIndexes = new Set<number>(
    card.possibleCards.map(([suitIndex]) => suitIndex),
  );
  const possibleRanks = new Set<number>(
    card.possibleCards.map(([, rank]) => rank),
  );
  const positiveColorLabels = card.positiveColorClues.map((color) => (
    variant.clueColors.find((candidate) => candidate.name === color.name)?.name
      ?? color.name
  ));
  const positiveRanks: readonly number[] = [...card.positiveRankClues];

  return {
    order: card.order,
    hasClueApplied: card.hasClueApplied,
    positiveColorLabels,
    positiveRanks,
    possibleSuitLabels: variant.suits
      .filter((_, suitIndex) => clueSuitIndexes.has(suitIndex))
      .map((suit) => suit.name),
    possibleRanks: variant.ranks.filter((rank) => clueRanks.has(rank)),
    suitPips: variant.suits.map((suit, suitIndex) => ({
      suitIndex,
      label: suit.name,
      state: !clueSuitIndexes.has(suitIndex)
        ? 'hidden'
        : possibleSuitIndexes.has(suitIndex) ? 'visible' : 'eliminated',
      positive: card.positiveColorClues.some((color) => color.name === suit.name),
    })),
    rankPips: variant.ranks.map((rank) => ({
      rank,
      state: !clueRanks.has(rank)
        ? 'hidden'
        : possibleRanks.has(rank) ? 'visible' : 'eliminated',
      positive: positiveRanks.some((positiveRank) => positiveRank === rank),
    })),
    suitDetermined: card.suitDetermined,
    rankDetermined: card.rankDetermined,
  };
}
