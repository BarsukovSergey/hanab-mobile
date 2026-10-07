// Adapted from Hanabi-Live PR #3158 at 0103ce7d2a72cb1922e46324ef2e484720bea737.
// Mobile retains its hypothetical state/action types for branch history and strikes above three.
import type { Draft } from 'immer';
import { castDraft, produce } from 'immer';

import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import type { GameState } from '../upstream/interfaces/GameState';
import { gameReducer } from '../upstream/reducers/gameReducer';
import type { GameAction } from '../upstream/types/gameActions';
import type { HypotheticalState } from './types/HypotheticalState';
import type { ActionIncludingHypothetical } from './types/actions';

export type HypotheticalStateAction =
  | ActionIncludingHypothetical
  | { readonly type: "back" }
  | { readonly type: "showDrawnCards"; readonly showDrawnCards: boolean };

/** Starts from the game state selected by the caller, then applies any initial actions in order. */
export function initializeHypotheticalState(
  ongoing: GameState,
  showDrawnCards: boolean,
  actions: readonly ActionIncludingHypothetical[],
  finished: boolean,
  metadata: GameMetadata,
): HypotheticalState {
  let state: HypotheticalState = {
    ongoing,
    states: [ongoing],
    showDrawnCards,
    drawnCardsInHypothetical: [],
    morphedIdentities: [],
    startingPlayerIndex: ongoing.turn.currentPlayerIndex,
    actions: [],
    stateActionLengths: [0],
  };

  for (const action of actions) {
    state = hypotheticalStateReducer(state, action, finished, metadata);
  }

  return state;
}

/** Applies a hypothetical action, restores a saved state, or toggles drawn card identities. */
export const hypotheticalStateReducer = produce(
  hypotheticalStateReducerFunction,
);

function hypotheticalStateReducerFunction(
  state: Draft<HypotheticalState>,
  action: HypotheticalStateAction,
  finished: boolean,
  metadata: GameMetadata,
) {
  switch (action.type) {
    case "back": {
      state.states.pop();
      state.stateActionLengths.pop();
      const retainedActionLength = state.stateActionLengths.at(-1);
      if (retainedActionLength !== undefined) {
        state.actions.splice(retainedActionLength);
      }
      const lastState = state.states.at(-1);
      if (lastState !== undefined) {
        state.ongoing = lastState;
      }
      return;
    }

    case "showDrawnCards": {
      state.showDrawnCards = action.showDrawnCards;
      for (const order of state.drawnCardsInHypothetical) {
        if (action.showDrawnCards) {
          // This is a sparse array, so delete the entry instead of splicing it.
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete, @typescript-eslint/no-array-delete
          delete state.morphedIdentities[order];
        } else {
          state.morphedIdentities[order] = {
            rank: null,
            suitIndex: null,
          };
        }
      }
      return;
    }

    case "morph": {
      state.morphedIdentities[action.order] = {
        suitIndex: action.suitIndex === -1 ? null : action.suitIndex,
        rank: action.rank === -1 ? null : action.rank,
      };
      return;
    }

    case "unmorph": {
      // This is a sparse array, so delete the entry instead of splicing it.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete, @typescript-eslint/no-array-delete
      delete state.morphedIdentities[action.order];
      return;
    }

    default: {
      break;
    }
  }

  if (action.type === "draw") {
    // Store every draw to be able to show/hide the cards in the future.
    state.drawnCardsInHypothetical.push(action.order);
    if (!state.showDrawnCards) {
      state.morphedIdentities[action.order] = {
        suitIndex: null,
        rank: null,
      };
    }
  }

  // Retain the original branch action, before applying the hidden-clue override.
  state.actions.push(castDraft(action));

  const isClueActionThatShouldIgnoreNegative =
    action.type === "clue"
    && !state.showDrawnCards
    && state.startingPlayerIndex === action.target;
  const newAction = isClueActionThatShouldIgnoreNegative
    ? { ...action, ignoreNegative: true }
    : action;

  const oldSegment = state.ongoing.turn.segment;
  const newState = gameReducer(
    state.ongoing,
    // The vendored reducer permits arbitrary strike numbers in hypotheticals at runtime.
    // Its GameAction type models live strikes (1 | 2 | 3); keep this adaptation local.
    newAction as GameAction,
    true,
    false,
    finished,
    true,
    metadata,
  );
  state.ongoing = castDraft(newState);

  if (oldSegment !== newState.turn.segment) {
    // Save the new segment in case we want to go backwards.
    state.states.push(castDraft(newState));
    state.stateActionLengths.push(state.actions.length);
  }
}
