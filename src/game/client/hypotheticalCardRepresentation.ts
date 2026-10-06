import { getHypotheticalCard } from './hypotheticalPlanning';
import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
import type { CardNote } from '../upstream/interfaces/CardNote';
import type { CardState } from '../upstream/interfaces/CardState';
import type { SuitRankTuple } from '../upstream/types/SuitRankTuple';

export type HypotheticalCardRepresentation = {
  readonly identity: CardIdentity;
  readonly possibilities: readonly SuitRankTuple[];
};

/** Compatibility boundary; U2 owns identity and possibilities. */
export function getHypotheticalCardRepresentation(
  state: CardState,
  cardIdentity: CardIdentity,
  note: CardNote,
  morph: CardIdentity | undefined,
  playing: boolean,
): HypotheticalCardRepresentation {
  const { identity, possibilities } = getHypotheticalCard({
    state, identity: cardIdentity, note, morphedIdentity: morph, playing,
    isStackBase: false, visibleSuitIndex: null, visibleRank: null,
  });
  return { identity, possibilities };
}
