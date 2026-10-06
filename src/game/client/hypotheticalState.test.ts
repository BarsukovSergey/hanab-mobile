// Tests adapted from Hanabi-Live PR #3158 at 0103ce7d2a72cb1922e46324ef2e484720bea737.
/* eslint-disable unicorn/no-null */

import { describe, expect, jest, test } from "@jest/globals";
import {
  hypotheticalStateReducer,
  initializeHypotheticalState,
} from "./hypotheticalState";
import { getDefaultMetadata } from "../upstream/metadata";
import * as gameReducerModule from "../upstream/reducers/gameReducer";
import { gameReducer } from "../upstream/reducers/gameReducer";
import { getInitialGameState } from "../upstream/reducers/initialStates/initialGameState";
import { discard, draw, play, rankClue } from "../upstream/testActions";
import type { CardOrder } from "../upstream/types/CardOrder";
import type { ActionIncludingHypothetical } from "./types/actions";
import { canToggleHypotheticalDrawnCards } from "./hypotheticalEligibility";

const metadata = getDefaultMetadata(2);
let startingState = getInitialGameState(metadata);
for (let order = 0; order < 10; order++) {
  startingState = gameReducer(
    startingState,
    draw(order < 5 ? 0 : 1, order),
    true,
    false,
    false,
    true,
    metadata,
  );
}

