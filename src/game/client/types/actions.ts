import type { CardIdentity } from '../../upstream/interfaces/CardIdentity';
import type { GameAction } from '../../upstream/types/gameActions';
import type { PlayerIndex } from '../../upstream/types/PlayerIndex';
import type { Spectator } from './Spectator';

export type Action =
  | ActionInit
  | ActionListReceived
  | GameAction
  | ReplayAction
  | ActionCardIdentities
  | ActionSpectators
  | ActionFinishOngoingGame;

export type ReplayAction =
  | ActionReplayEnter
  | ActionReplayExit
  | ActionReplaySegment
  | ActionReplaySharedSegment
  | ActionReplayUseSharedSegments
  | ActionReplayLeader;

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

export interface ActionSpectators {
  readonly type: 'spectators';
  readonly spectators: readonly Spectator[];
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

export interface ActionReplaySharedSegment {
  readonly type: 'replaySharedSegment';
  readonly segment: number;
}

export interface ActionReplayUseSharedSegments {
  readonly type: 'replayUseSharedSegments';
  readonly useSharedSegments: boolean;
}

export interface ActionReplayLeader {
  readonly type: 'replayLeader';
  readonly name: string;
}
