import { possibleCardsFromNoteAndClues } from './cardPresentation';
import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
import type { CardNote } from '../upstream/interfaces/CardNote';
import type { CardState } from '../upstream/interfaces/CardState';
import type { SuitRankTuple } from '../upstream/types/SuitRankTuple';

export type HypotheticalCardRepresentation = {
  readonly identity: CardIdentity;
  readonly possibilities: readonly SuitRankTuple[];
};

/** Pure pinned-HanabiCard representation used for hypothetical actions and clue touches. */
export function getHypotheticalCardRepresentation(
  state: CardState,
  cardIdentity: CardIdentity,
  note: CardNote,
  morph: CardIdentity | undefined,
  playing: boolean,
): HypotheticalCardRepresentation {
  const noteAndCluePossibilities = possibleCardsFromNoteAndClues(note, state);
  const identity = morph ?? (playing && noteAndCluePossibilities.length === 1
    ? tupleToIdentity(noteAndCluePossibilities[0]!)
    : cardIdentity);

  const possibilities = identity.suitIndex !== null && identity.rank !== null
    ? [[identity.suitIndex, identity.rank]] as const
    : (playing ? noteAndCluePossibilities : state.possibleCardsFromClues).filter(([suitIndex, rank]) => (
      state.possibleCards.some(([possibleSuitIndex, possibleRank]) => (
        suitIndex === possibleSuitIndex && rank === possibleRank
      ))
    ));

  return { identity, possibilities };
}

function tupleToIdentity([suitIndex, rank]: SuitRankTuple): CardIdentity {
  return { suitIndex, rank };
}
