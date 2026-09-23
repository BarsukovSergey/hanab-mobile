import { describe, expect, test } from '@jest/globals';

import { getCardKnowledgeViewModel } from './cardKnowledge';
import { getDefaultVariant } from '../upstream/gameData';
import type { CardNote } from '../upstream/interfaces/CardNote';
import type { CardState } from '../upstream/interfaces/CardState';
import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import { cardPossibilitiesReducer } from '../upstream/reducers/cardPossibilitiesReducer';
import { getInitialCardState } from '../upstream/reducers/initialStates/initialCardState';
import { cardOrder } from '../upstream/types/CardOrder';
import type { Clue } from '../upstream/types/Clue';
import { newColorClue, newRankClue } from '../upstream/types/Clue';

const variant = getDefaultVariant();
const metadata = {
  options: { variantName: variant.name },
} as GameMetadata;
const emptyNote: CardNote = {
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

function freshCard(order: number): CardState {
  return getInitialCardState(cardOrder.parse(order), variant, 2);
}

function applyClue(card: CardState, clue: Clue, positive: boolean): CardState {
  return cardPossibilitiesReducer(
    {
      ...card,
      hasClueApplied: true,
      numPositiveClues: card.numPositiveClues + (positive ? 1 : 0),
    },
    clue,
    positive,
    metadata,
  );
}

describe('card knowledge view model', () => {
  test('represents an untouched fresh card with full clue-only possibilities', () => {
    const knowledge = getCardKnowledgeViewModel(variant.name, freshCard(7));

    expect(knowledge).toMatchObject({
      order: 7,
      hasClueApplied: false,
      displaySuitIndex: null,
      displayRank: null,
      borderColor: null,
      positiveColorLabels: [],
      positiveRanks: [],
      possibleSuitLabels: variant.suits.map((suit) => suit.name),
      possibleRanks: [...variant.ranks],
      suitDetermined: false,
      rankDetermined: false,
    });
    expect(knowledge.suitPips.every((pip) => pip.state === 'visible')).toBe(true);
    expect(knowledge.rankPips.every((pip) => pip.state === 'visible')).toBe(true);
  });

  test('retains a rank clue when a color clue is added to the same card', () => {
    const color = variant.clueColors[0];
    expect(color).toBeDefined();
    if (color === undefined) return;

    const rankClued = applyClue(freshCard(8), newRankClue(2), true);
    const rankKnowledge = getCardKnowledgeViewModel(variant.name, rankClued);
    expect(rankKnowledge.positiveRanks).toEqual([2]);
    expect(rankKnowledge.possibleRanks).toEqual([2]);
    expect(rankKnowledge.possibleSuitLabels).toEqual(
      variant.suits.map((suit) => suit.name),
    );
    expect(rankKnowledge.rankPips.find((pip) => pip.rank === 2)).toMatchObject({ state: 'visible', positive: true });
    expect(rankKnowledge.rankPips.filter((pip) => pip.rank !== 2).every((pip) => pip.state === 'hidden')).toBe(true);
    expect(rankKnowledge.borderColor).toBe('orange');

    const colorAndRankClued = applyClue(rankClued, newColorClue(color), true);
    const accumulated = getCardKnowledgeViewModel(variant.name, colorAndRankClued);
    expect(accumulated.positiveRanks).toEqual([2]);
    expect(accumulated.positiveColorLabels).toEqual([color.name]);
    expect(accumulated.possibleRanks).toEqual([2]);
    expect(accumulated.possibleSuitLabels).toEqual([color.name]);
    expect(colorAndRankClued.possibleCardsFromClues).toHaveLength(1);
  });

  test('does not treat a negative clue as a clue border', () => {
    const color = variant.clueColors[0];
    expect(color).toBeDefined();
    if (color === undefined) return;

    const negativelyClued = applyClue(freshCard(9), newColorClue(color), false);
    const knowledge = getCardKnowledgeViewModel(variant.name, negativelyClued);

    expect(knowledge.hasClueApplied).toBe(true);
    expect(negativelyClued.numPositiveClues).toBe(0);
    expect(knowledge.borderColor).toBeNull();
    expect(knowledge.positiveColorLabels).toEqual([]);
    expect(knowledge.positiveRanks).toEqual([]);
    expect(knowledge.possibleSuitLabels).toEqual(
      variant.suits.map((suit) => suit.name).filter((name) => name !== color.name),
    );
    expect(knowledge.possibleRanks).toEqual([...variant.ranks]);
    expect(knowledge.suitPips.find((pip) => pip.label === color.name)?.state).toBe('hidden');
  });

  test('uses upstream partial identity and border precedence from notes', () => {
    const possibilities = freshCard(10).possibleCardsFromClues.filter(
      ([suitIndex, rank]) => suitIndex === 0 && rank === 2,
    );
    expect(possibilities).toHaveLength(1);

    const note: CardNote = {
      ...emptyNote,
      possibilities,
      finessed: true,
      discardPermission: true,
      chopMoved: true,
    };
    const knowledge = getCardKnowledgeViewModel(variant.name, freshCard(10), note);

    expect(knowledge.displaySuitIndex).toBe(0);
    expect(knowledge.displayRank).toBe(2);
    expect(knowledge.borderColor).toBe('aqua');
  });

  test('deactivates an unclued note border override after the game finishes', () => {
    const positivelyClued = applyClue(freshCard(18), newRankClue(2), true);
    const note: CardNote = { ...emptyNote, unclued: true };

    expect(getCardKnowledgeViewModel(variant.name, positivelyClued, note, false).borderColor).toBeNull();
    expect(getCardKnowledgeViewModel(variant.name, positivelyClued, note, true).borderColor).toBe('orange');
  });

  test('does not promote a single best-knowledge possibility into card identity', () => {
    const card = freshCard(15);
    const deduced: CardState = {
      ...card,
      suitIndex: null,
      rank: null,
      possibleCards: [[0, 3]],
    };

    expect(getCardKnowledgeViewModel(variant.name, deduced)).toMatchObject({
      displaySuitIndex: null,
      displayRank: null,
    });
  });

  test('shows an identity learned outside the selected historical card state', () => {
    const historical = freshCard(16);

    expect(getCardKnowledgeViewModel(
      variant.name,
      historical,
      undefined,
      false,
      false,
      { suitIndex: 0, rank: 3 },
    )).toMatchObject({
      displaySuitIndex: 0,
      displayRank: 3,
    });
  });

  test('keeps an explicit blank hypothetical morph blank despite note or empathy knowledge', () => {
    const card: CardState = {
      ...freshCard(17),
      suitIndex: 0,
      rank: 3,
      suitDetermined: true,
      rankDetermined: true,
    };
    const note: CardNote = {
      ...emptyNote,
      possibilities: [[0, 3]],
    };
    const blankMorph = { suitIndex: null, rank: null };

    expect(getCardKnowledgeViewModel(variant.name, card, note, false, false, blankMorph, true)).toMatchObject({
      displaySuitIndex: null,
      displayRank: null,
    });
    expect(getCardKnowledgeViewModel(variant.name, card, note, false, true, blankMorph, true)).toMatchObject({
      displaySuitIndex: null,
      displayRank: null,
    });

    const blank = getCardKnowledgeViewModel(variant.name, card, note, false, false, blankMorph, true);
    expect(blank.suitPips.every((pip) => pip.state === 'hidden')).toBe(true);
    expect(blank.rankPips.every((pip) => pip.state === 'hidden')).toBe(true);

    expect(getCardKnowledgeViewModel(variant.name, card, note)).toMatchObject({
      displaySuitIndex: 0,
      displayRank: 3,
    });
  });

  test('marks eliminated possibilities instead of hiding clue-visible pips', () => {
    const card = freshCard(12);
    const firstSuit = variant.suits[0];
    expect(firstSuit).toBeDefined();
    if (firstSuit === undefined) return;
    const narrowed = {
      ...card,
      possibleCards: card.possibleCards.filter(([suitIndex]) => suitIndex !== 0),
    };
    const knowledge = getCardKnowledgeViewModel(variant.name, narrowed);
    expect(knowledge.suitPips[0]).toMatchObject({ label: firstSuit.name, state: 'eliminated' });
  });

  test('uses owner knowledge instead of the open identity in empathy mode', () => {
    const card = freshCard(11);
    const visible: CardState = {
      ...card,
      suitIndex: 0,
      rank: 2,
      suitDetermined: false,
      rankDetermined: false,
      possibleCardsForEmpathy: card.possibleCardsForEmpathy.filter(([suitIndex]) => suitIndex !== 0),
    };

    const normal = getCardKnowledgeViewModel(variant.name, visible);
    const empathy = getCardKnowledgeViewModel(variant.name, visible, undefined, false, true);

    expect(normal).toMatchObject({ displaySuitIndex: 0, displayRank: 2 });
    expect(empathy).toMatchObject({ displaySuitIndex: null, displayRank: null });
    expect(empathy.suitPips[0]?.state).toBe('eliminated');
  });

  test('gives a freshly drawn order fresh knowledge instead of inheriting the old card', () => {
    const oldCard = applyClue(freshCard(13), newRankClue(3), true);
    const drawnCard = freshCard(14);

    expect(getCardKnowledgeViewModel(variant.name, oldCard).positiveRanks).toEqual([3]);
    expect(getCardKnowledgeViewModel(variant.name, drawnCard)).toMatchObject({
      order: 14,
      hasClueApplied: false,
      displaySuitIndex: null,
      displayRank: null,
      borderColor: null,
      positiveColorLabels: [],
      positiveRanks: [],
      possibleSuitLabels: variant.suits.map((suit) => suit.name),
      possibleRanks: [...variant.ranks],
    });
  });
});
