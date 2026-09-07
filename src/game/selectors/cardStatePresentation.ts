import { CardStatus } from '../upstream/enums/CardStatus';
import type { CardNote } from '../upstream/interfaces/CardNote';
import type { CardState } from '../upstream/interfaces/CardState';
import type { GameState } from '../upstream/interfaces/GameState';
import { isCardDiscarded, isCardPlayed } from '../upstream/rules/cardState';
import type { Rank } from '../upstream/types/Rank';
import type { SuitIndex } from '../upstream/types/SuitIndex';

export type CardStatePresentation = {
  engineTrash: boolean;
  critical: boolean;
  knownTrashNote: boolean;
  knownTrashFromEmpathy: boolean;
  needsFix: boolean;
  questionMark: boolean;
  exclamationMark: boolean;
  doubleDiscard: boolean;
};

export function getCardStatePresentation({
  game,
  state,
  note,
  displaySuitIndex,
  displayRank,
  empathy,
  finished,
}: {
  game: GameState;
  state: CardState;
  note?: CardNote;
  displaySuitIndex: SuitIndex | null;
  displayRank: Rank | null;
  empathy: boolean;
  finished: boolean;
}): CardStatePresentation {
  const leftHand = isCardPlayed(state) || isCardDiscarded(state);
  const status = displaySuitIndex === null || displayRank === null
    ? CardStatus.NeedsToBePlayed
    : game.cardStatus[displaySuitIndex]?.[displayRank] ?? CardStatus.NeedsToBePlayed;
  const noteIndicatorsVisible = !empathy && !leftHand && !finished;
  const knownTrashFromEmpathy = !leftHand && state.isKnownTrashFromEmpathy;

  return {
    engineTrash: status === CardStatus.Trash,
    critical: status === CardStatus.Critical && !leftHand,
    knownTrashNote: noteIndicatorsVisible && (note?.knownTrash ?? false),
    knownTrashFromEmpathy,
    needsFix: noteIndicatorsVisible && (note?.needsFix ?? false),
    questionMark: noteIndicatorsVisible && (note?.questionMark ?? false),
    exclamationMark: noteIndicatorsVisible && (note?.exclamationMark ?? false),
    doubleDiscard: state.inDoubleDiscard
      && status !== CardStatus.Critical
      && !knownTrashFromEmpathy,
  };
}
