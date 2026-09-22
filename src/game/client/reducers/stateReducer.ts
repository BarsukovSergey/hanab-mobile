import { assertDefined, assertNotNull } from 'complete-common';
import type { Draft } from 'immer';
import { castDraft, original, produce } from 'immer';

import type { CardIdentity } from '../../upstream/interfaces/CardIdentity';
import type { GameMetadata } from '../../upstream/interfaces/GameMetadata';
import type { GameState } from '../../upstream/interfaces/GameState';
import { gameReducer } from '../../upstream/reducers/gameReducer';
import { getInitialGameState } from '../../upstream/reducers/initialStates/initialGameState';
import type { GameAction } from '../../upstream/types/gameActions';
import type { State } from '../types/State';
import type { Action } from '../types/actions';
import { replayReducer } from './replayReducer';
import { notesReducer } from './notesReducer';
import { shouldStoreSegment } from './stateReducerHelpers';

export const stateReducer = produce(stateReducerFunction, {} as State);

function stateReducerFunction(state: Draft<State>, action: Action) {
  switch (action.type) {
    case 'gameActionList': {
      // Calculate all the intermediate states.
      const initialGameState = getInitialGameState(state.metadata);

      const { game, states } = reduceGameActions(
        action.actions,
        initialGameState,
        state.playing,
        state.shadowing,
        state.finished,
        state.metadata,
      );

      state.ongoingGame = castDraft(game);

      // Initialized, ready to show.
      state.visibleState = state.ongoingGame;

      // We copy the card identities to the global state for convenience.
      updateCardIdentities(state);

      state.replay.states = castDraft(states);
      state.replay.actions = castDraft(action.actions);
      break;
    }

    case 'cardIdentities': {
      // Either we just entered a new replay or an ongoing game ended, so the server sent us a list
      // of the identities for every card in the deck.
      state.cardIdentities = castDraft(action.cardIdentities);

      // If we were in a variant that scrubbed plays and discards, rehydrate them now.
      state.replay.actions = castDraft(
        rehydrateScrubbedActions(state, action.cardIdentities),
      );

      break;
    }

    case 'finishOngoingGame': {
      if (state.playing || state.shadowing) {
        // We were playing in a game that just ended. Recalculate the whole game as a spectator to
        // fix card possibilities.
        state.playing = false;
        state.shadowing = false;

        const initialGameState = getInitialGameState(state.metadata);
        const { game, states } = reduceGameActions(
          state.replay.actions,
          initialGameState,
          state.playing,
          state.shadowing,
          true,
          state.metadata,
        );

        state.ongoingGame = castDraft(game);
        state.visibleState = state.ongoingGame;
        state.replay.states = castDraft(states);
      }

      // Mark that this game is now finished. The finished view will take care of enabling the UI
      // elements for a shared replay.
      state.finished = true;
      state.datetimeFinished = action.datetimeFinished;

      // Record the database ID of the game.
      state.replay.databaseID = action.databaseID;

      // If we were in an in-game replay when the game ended, keep us at the current turn so that we
      // are not taken away from what we are looking at. Otherwise, go to the penultimate segment.
      const inInGameReplay = state.replay.active;

      assertNotNull(
        state.ongoingGame.turn.segment,
        'The segment for the ongoing game was null when it finished.',
      );

      if (state.ongoingGame.turn.segment < 1) {
        throw new Error(
          'The segment for the ongoing game was less than 1 when it finished.',
        );
      }

      const penultimateSegment = state.ongoingGame.turn.segment - 1;

      if (!inInGameReplay) {
        state.replay.active = true;
        state.replay.segment = penultimateSegment;
      }

      // A finished game transitions to its authoritative shared replay, so any local hypothetical
      // branch from the ongoing game is no longer valid.
      state.replay.hypothetical = null;

      // Initialize the shared replay.
      state.replay.shared = {
        segment: penultimateSegment,
        useSharedSegments: !inInGameReplay,
        leader: action.sharedReplayLeader,
        amLeader: action.sharedReplayLeader === state.metadata.ourUsername,
      };

      break;
    }

    case 'init': {
      state.datetimeStarted = action.datetimeStarted;
      state.datetimeFinished = action.datetimeFinished;
      state.pause.active = action.paused;
      state.pause.playerIndex = action.pausePlayerIndex;
      state.notes = castDraft(notesReducer(original(state.notes), {
        type: 'setEffMod',
        mod: action.sharedReplayEffMod,
      }, state.metadata, state.playing, state.finished));

      if (action.spectating) {
        state.playing = false;
      }
      if (action.shadowing) {
        state.shadowing = true;
      }

      if (action.replay) {
        state.playing = false;
        state.shadowing = false;
        state.finished = true;
        state.replay.active = true;
        state.replay.segment = 0;
        state.replay.databaseID = action.databaseID;

        if (action.sharedReplay) {
          state.replay.segment = action.sharedReplaySegment;
          state.replay.shared = {
            segment: action.sharedReplaySegment,
            useSharedSegments: true,
            leader: action.sharedReplayLeader,
            amLeader: action.sharedReplayLeader === state.metadata.ourUsername,
          };
        }
      }

      break;
    }

    case 'pause': {
      state.pause.active = action.active;
      state.pause.playerIndex = action.playerIndex;
      if (action.active) state.pause.queued = false;
      break;
    }

    case 'pauseQueue': {
      state.pause.queued = action.queued;
      break;
    }

    case 'noteList':
    case 'receiveNote': {
      state.notes = castDraft(notesReducer(
        original(state.notes),
        action,
        state.metadata,
        state.playing,
        state.finished,
      ));
      break;
    }

    case 'setEffMod':
    case 'editNote':
    case 'noteListPlayer': {
      state.notes = castDraft(notesReducer(
        original(state.notes),
        action,
        state.metadata,
        state.playing,
        state.finished,
      ));
      if (state.playing && !state.finished) {
        state.ongoingGame = castDraft(gameReducer(
          original(state.ongoingGame),
          action,
          state.playing,
          state.shadowing,
          state.finished,
          false,
          state.metadata,
          state.notes.ourNotes,
        ));
      }
      break;
    }

    case 'replayEnter':
    case 'replayExit':
    case 'replaySegment':
    case 'replaySharedSegment':
    case 'replayUseSharedSegments':
    case 'replayLeader':
    case 'hypoStart':
    case 'hypoEnd':
    case 'hypoBack':
    case 'hypoShowDrawnCards':
    case 'hypoAction': {
      state.replay = castDraft(replayReducer(state.replay, action, state.finished, state.metadata));
      break;
    }

    case 'spectators': {
      state.spectators = castDraft(action.spectators);
      break;
    }

    default: {
      // A new game action happened.
      const previousSegment = state.ongoingGame.turn.segment;
      state.ongoingGame = castDraft(
        gameReducer(
          original(state.ongoingGame),
          action,
          state.playing,
          state.shadowing,
          state.finished,
          false,
          state.metadata,
          state.notes.ourNotes.length === 0 ? undefined : state.notes.ourNotes,
        ),
      );

      // We copy the card identities to the global state for convenience.
      updateCardIdentities(state);

      if (
        shouldStoreSegment(
          state.ongoingGame.turn.segment,
          previousSegment,
          action,
        )
        && state.ongoingGame.turn.segment !== null
      ) {
        state.replay.states[state.ongoingGame.turn.segment] = state.ongoingGame;
      }

      // Save the action so that we can recompute the state at the end of the game.
      state.replay.actions.push(castDraft(action));

      break;
    }
  }

  // Show the appropriate state depending on the situation.
  state.visibleState = visualStateToShow(state, action);
}

