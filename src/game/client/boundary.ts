import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import type { GameAction } from '../upstream/types/gameActions';
import type { PlayerIndex } from '../upstream/types/PlayerIndex';
import type {
  CardIdentities,
  FinishOngoingGame,
  GameInit,
  WireGameAction,
} from '../../protocol/gameProtocol';
import { initialState } from './reducers/initialStates/initialState';
import { stateReducer } from './reducers/stateReducer';
import type { State } from './types/State';
import type {
  ActionCardIdentities,
  ActionFinishOngoingGame,
  ActionInit,
  ActionListReceived,
} from './types/actions';

function actionMatchesMetadata(action: WireGameAction, metadata: GameMetadata): boolean {
  const count = metadata.options.numPlayers;
  const validPlayer = (value: number): boolean => value >= 0 && value < count;
  switch (action.type) {
    case 'cardIdentity':
    case 'discard':
    case 'draw':
    case 'play':
      return validPlayer(action.playerIndex);
    case 'clue':
      return validPlayer(action.giver) && validPlayer(action.target);
    case 'gameOver':
      return (action.playerIndex === -1 || validPlayer(action.playerIndex))
        && (action.votes === null || action.votes.every(validPlayer));
    case 'playerTimes':
      return action.playerTimes.length === count;
    case 'turn':
      return action.currentPlayerIndex === -1 || validPlayer(action.currentPlayerIndex);
    case 'status':
    case 'strike':
      return true;
  }
}

/** Converts a fully validated production Go-wire action at the headless-client boundary. */
export function toUpstreamGameAction(
  action: WireGameAction,
  metadata: GameMetadata,
): GameAction {
  if (!actionMatchesMetadata(action, metadata)) {
    throw new Error(`Action ${action.type} does not match init metadata`);
  }

  // The pinned Go clue payload omits this client-only property. The official client treats the
  // missing value as false; make that boundary conversion explicit for the upstream reducer type.
  const converted = action.type === 'clue'
    ? { ...action, ignoreNegative: false }
    : action;

  // The pinned Go stream also includes status no-ops and uses -1 sentinels in terminal actions.
  // Both are accepted by the pinned reducer at runtime but are narrower than its public TS type.
  return converted as unknown as GameAction;
}

export function toInitAction(init: GameInit): ActionInit {
  return {
    type: 'init',
    datetimeStarted: init.datetimeStarted,
    datetimeFinished: init.datetimeFinished,
    spectating: init.spectating,
    shadowing: init.shadowing,
    replay: init.replay,
    sharedReplay: init.sharedReplay,
    databaseID: init.databaseID,
    sharedReplaySegment: init.sharedReplaySegment,
    sharedReplayLeader: init.sharedReplayLeader,
    paused: init.paused,
    pausePlayerIndex: init.pausePlayerIndex as PlayerIndex,
    sharedReplayEffMod: init.sharedReplayEffMod,
  };
}

export function toGameActionListAction(
  actions: readonly WireGameAction[],
  metadata: GameMetadata,
): ActionListReceived {
  return {
    type: 'gameActionList',
    actions: actions.map((action) => toUpstreamGameAction(action, metadata)),
  };
}

export function toCardIdentitiesAction(event: CardIdentities): ActionCardIdentities {
  return {
    type: 'cardIdentities',
    cardIdentities: event.cardIdentities as readonly CardIdentity[],
  };
}

export function toFinishOngoingGameAction(
  event: FinishOngoingGame,
  datetimeFinished: string,
): ActionFinishOngoingGame {
  return {
    type: 'finishOngoingGame',
    databaseID: event.databaseID,
    sharedReplayLeader: event.sharedReplayLeader,
    datetimeFinished,
  };
}

export function initializeHeadlessState(metadata: GameMetadata, init: GameInit): State {
  return stateReducer(initialState(metadata), toInitAction(init));
}
