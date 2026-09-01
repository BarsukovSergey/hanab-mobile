import type { CardIdentity } from '../../upstream/interfaces/CardIdentity';
import type { GameAction } from '../../upstream/types/gameActions';
import type { PlayerIndex } from '../../upstream/types/PlayerIndex';

export type Action =
  | ActionInit
  | ActionListReceived
  | GameAction
  | ReplayAction
  | ActionCardIdentities
  | ActionFinishOngoingGame;

export type ReplayAction =
  | ActionReplayEnter
  | ActionReplayExit
  | ActionReplaySegment;

export interface ActionInit {
  readonly type: 'init';
  readonly datetimeStarted: string;
  readonly datetimeFinished: string;
  readonly spectating: boolean;
  readonly shadowing: boolean;

  /** True if either a dedicated solo replay or a shared replay. */
  readonly replay: boolean;

  readonly sharedReplay: boolean;
  readonly databaseID: number;
  readonly sharedReplaySegment: number;
  readonly sharedReplayLeader: string;
  readonly paused: boolean;
  readonly pausePlayerIndex: PlayerIndex;
}

export interface ActionListReceived {
  readonly type: 'gameActionList';
  readonly actions: readonly GameAction[];
}

export interface ActionCardIdentities {
  readonly type: 'cardIdentities';
  readonly cardIdentities: readonly CardIdentity[];
}

export interface ActionFinishOngoingGame {
  readonly type: 'finishOngoingGame';
  readonly databaseID: number;
  readonly sharedReplayLeader: string;
  readonly datetimeFinished: string;
}

export interface ActionReplayEnter {
  readonly type: 'replayEnter';
  readonly segment: number;
}

export interface ActionReplayExit {
  readonly type: 'replayExit';
}

export interface ActionReplaySegment {
  readonly type: 'replaySegment';
  readonly segment: number;
}
