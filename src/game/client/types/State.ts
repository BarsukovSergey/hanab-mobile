import type { CardIdentity } from '../../upstream/interfaces/CardIdentity';
import type { GameMetadata } from '../../upstream/interfaces/GameMetadata';
import type { GameState } from '../../upstream/interfaces/GameState';
import type { ReplayState } from './ReplayState';
import type { Spectator } from './Spectator';

/**
 * Platform-independent subset of the pinned upstream client State.
 *
 * Browser-only notes, drag UI, premove, pause, and spectator presentation fields are deliberately
 * outside the mobile C12-A headless boundary.
 */
export interface State {
  readonly visibleState: GameState | null; // Null during initialization
  readonly ongoingGame: GameState; // In a replay, this is the state of the final turn
  readonly replay: ReplayState;

  // Equal to true if we are playing in an ongoing game. Equal to false is we are spectating an
  // ongoing game, in a dedicated solo replay, or in a shared replay.
  readonly playing: boolean;

  // Equal to true if we are shadowing a player.
  readonly shadowing: boolean;

  // Equal to true if we are in a dedicated solo replay or a shared replay.
  readonly finished: boolean;

  readonly metadata: GameMetadata;

  // We do not use a `Date` object for dates in order to speed up state copying.
  readonly datetimeStarted: string | null;
  readonly datetimeFinished: string | null;

  readonly cardIdentities: readonly CardIdentity[];
  readonly spectators: readonly Spectator[];
}
