import type { CardIdentity } from '../../upstream/interfaces/CardIdentity';
import type { GameAction, NoteAction } from '../../upstream/types/gameActions';
import type { CardOrder } from '../../upstream/types/CardOrder';
import type { Rank } from '../../upstream/types/Rank';
import type { SuitIndex } from '../../upstream/types/SuitIndex';
import type { PlayerIndex } from '../../upstream/types/PlayerIndex';
import type { Spectator } from './Spectator';

export type { NoteAction } from '../../upstream/types/gameActions';

export type Action =
  | ActionInit
  | ActionPause
  | ActionPauseQueue
  | ActionListReceived
  | GameAction
  | NoteAction
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
  | ActionReplayLeader
  | ActionHypotheticalStart
  | ActionHypotheticalEnd
  | ActionHypotheticalAction
  | ActionHypotheticalBack
  | ActionHypotheticalShowDrawnCards;

export type ActionIncludingHypothetical = Exclude<GameAction, { readonly type: 'strike' }>
  | ActionHypotheticalStrike
  | ActionHypotheticalMorph
  | ActionHypotheticalUnmorph;

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
  readonly sharedReplayEffMod: number;
}

export interface ActionListReceived {
  readonly type: 'gameActionList';
  readonly actions: readonly GameAction[];
}

export interface ActionPause {
  readonly type: 'pause';
  readonly active: boolean;
  readonly playerIndex: PlayerIndex;
}

export interface ActionPauseQueue {
  readonly type: 'pauseQueue';
  readonly queued: boolean;
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

export interface ActionHypotheticalStart {
  readonly type: 'hypoStart';
  readonly showDrawnCards: boolean;
  readonly actions: readonly ActionIncludingHypothetical[];
}

export interface ActionHypotheticalEnd { readonly type: 'hypoEnd'; }

export interface ActionHypotheticalAction {
  readonly type: 'hypoAction';
  readonly action: ActionIncludingHypothetical;
}

export interface ActionHypotheticalBack { readonly type: 'hypoBack'; }

export interface ActionHypotheticalShowDrawnCards {
  readonly type: 'hypoShowDrawnCards';
  readonly showDrawnCards: boolean;
}

export interface ActionHypotheticalMorph {
  readonly type: 'morph';
  readonly suitIndex: SuitIndex | -1;
  readonly rank: Rank | -1;
  readonly order: CardOrder;
}

export interface ActionHypotheticalUnmorph {
  readonly type: 'unmorph';
  readonly order: CardOrder;
}

/** Hypotheticals intentionally permit more than three strikes (pinned upstream behavior). */
export interface ActionHypotheticalStrike {
  readonly type: 'strike';
  readonly num: number;
  readonly order: CardOrder;
  readonly turn: number;
}
