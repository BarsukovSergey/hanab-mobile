import { getVariant } from '../upstream/gameData';
import type { CardState } from '../upstream/interfaces/CardState';

export type CardKnowledgeViewModel = {
  order: number;
  hasClueApplied: boolean;
  positiveColorLabels: readonly string[];
  positiveRanks: readonly number[];
  possibleSuitLabels: readonly string[];
  possibleRanks: readonly number[];
  suitDetermined: boolean;
  rankDetermined: boolean;
};

export function getCardKnowledgeViewModel(
  variantName: string,
  card: CardState,
): CardKnowledgeViewModel {
  const variant = getVariant(variantName);
  const possibleSuitIndexes = new Set<number>(
    card.possibleCardsFromClues.map(([suitIndex]) => suitIndex),
  );
  const possibleRanks = new Set<number>(
    card.possibleCardsFromClues.map(([, rank]) => rank),
  );

  return {
    order: card.order,
    hasClueApplied: card.hasClueApplied,
    positiveColorLabels: card.positiveColorClues.map((color) => (
      variant.clueColors.find((candidate) => candidate.name === color.name)?.name
        ?? color.name
    )),
    positiveRanks: [...card.positiveRankClues],
    possibleSuitLabels: variant.suits
      .filter((_, suitIndex) => possibleSuitIndexes.has(suitIndex))
      .map((suit) => suit.name),
    possibleRanks: variant.ranks.filter((rank) => possibleRanks.has(rank)),
    suitDetermined: card.suitDetermined,
    rankDetermined: card.rankDetermined,
  };
}
