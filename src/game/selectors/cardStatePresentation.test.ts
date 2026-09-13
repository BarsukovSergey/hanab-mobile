import { describe, expect, test } from '@jest/globals';

import { CardStatus } from '../upstream/enums/CardStatus';
import type { CardNote } from '../upstream/interfaces/CardNote';
import type { CardState } from '../upstream/interfaces/CardState';
import type { GameState } from '../upstream/interfaces/GameState';
import { getCardStatePresentation } from './cardStatePresentation';

const baseCard = {
  order: 1,
  location: 0,
  suitIndex: 0,
  rank: 2,
  numPositiveClues: 0,
  isKnownTrashFromEmpathy: false,
  inDoubleDiscard: false,
} as unknown as CardState;

const baseNote = {
  knownTrash: false,
  needsFix: false,
  questionMark: false,
  exclamationMark: false,
  blank: false,
  chopMoved: false,
} as CardNote;

function gameWith(status: CardStatus): GameState {
  const cardStatus: number[][] = [];
  cardStatus[0] = [];
  cardStatus[0]![2] = status;
  return { cardStatus } as unknown as GameState;
}

function presentation({
  status = CardStatus.NeedsToBePlayed,
  state = baseCard,
  note = baseNote,
  displaySuitIndex = 0,
  displayRank = 2,
  empathy = false,
  finished = false,
  variantName = 'No Variant',
  speedrun = false,
}: {
  status?: CardStatus;
  state?: CardState;
  note?: CardNote;
  displaySuitIndex?: number | null;
  displayRank?: number | null;
  empathy?: boolean;
  finished?: boolean;
  variantName?: string;
  speedrun?: boolean;
} = {}) {
  return getCardStatePresentation({
    game: gameWith(status),
    state,
    note,
    displaySuitIndex,
    displayRank,
    empathy,
    finished,
    variantName,
    speedrun,
  });
}

describe('getCardStatePresentation', () => {
  test('fades an ordinary unclued engine-trash card', () => {
    expect(presentation({ status: CardStatus.Trash })).toMatchObject({
      engineTrash: true,
      shouldFade: true,
    });
  });

  test('does not fade a clued engine-trash card', () => {
    expect(presentation({
      status: CardStatus.Trash,
      state: { ...baseCard, numPositiveClues: 1 } as CardState,
    }).shouldFade).toBe(false);
  });

  test('does not fade a played or discarded engine-trash card', () => {
    expect(presentation({
      status: CardStatus.Trash,
      state: { ...baseCard, location: 'playStack' } as CardState,
    }).shouldFade).toBe(false);
    expect(presentation({
      status: CardStatus.Trash,
      state: { ...baseCard, location: 'discard' } as CardState,
    }).shouldFade).toBe(false);
  });

  test('does not fade blank or chop-moved engine-trash cards', () => {
    expect(presentation({
      status: CardStatus.Trash,
      note: { ...baseNote, blank: true } as CardNote,
    }).shouldFade).toBe(false);
    expect(presentation({
      status: CardStatus.Trash,
      note: { ...baseNote, chopMoved: true } as CardNote,
    }).shouldFade).toBe(false);
  });

  test('does not fade engine-trash cards in Throw It in a Hole or speedrun', () => {
    expect(presentation({
      status: CardStatus.Trash,
      variantName: 'Throw It in a Hole (5 Suits)',
    }).shouldFade).toBe(false);
    expect(presentation({ status: CardStatus.Trash, speedrun: true }).shouldFade).toBe(false);
  });

  test('a visible zero-clue KT marker forces fade independently of engine status', () => {
    expect(presentation({
      note: { ...baseNote, knownTrash: true } as CardNote,
    })).toMatchObject({
      engineTrash: false,
      knownTrashNote: true,
      shouldFade: true,
    });
  });

  test('does not apply the KT override when its marker is suppressed', () => {
    expect(presentation({
      note: { ...baseNote, knownTrash: true } as CardNote,
      empathy: true,
    })).toMatchObject({ knownTrashNote: false, shouldFade: false });
  });

  test('retains personal marker visibility rules', () => {
    const note = {
      ...baseNote,
      knownTrash: true,
      needsFix: true,
      questionMark: true,
      exclamationMark: true,
    } as CardNote;
    expect(presentation({ note })).toMatchObject({
      knownTrashNote: true,
      needsFix: true,
      questionMark: true,
      exclamationMark: true,
    });
    expect(presentation({ note, empathy: true })).toMatchObject({
      knownTrashNote: false,
      needsFix: false,
      questionMark: false,
      exclamationMark: false,
    });
  });

  test('keeps critical and empathy-known-trash indicators independent from fade', () => {
    expect(presentation({ status: CardStatus.Critical })).toMatchObject({
      engineTrash: false,
      critical: true,
      shouldFade: false,
    });
    expect(presentation({
      state: { ...baseCard, isKnownTrashFromEmpathy: true } as CardState,
      displaySuitIndex: null,
      displayRank: null,
      empathy: true,
    })).toMatchObject({ knownTrashFromEmpathy: true, shouldFade: false });
  });

  test('does not infer engine trash or fade without a visible identity', () => {
    expect(presentation({
      status: CardStatus.Trash,
      displaySuitIndex: null,
    })).toMatchObject({ engineTrash: false, critical: false, shouldFade: false });
  });
});
