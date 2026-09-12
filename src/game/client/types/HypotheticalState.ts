import type { CardIdentity } from '../../upstream/interfaces/CardIdentity';
import type { GameState } from '../../upstream/interfaces/GameState';
import type { PlayerIndex } from '../../upstream/types/PlayerIndex';

export interface HypotheticalState {
  readonly ongoing: GameState;
  readonly states: readonly GameState[];
  readonly showDrawnCards: boolean;
  readonly drawnCardsInHypothetical: readonly number[];
  readonly morphedIdentities: readonly CardIdentity[];
  readonly startingPlayerIndex: PlayerIndex | null;
}