describe("hypothetical state", () => {
  test.each([false, true])(
    "initializes with showDrawnCards = %s",
    (showDrawnCards) => {
      const state = initializeHypotheticalState(
        startingState,
        showDrawnCards,
        [],
        false,
        metadata,
      );
      expect(state.ongoing).toBe(startingState);
      expect(state.states).toEqual([startingState]);
      expect(state.states[0]).toBe(startingState);
      expect(state.startingPlayerIndex).toBe(0);
      expect(state.showDrawnCards).toBe(showDrawnCards);
      expect(state.drawnCardsInHypothetical).toEqual([]);
      expect(state.morphedIdentities).toEqual([]);
      expect(state.actions).toEqual([]);
      expect(state.stateActionLengths).toEqual([0]);
    },
  );

  test.each([1, null] as const)(
    "captures starting player %s from the selected state",
    (currentPlayerIndex) => {
      const selected = {
        ...startingState,
        turn: { ...startingState.turn, segment: 7, currentPlayerIndex },
      };
      const state = initializeHypotheticalState(
        selected,
        false,
        [],
        false,
        metadata,
      );
      expect(state.ongoing).toBe(selected);
      expect(state.states[0]).toBe(selected);
      expect(state.startingPlayerIndex).toBe(currentPlayerIndex);
    },
  );

  test("applies initial actions sequentially while retaining the starting player", () => {
    const action = rankClue(3, 1, [], 0);
    const state = initializeHypotheticalState(
      startingState,
      false,
      [
        { type: "morph", order: 0 as CardOrder, suitIndex: -1, rank: 3 },
        action,
        action,
      ],
      false,
      metadata,
    );
    expect(state.startingPlayerIndex).toBe(0);
    expect(state.states[0]).toBe(startingState);
    expect(state.states).toHaveLength(3);
    expect(state.ongoing.clueTokens).toBe(startingState.clueTokens - 2);
    expect(state.ongoing.clues.map((clue) => clue.negativeList)).toEqual([
      [],
      [],
    ]);
    expect(state.morphedIdentities[0]).toEqual({ suitIndex: null, rank: 3 });
    expect(state.actions).toEqual([action, action]);
    expect(state.stateActionLengths).toEqual([0, 1, 2]);
  });

  test("morph and unmorph preserve the game state and sparse indexes", () => {
    const initial = initializeHypotheticalState(
      startingState,
      false,
      [],
      false,
      metadata,
    );
    let state = hypotheticalStateReducer(
      initial,
      {
        type: "morph",
        order: 30 as CardOrder,
        suitIndex: -1,
        rank: -1,
      },
      false,
      metadata,
    );
    expect(state.morphedIdentities[30]).toEqual({
      suitIndex: null,
      rank: null,
    });
    expect(state.morphedIdentities[0]).toBeUndefined();
    state = hypotheticalStateReducer(
      state,
      {
        type: "morph",
        order: 30 as CardOrder,
        suitIndex: 1,
        rank: 2,
      },
      false,
      metadata,
    );
    expect(state.morphedIdentities[30]).toEqual({ suitIndex: 1, rank: 2 });
    state = hypotheticalStateReducer(
      state,
      {
        type: "unmorph",
        order: 30 as CardOrder,
      },
      false,
      metadata,
    );
    expect(state.morphedIdentities[30]).toBeUndefined();
    expect(state.morphedIdentities).toHaveLength(31);
    expect(state.ongoing).toBe(startingState);
    expect(state.states).toBe(initial.states);
    expect(state.actions).toBe(initial.actions);
    expect(state.stateActionLengths).toBe(initial.stateActionLengths);
    expect(initial.morphedIdentities).toEqual([]);
  });

  test("records every hidden draw and toggles all drawn identities", () => {
    const initial = initializeHypotheticalState(
      startingState,
      false,
      [],
      false,
      metadata,
    );
    const order = startingState.deck.length;
    let state = hypotheticalStateReducer(
      initial,
      draw(0, order, 0, 1),
      false,
      metadata,
    );
    state = hypotheticalStateReducer(
      state,
      draw(0, order, 0, 1),
      false,
      metadata,
    );
    expect(state.drawnCardsInHypothetical).toEqual([order, order]);
    expect(state.morphedIdentities[order]).toEqual({
      suitIndex: null,
      rank: null,
    });
    expect(state.ongoing.cardsRemainingInTheDeck).toBe(
      startingState.cardsRemainingInTheDeck - 2,
    );
    expect(state.states).toBe(initial.states);
    state = hypotheticalStateReducer(
      state,
      {
        type: "morph",
        order: 0 as CardOrder,
        suitIndex: 1,
        rank: 2,
      },
      false,
      metadata,
    );
    const { ongoing } = state;
    state = hypotheticalStateReducer(
      state,
      { type: "showDrawnCards", showDrawnCards: true },
      false,
      metadata,
    );
    expect(state.showDrawnCards).toBe(true);
    expect(state.morphedIdentities[order]).toBeUndefined();
    expect(state.ongoing).toBe(ongoing);
    state = hypotheticalStateReducer(
      state,
      draw(0, order + 1, 0, 2),
      false,
      metadata,
    );
    expect(state.morphedIdentities[order + 1]).toBeUndefined();
    const afterDraw = state.ongoing;
    state = hypotheticalStateReducer(
      state,
      { type: "showDrawnCards", showDrawnCards: false },
      false,
      metadata,
    );
    expect(state.showDrawnCards).toBe(false);
    for (const drawnOrder of [order, order + 1]) {
      expect(state.morphedIdentities[drawnOrder]).toEqual({
        suitIndex: null,
        rank: null,
      });
    }
    expect(state.morphedIdentities[0]).toEqual({ suitIndex: 1, rank: 2 });
    expect(state.ongoing).toBe(afterDraw);
    expect(state.drawnCardsInHypothetical).toEqual([order, order, order + 1]);
    expect(initial.drawnCardsInHypothetical).toEqual([]);
  });

  test.each([
    { showDrawnCards: false, target: 0, ignoreNegative: true },
    { showDrawnCards: true, target: 0, ignoreNegative: false },
    { showDrawnCards: false, target: 1, ignoreNegative: false },
  ] as const)(
    "clue negatives with $showDrawnCards shown and target $target",
    ({ showDrawnCards, target, ignoreNegative }) => {
      const initial = initializeHypotheticalState(
        startingState,
        showDrawnCards,
        [],
        false,
        metadata,
      );
      const action = rankClue(3, target === 0 ? 1 : 0, [], target);
      const state = hypotheticalStateReducer(initial, action, false, metadata);
      expect(state.ongoing.clues.at(-1)?.negativeList).toEqual(
        ignoreNegative ? [] : startingState.hands[target],
      );
      expect(action.ignoreNegative).toBe(false);
      expect(state.actions).toEqual([action]);
    },
  );

  test("preserves an explicit ignoreNegative on other clues", () => {
    const initial = initializeHypotheticalState(
      startingState,
      true,
      [],
      false,
      metadata,
    );
    const action = { ...rankClue(3, 0, [], 1), ignoreNegative: true };
    const state = hypotheticalStateReducer(initial, action, false, metadata);
    expect(state.ongoing.clues.at(-1)?.negativeList).toEqual([]);
  });

  test("saves segment changes and Back restores the previous saved state", () => {
    let state = initializeHypotheticalState(
      startingState,
      false,
      [],
      false,
      metadata,
    );
    state = hypotheticalStateReducer(
      state,
      rankClue(3, 0, [], 1),
      false,
      metadata,
    );
    const firstMove = state.ongoing;
    expect(firstMove.turn.segment).toBe(1);
    expect(state.states).toHaveLength(2);
    expect(state.states[1]).toBe(firstMove);
    state = hypotheticalStateReducer(
      state,
      rankClue(3, 1, [], 0),
      false,
      metadata,
    );
    expect(state.states).toHaveLength(3);
    expect(state.stateActionLengths).toEqual([0, 1, 2]);
    state = hypotheticalStateReducer(state, { type: "back" }, false, metadata);
    expect(state.ongoing).toBe(firstMove);
    expect(state.states).toHaveLength(2);
    expect(state.actions).toEqual([rankClue(3, 0, [], 1)]);
    expect(state.stateActionLengths).toEqual([0, 1]);
    state = hypotheticalStateReducer(state, { type: "back" }, false, metadata);
    expect(state.ongoing).toBe(startingState);
    expect(state.actions).toEqual([]);
    expect(state.stateActionLengths).toEqual([0]);
    state = hypotheticalStateReducer(state, { type: "back" }, false, metadata);
    expect(state.states).toEqual([]);
    expect(state.ongoing).toBe(startingState);
    state = hypotheticalStateReducer(state, { type: "back" }, false, metadata);
    expect(state.states).toEqual([]);
    expect(state.ongoing).toBe(startingState);
  });

  test("retains ordinary actions and snapshots their lengths only when segments change", () => {
    const actions: readonly ActionIncludingHypothetical[] = [
      rankClue(3, 0, [], 1),
      discard(1, 5, 0, 1, false),
      draw(1, 10, 0, 2),
      { type: "strike", num: 4, order: 5 as CardOrder, turn: 1 },
    ];
    const state = initializeHypotheticalState(startingState, false, actions, false, metadata);
    expect(state.actions).toEqual(actions);
    expect(state.states).toHaveLength(3);
    expect(state.stateActionLengths).toEqual([0, 1, 3]);
    const restored = hypotheticalStateReducer(state, { type: "back" }, false, metadata);
    expect(restored.ongoing).toBe(state.states[1]);
    expect(restored.actions).toEqual(actions.slice(0, 1));
    expect(restored.stateActionLengths).toEqual([0, 1]);
    expect(state.actions).toEqual(actions);
    // Draw bookkeeping and morphs survive Back, while legality uses the retained branch.
    expect(restored.drawnCardsInHypothetical).toEqual([10]);
    expect(restored.morphedIdentities[10]).toEqual({ suitIndex: null, rank: null });
    expect(canToggleHypotheticalDrawnCards(restored)).toBe(true);
  });

  test.each(["play", "discard", "clue"] as const)(
    "Back allows revealing again after removing a conflicting %s",
    (type) => {
      const initialActions = [
        rankClue(3, 0, [], 1),
        rankClue(3, 1, [], 0),
        discard(0, 0, 0, 1, false),
        draw(0, 10, 0, 2),
      ];
      const beforeConflict = initializeHypotheticalState(
        startingState, false, initialActions, false, metadata,
      );
      expect(canToggleHypotheticalDrawnCards(beforeConflict)).toBe(true);
      const conflictActions = type === "clue"
        ? [rankClue(2, 1, [10], 0)]
        : [
          rankClue(3, 1, [], 0),
          type === "play" ? play(0, 10, 0, 2) : discard(0, 10, 0, 2, false),
          draw(0, 11, 0, 3),
        ];
      let state = beforeConflict;
      for (const action of conflictActions) {
        state = hypotheticalStateReducer(state, action, false, metadata);
      }
      expect(canToggleHypotheticalDrawnCards(state)).toBe(false);
      const restored = hypotheticalStateReducer(state, { type: "back" }, false, metadata);
      expect(restored.actions).toEqual(type === "clue"
        ? initialActions : [...initialActions, conflictActions[0]]);
      expect(restored.stateActionLengths.at(-1)).toBe(restored.actions.length);
      expect(restored.drawnCardsInHypothetical).toContain(10);
      expect(canToggleHypotheticalDrawnCards(restored)).toBe(true);
    },
  );

  test("accepts and retains hypothetical strikes above three", () => {
    const actions: readonly ActionIncludingHypothetical[] = Array.from({ length: 5 }, (_, i) => ({
      type: "strike", num: i + 1, order: i as CardOrder, turn: i,
    }));
    const state = initializeHypotheticalState(startingState, false, actions, false, metadata);
    expect(state.actions).toEqual(actions);
    expect(state.ongoing.strikes.map(({ order }) => order)).toEqual([0, 1, 2, 3, 4]);
    expect(state.states).toEqual([startingState]);
    expect(state.stateActionLengths).toEqual([0]);
  });

  test.each([false, true])(
    "uses the real game reducer with finished = %s",
    (finished) => {
      const initial = initializeHypotheticalState(
        startingState,
        false,
        [],
        finished,
        metadata,
      );
      const reducer = jest.spyOn(gameReducerModule, "gameReducer");
      try {
        let state = hypotheticalStateReducer(
          initial,
          { type: "morph", order: 0 as CardOrder, suitIndex: -1, rank: -1 },
          finished,
          metadata,
        );
        state = hypotheticalStateReducer(
          state,
          { type: "unmorph", order: 0 as CardOrder },
          finished,
          metadata,
        );
        expect(reducer).not.toHaveBeenCalled();
        const action = draw(0, startingState.deck.length, 0, 1);
        hypotheticalStateReducer(state, action, finished, metadata);
        expect(reducer).toHaveBeenCalledTimes(1);
        // The first argument is an Immer draft that is revoked after the transition.
        expect(reducer.mock.calls[0]?.slice(1)).toEqual([
          action,
          true,
          false,
          finished,
          true,
          metadata,
        ]);
      } finally {
        reducer.mockRestore();
      }
    },
  );
});
