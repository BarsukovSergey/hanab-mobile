import {
  PipState,
  getCardBorderPresentation,
  getCardIdentityToShow,
  getCardPipPresentation,
} from '../client/cardPresentation';
import { getVariant } from '../upstream/gameData';
import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
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

const EMPTY_IDENTITY: CardIdentity = { suitIndex: null, rank: null };
const knowledgeCache = new WeakMap<
  CardState,
  WeakMap<CardNote, WeakMap<CardIdentity, Map<string, CardKnowledgeViewModel>>>
>();

export function getCardKnowledgeViewModel(
  variantName: string,
  card: CardState,
  note: CardNote | undefined = undefined,
  finished = false,
  empathy = false,
  cardIdentity: CardIdentity | undefined = undefined,
): CardKnowledgeViewModel {
  const cardNote = note ?? EMPTY_NOTE;
  const identityRef = cardIdentity ?? EMPTY_IDENTITY;
  const cacheKey = `${variantName}\u0000${finished ? 1 : 0}\u0000${empathy ? 1 : 0}\u0000${cardIdentity === undefined ? 0 : 1}`;
  const cached = getCachedKnowledge(card, cardNote, identityRef, cacheKey);
  if (cached !== undefined) return cached;

  const variant = getVariant(variantName);
  const identity = getCardIdentityToShow({
    cardIdentity: cardIdentity ?? { suitIndex: card.suitIndex, rank: card.rank },
    state: card,
    note: cardNote,
    empathy,
    isStackBase: false,
    finished,
  });
  const border = getCardBorderPresentation(card, cardNote, finished);
  const pips = getCardPipPresentation(variant, card, cardNote, empathy);
  const clueSuitIndexes = new Set<number>(
    card.possibleCardsFromClues.map(([suitIndex]) => suitIndex),
  );
  const clueRanks = new Set<number>(
    card.possibleCardsFromClues.map(([, rank]) => rank),
  );
  const positiveColorLabels = card.positiveColorClues.map((color) => (
    variant.clueColors.find((candidate) => candidate.name === color.name)?.name
      ?? color.name
  ));
  const positiveRanks: readonly number[] = [...card.positiveRankClues];

  const result: CardKnowledgeViewModel = {
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
  setCachedKnowledge(card, cardNote, identityRef, cacheKey, result);
  return result;
}

function getCachedKnowledge(
  card: CardState,
  note: CardNote,
  identity: CardIdentity,
  cacheKey: string,
): CardKnowledgeViewModel | undefined {
  return knowledgeCache.get(card)?.get(note)?.get(identity)?.get(cacheKey);
}

function setCachedKnowledge(
  card: CardState,
  note: CardNote,
  identity: CardIdentity,
  cacheKey: string,
  result: CardKnowledgeViewModel,
): void {
  let byNote = knowledgeCache.get(card);
  if (byNote === undefined) {
    byNote = new WeakMap();
    knowledgeCache.set(card, byNote);
  }
  let byIdentity = byNote.get(note);
  if (byIdentity === undefined) {
    byIdentity = new WeakMap();
    byNote.set(note, byIdentity);
  }
  let byMode = byIdentity.get(identity);
  if (byMode === undefined) {
    byMode = new Map();
    byIdentity.set(identity, byMode);
  }
  byMode.set(cacheKey, result);
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
