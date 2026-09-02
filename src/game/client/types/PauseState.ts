import type { PlayerIndex } from '../../upstream/types/PlayerIndex';

export interface PauseState {
  readonly active: boolean;
  readonly playerIndex: PlayerIndex;
  readonly queued: boolean;
}
