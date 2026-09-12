import { assertDefined, assertNotNull } from 'complete-common';
import type { Draft } from 'immer';
import { produce } from 'immer';
import { castDraft, original } from 'immer';

import type { ReplayState } from '../types/ReplayState';
import type { ActionIncludingHypothetical, ReplayAction } from '../types/actions';
import { gameReducer } from '../../upstream/reducers/gameReducer';
import type { GameMetadata } from '../../upstream/interfaces/GameMetadata';

export const replayReducer = produce(replayReducerFunction, {} as ReplayState);

function replayReducerFunction(
  state: Draft<ReplayState>,
  action: ReplayAction,
  finished: boolean,
  metadata: GameMetadata,
) {
  // Validate current state
  if (!state.active && action.type !== 'replayEnter') {
    throw new Error(
      `A "${action.type}" action was dispatched, but we are not in a replay.`,
    );
  }

  switch (action.type) {
    case 'replayEnter': {
      if (state.active) {
        throw new Error(
          `A "${action.type}" action was dispatched, but we are already in a replay.`,
        );
      }
      state.active = true;

      if (typeof action.segment !== 'number') {
        throw new TypeError(
          `The "${action.type}" action segment was not a number.`,
        );
      }
      if (action.segment < 0) {
        throw new Error(`The "${action.type}" action segment was less than 0.`);
      }
      state.segment = action.segment;

      break;
    }

    case 'replayExit': {
      state.active = false;
      state.segment = 0;

      break;
    }

    case 'replaySegment': {
      if (typeof action.segment !== 'number') {
        throw new TypeError(
          `The "${action.type}" action segment was not a number.`,
        );
      }
      if (action.segment < 0) {
        throw new Error(`The "${action.type}" action segment was less than 0.`);
      }
      state.segment = action.segment;

      break;
    }

    case 'replaySharedSegment': {
      assertNotNull(
        state.shared,
        `A "${action.type}" action was dispatched, but we are not in a shared replay.`,
      );
      if (typeof action.segment !== 'number') {
        throw new TypeError(`The "${action.type}" action segment was not a number.`);
      }
      if (action.segment < 0) {
        throw new Error(`The "${action.type}" action segment was less than 0.`);
      }
      state.shared.segment = action.segment;
      if (state.shared.useSharedSegments) state.segment = action.segment;
      break;
    }

    case 'replayUseSharedSegments': {
      assertNotNull(
        state.shared,
        `A "${action.type}" action was dispatched, but we are not in a shared replay.`,
      );
      state.shared.useSharedSegments = action.useSharedSegments;
      if (state.shared.amLeader && state.shared.useSharedSegments) {
        state.shared.segment = state.segment;
      }
      break;
    }

    case 'replayLeader': {
      assertNotNull(
        state.shared,
        `A "${action.type}" action was dispatched, but we are not in a shared replay.`,
      );
      state.shared.leader = action.name;
      state.shared.amLeader = action.name === metadata.ourUsername;
      break;
    }

    case 'hypoStart': {
      if (state.hypothetical !== null) throw new Error('A "hypoStart" action was dispatched with a non-null hypothetical state.');
      if (state.shared !== null) {
        state.segment = state.shared.segment;
        state.shared.useSharedSegments = true;
      }
      const ongoing = state.states[state.segment];
      assertDefined(ongoing, `Failed to get the game state for segment: ${state.segment}`);
      state.hypothetical = {
        ongoing,
        states: [ongoing],
        showDrawnCards: action.showDrawnCards,
        drawnCardsInHypothetical: [],
        morphedIdentities: [],
        startingPlayerIndex: ongoing.turn.currentPlayerIndex,
      };
      for (const hypoAction of action.actions) hypoReduce(state, hypoAction, finished, metadata);
      break;
    }

    case 'hypoEnd':
      assertNotNull(state.hypothetical, 'A "hypoEnd" action was dispatched with a null hypothetical state.');
      state.hypothetical = null;
      break;

    case 'hypoBack': {
      assertNotNull(state.hypothetical, 'A "hypoBack" action was dispatched with a null hypothetical state.');
      state.hypothetical.states.pop();
      const lastState = state.hypothetical.states.at(-1);
      if (lastState !== undefined) state.hypothetical.ongoing = lastState;
      break;
    }

    case 'hypoShowDrawnCards': {
      assertNotNull(state.hypothetical, 'A "hypoShowDrawnCards" action was dispatched with a null hypothetical state.');
      state.hypothetical.showDrawnCards = action.showDrawnCards;
      const drawn = original(state.hypothetical.drawnCardsInHypothetical);
      if (drawn !== undefined) for (const order of drawn) {
        if (action.showDrawnCards) delete state.hypothetical.morphedIdentities[order];
        else state.hypothetical.morphedIdentities[order] = { suitIndex: null, rank: null };
      }
      break;
    }

    case 'hypoAction':
      hypoReduce(state, action.action, finished, metadata);
      break;
  }
}

function hypoReduce(state: Draft<ReplayState>, action: ActionIncludingHypothetical, finished: boolean, metadata: GameMetadata) {
  assertNotNull(state.hypothetical, `A "${action.type}" action was dispatched with a null hypothetical state.`);
  if (action.type === 'morph') {
    state.hypothetical.morphedIdentities[action.order] = {
      suitIndex: action.suitIndex === -1 ? null : action.suitIndex,
      rank: action.rank === -1 ? null : action.rank,
    };
  } else if (action.type === 'unmorph') delete state.hypothetical.morphedIdentities[action.order];
  if (action.type === 'draw') {
    state.hypothetical.drawnCardsInHypothetical.push(action.order);
    if (!state.hypothetical.showDrawnCards) state.hypothetical.morphedIdentities[action.order] = { suitIndex: null, rank: null };
  }
  if (action.type === 'morph' || action.type === 'unmorph') return;
  const reduceAction = action.type === 'clue' && !state.hypothetical.showDrawnCards && state.hypothetical.startingPlayerIndex === action.target
    ? { ...action, ignoreNegative: true }
    : action;
  const oldSegment = state.hypothetical.ongoing.turn.segment;
  const next = gameReducer(state.hypothetical.ongoing, reduceAction, true, false, finished, true, metadata);
  state.hypothetical.ongoing = castDraft(next);
  if (oldSegment !== next.turn.segment) state.hypothetical.states.push(castDraft(next));
}
