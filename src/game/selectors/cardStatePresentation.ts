import { CardStatus } from '../upstream/enums/CardStatus';
import type { CardNote } from '../upstream/interfaces/CardNote';
import type { CardState } from '../upstream/interfaces/CardState';
import type { GameState } from '../upstream/interfaces/GameState';
import { getVariant } from '../upstream/gameData';
import { isCardClued, isCardDiscarded, isCardPlayed } from '../upstream/rules/cardState';
import type { Rank } from '../upstream/types/Rank';
import type { SuitIndex } from '../upstream/types/SuitIndex';

export type CardStatePresentation = {
  engineTrash: boolean;
  shouldFade: boolean;
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
  variantName,
  speedrun,
  hyphenatedConventions,
  hardVariant,
}: {
  game: GameState;
  state: CardState;
  note?: CardNote;
  displaySuitIndex: number | null;
  displayRank: number | null;
  empathy: boolean;
  finished: boolean;
  variantName: string;
  speedrun: boolean;
  hyphenatedConventions: boolean;
  hardVariant: boolean;
}): CardStatePresentation {
  const leftHand = isCardPlayed(state) || isCardDiscarded(state);
  const status = getDisplayedCardStatus(game, displaySuitIndex, displayRank);
  const noteIndicatorsVisible = !empathy && !leftHand && !finished;
  const knownTrashNote = noteIndicatorsVisible && (note?.knownTrash ?? false);
  const engineTrash = status === CardStatus.Trash;
  const shouldFade = (knownTrashNote && !isCardClued(state)) || (
    engineTrash
    && !isCardClued(state)
    && !leftHand
    && !(note?.blank ?? false)
    && !(note?.chopMoved ?? false)
    && !getVariant(variantName).throwItInAHole
    && !speedrun
  );
  const knownTrashFromEmpathy = !leftHand && state.isKnownTrashFromEmpathy;

  return {
    engineTrash,
    shouldFade,
    critical: status === CardStatus.Critical && !leftHand,
    knownTrashNote,
    knownTrashFromEmpathy,
    needsFix: noteIndicatorsVisible && (note?.needsFix ?? false),
    questionMark: noteIndicatorsVisible && (note?.questionMark ?? false),
    exclamationMark: noteIndicatorsVisible && (note?.exclamationMark ?? false),
    doubleDiscard: state.inDoubleDiscard
      && hyphenatedConventions
      && !hardVariant
      && status !== CardStatus.Critical
      && !knownTrashFromEmpathy,
  };
}

export function getDisplayedCardStatus(
  game: GameState,
  displaySuitIndex: number | null,
  displayRank: number | null,
): CardStatus {
  if (displaySuitIndex === null || displayRank === null) return CardStatus.NeedsToBePlayed;
  const suitStatuses = game.cardStatus[displaySuitIndex as SuitIndex];
  return suitStatuses?.[displayRank as Rank] ?? CardStatus.NeedsToBePlayed;
}

/** Engine truth for table/discard surfaces, independent of hand fade exclusions. */
export function isEngineTrash(game: GameState, suitIndex: number | null, rank: number | null): boolean {
  return getDisplayedCardStatus(game, suitIndex, rank) === CardStatus.Trash;
}
