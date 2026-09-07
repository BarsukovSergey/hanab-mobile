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
  isKnownTrashFromEmpathy: false,
  inDoubleDiscard: false,
} as unknown as CardState;

const baseNote = {
  knownTrash: false,
  needsFix: false,
  questionMark: false,
  exclamationMark: false,
} as CardNote;

function gameWith(status: CardStatus): GameState {
  const cardStatus: number[][] = [];
  cardStatus[0] = [];
  cardStatus[0]![2] = status;
  return { cardStatus } as unknown as GameState;
}

describe('getCardStatePresentation', () => {
  test('keeps engine trash separate from personal KT', () => {
    expect(getCardStatePresentation({
      game: gameWith(CardStatus.Trash),
      state: baseCard,
      note: baseNote,
      displaySuitIndex: 0,
      displayRank: 2,
      empathy: false,
      finished: false,
    })).toMatchObject({ engineTrash: true, critical: false, knownTrashNote: false });

    expect(getCardStatePresentation({
      game: gameWith(CardStatus.NeedsToBePlayed),
      state: baseCard,
      note: { ...baseNote, knownTrash: true },
      displaySuitIndex: 0,
      displayRank: 2,
      empathy: false,
      finished: false,
    })).toMatchObject({ engineTrash: false, critical: false, knownTrashNote: true });
  });

  test('shows critical as its own authoritative status', () => {
    expect(getCardStatePresentation({
      game: gameWith(CardStatus.Critical),
      state: baseCard,
      note: baseNote,
      displaySuitIndex: 0,
      displayRank: 2,
      empathy: false,
      finished: false,
    })).toMatchObject({ engineTrash: false, critical: true, knownTrashNote: false });
  });

  test('hides personal note markers in empathy but retains empathy-known trash', () => {
    const state = { ...baseCard, isKnownTrashFromEmpathy: true } as CardState;
    expect(getCardStatePresentation({
      game: gameWith(CardStatus.NeedsToBePlayed),
      state,
      note: { ...baseNote, knownTrash: true, needsFix: true, questionMark: true },
      displaySuitIndex: null,
      displayRank: null,
      empathy: true,
      finished: false,
    })).toMatchObject({
      knownTrashNote: false,
      knownTrashFromEmpathy: true,
      needsFix: false,
      questionMark: false,
    });
  });

  test('does not infer engine trash or critical without a visible identity', () => {
    expect(getCardStatePresentation({
      game: gameWith(CardStatus.Trash),
      state: baseCard,
      note: baseNote,
      displaySuitIndex: null,
      displayRank: 2,
      empathy: false,
      finished: false,
    })).toMatchObject({ engineTrash: false, critical: false });
  });
});