// Runs through a list of actions from an initial state, and returns the final state and all
// intermediate states.
function reduceGameActions(
  actions: readonly GameAction[],
  initialGameState: GameState,
  playing: boolean,
  shadowing: boolean,
  finished: boolean,
  metadata: GameMetadata,
) {
  const states: GameState[] = [initialGameState];

  // eslint-disable-next-line unicorn/no-array-reduce
  const game = actions.reduce((s: GameState, a: GameAction) => {
    const nextState = gameReducer(
      s,
      a,
      playing,
      shadowing,
      finished,
      false,
      metadata,
    );

    if (
      shouldStoreSegment(nextState.turn.segment, s.turn.segment, a)
      && nextState.turn.segment !== null
    ) {
      states[nextState.turn.segment] = nextState;
    }

    return nextState;
  }, initialGameState);

  return { game, states };
}

function updateCardIdentities(state: Draft<State>) {
  for (const [i, newCardIdentity] of state.ongoingGame.deck.entries()) {
    if (i >= state.cardIdentities.length) {
      state.cardIdentities[i] = {
        suitIndex: newCardIdentity.suitIndex,
        rank: newCardIdentity.rank,
      };
    } else {
      const existingCardIdentity = state.cardIdentities[i];
      assertDefined(
        existingCardIdentity,
        `Failed to find the existing card identity at index: ${i}`,
      );

      existingCardIdentity.suitIndex ??= newCardIdentity.suitIndex;
      existingCardIdentity.rank ??= newCardIdentity.rank;
    }
  }
}

function visualStateToShow(
  state: Draft<State>,
  action: Action,
): Draft<GameState> | null {
  if (state.visibleState === null) {
    return null;
  }

  if (state.replay.active) {
    if (state.replay.hypothetical !== null) return state.replay.hypothetical.ongoing;
    const currentReplayState = state.replay.states[state.replay.segment];
    assertDefined(
      currentReplayState,
      `Failed to find the replay state for segment: ${state.replay.segment}`,
    );

    return currentReplayState;
  }

  if (action.type === 'playerTimes') {
    return state.replay.states.at(-2) ?? null;
  }

  return state.ongoingGame;
}

function rehydrateScrubbedActions(
  state: State,
  cardIdentities: readonly CardIdentity[],
): readonly GameAction[] {
  return state.replay.actions.map((action) => {
    if (
      (action.type === 'play'
        || action.type === 'discard'
        || action.type === 'draw')
      && (action.suitIndex === -1 || action.rank === -1)
    ) {
      const cardIdentity = cardIdentities[action.order];
      assertDefined(
        cardIdentity,
        'Failed to find the card identity for an action while rehydrating the scrubbed actions.',
      );

      const { suitIndex, rank } = cardIdentity;
      if (suitIndex === null || rank === null) {
        throw new Error(
          'Failed to find the suit index or rank of a card identity for an action while rehydrating the scrubbed actions.',
        );
      }

      return {
        ...action,
        suitIndex,
        rank,
      };
    }

    return action;
  });
}
