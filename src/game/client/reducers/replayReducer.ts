import type { Draft } from 'immer';
import { produce } from 'immer';

import type { ReplayState } from '../types/ReplayState';
import type { ReplayAction } from '../types/actions';

export const replayReducer = produce(replayReducerFunction, {} as ReplayState);

function replayReducerFunction(
  state: Draft<ReplayState>,
  action: ReplayAction,
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
  }
}
