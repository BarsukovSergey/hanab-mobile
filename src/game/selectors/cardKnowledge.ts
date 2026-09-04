import {
  PipState,
  getCardBorderPresentation,
  getCardIdentityToShow,
  getCardPipPresentation,
} from '../client/cardPresentation';
import { getVariant } from '../upstream/gameData';
import type { CardNote } from '../upstream/interfaces/CardNote';
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
  displaySuitIndex: number | null;
  displayRank: number | null;
  borderColor: string | null;
  positiveColorLabels: readonly string[];
  positiveRanks: readonly number[];
  possibleSuitLabels: readonly string[];
  possibleRanks: readonly number[];
  suitPips: readonly SuitKnowledgePip[];
  rankPips: readonly RankKnowledgePip[];
  suitDetermined: boolean;
  rankDetermined: boolean;
};

const EMPTY_NOTE: CardNote = {
  possibilities: [],
  knownTrash: false,
  needsFix: false,
  questionMark: false,
  exclamationMark: false,
  chopMoved: false,
  finessed: false,
  discardPermission: false,
  blank: false,
  unclued: false,
  clued: false,
  text: '',
};

export function getCardKnowledgeViewModel(
  variantName: string,
  card: CardState,
  note: CardNote | undefined = undefined,
  finished = false,
  empathy = false,
): CardKnowledgeViewModel {
  const variant = getVariant(variantName);
  const cardNote = note ?? EMPTY_NOTE;
  const identity = getCardIdentityToShow({
    cardIdentity: { suitIndex: card.suitIndex, rank: card.rank },
    state: card,
    note: cardNote,
    empathy,
    isStackBase: false,
    finished,
  });
  const border = getCardBorderPresentation(card, cardNote, finished);
  const pips = getCardPipPresentation(variant, card, cardNote, empathy);
  const cluePossibilities = empathy ? card.possibleCardsFromClues : card.possibleCardsFromClues;
  const clueSuitIndexes = new Set<number>(
    cluePossibilities.map(([suitIndex]) => suitIndex),
  );
  const clueRanks = new Set<number>(
    cluePossibilities.map(([, rank]) => rank),
  );
  const positiveColorLabels = card.positiveColorClues.map((color) => (
    variant.clueColors.find((candidate) => candidate.name === color.name)?.name
      ?? color.name
  ));
  const positiveRanks: readonly number[] = [...card.positiveRankClues];

  return {
    order: card.order,
    hasClueApplied: card.hasClueApplied,
    displaySuitIndex: identity.suitIndex,
    displayRank: identity.rank,
    borderColor: getBorderColor(border),
    positiveColorLabels,
    positiveRanks,
    possibleSuitLabels: variant.suits
      .filter((_, suitIndex) => clueSuitIndexes.has(suitIndex))
      .map((suit) => suit.name),
    possibleRanks: variant.ranks.filter((rank) => clueRanks.has(rank)),
    suitPips: pips.suitPips.map((pip) => ({
      suitIndex: pip.suitIndex,
      label: variant.suits[pip.suitIndex]?.name ?? `Suit ${pip.suitIndex}`,
      state: pipStateName(pip.state),
      positive: pip.positive,
    })),
    rankPips: pips.rankPips.map((pip) => ({
      rank: pip.rank,
      state: pipStateName(pip.state),
      positive: pip.positive,
    })),
    suitDetermined: card.suitDetermined,
    rankDetermined: card.rankDetermined,
  };
}

function pipStateName(state: PipState): KnowledgePipState {
  switch (state) {
    case PipState.Eliminated:
      return 'eliminated';
    case PipState.Visible:
      return 'visible';
    case PipState.Hidden:
    default:
      return 'hidden';
  }
}

function getBorderColor(border: ReturnType<typeof getCardBorderPresentation>): string | null {
  if (border.clued) return 'orange';
  if (border.finessed) return 'aqua';
  if (border.discardPermission) return '#812020';
  if (border.chopMoved) return '#fffce6';
  return null;
}
