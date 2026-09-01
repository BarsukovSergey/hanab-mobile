import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import type { GameState } from '../upstream/interfaces/GameState';
import { EndCondition } from '../upstream/enums/EndCondition';
import { gameReducer } from '../upstream/reducers/gameReducer';
import { getInitialGameState } from '../upstream/reducers/initialStates/initialGameState';
import type { GameAction } from '../upstream/types/gameActions';
import type {
  CardIdentities,
  WireGameAction,
} from '../../protocol/gameProtocol';

export type ReplayPerspective = 'player-live' | 'spectator-live' | 'finished';

export type ReplaySnapshot = {
  segment: number;
  game: GameState;
};

export type ReplayTimeline = {
  finalGame: GameState;
  snapshots: readonly ReplaySnapshot[];
};

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

export function reduceAuthoritativeAction(
  game: GameState,
  metadata: GameMetadata,
  perspective: ReplayPerspective,
  action: WireGameAction,
): GameState {
  if (!actionMatchesMetadata(action, metadata)) {
    throw new Error(`Action ${action.type} does not match init metadata`);
  }
  return gameReducer(
    game,
    action as GameAction,
    perspective === 'player-live',
    false,
    perspective === 'finished',
    false,
    metadata,
  );
}

function shouldStoreSegment(
  segment: number | null,
  previousSegment: number | null,
  action: WireGameAction,
): boolean {
  if (segment === null) return false;
  if (
    action.type === 'gameOver'
    && action.endCondition !== EndCondition.Timeout
    && action.endCondition !== EndCondition.TerminatedByPlayer
    && action.endCondition !== EndCondition.TerminatedByVote
    && action.endCondition !== EndCondition.IdleTimeout
  ) return true;
  return segment !== previousSegment;
}

/** Replays authoritative actions and stores snapshots at the pinned upstream segment boundaries. */
export function buildReplayTimeline(
  metadata: GameMetadata,
  perspective: ReplayPerspective,
  actions: readonly WireGameAction[],
): ReplayTimeline {
  const initialGame = getInitialGameState(metadata);
  const states: GameState[] = [initialGame];
  let game = initialGame;

  for (const action of actions) {
    const previous = game;
    game = reduceAuthoritativeAction(game, metadata, perspective, action);
    if (
      shouldStoreSegment(game.turn.segment, previous.turn.segment, action)
      && game.turn.segment !== null
    ) states[game.turn.segment] = game;
  }

  return {
    finalGame: game,
    snapshots: states.flatMap((state, segment) => (
      state === undefined ? [] : [{ segment, game: state }]
    )),
  };
}

export function rehydrateScrubbedActions(
  actions: readonly WireGameAction[],
  identities: CardIdentities['cardIdentities'],
): WireGameAction[] {
  return actions.map((action) => {
    if (
      (action.type === 'play' || action.type === 'discard' || action.type === 'draw')
      && (action.suitIndex === -1 || action.rank === -1)
    ) {
      const identity = identities[action.order];
      if (identity === undefined) {
        throw new Error(`Missing revealed identity for card order ${action.order}`);
      }
      return { ...action, ...identity };
    }
    return action;
  });
}
