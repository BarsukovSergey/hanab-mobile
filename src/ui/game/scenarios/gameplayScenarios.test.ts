import { describe, expect, test } from '@jest/globals';

import { getCardKnowledgeViewModel } from '../../../game/selectors/cardKnowledge';
import { getCluePreview } from '../../../game/selectors/cluePreview';
import { getLastCluePresentation } from '../../../game/selectors/lastClue';
import { getCommittedClueMarkerForMetadata } from '../clueIndication';
import {
  gameplayInteractionReducer,
  initialGameplayInteractionState,
} from '../gameplayInteraction';
import { getGameplayLayout } from '../gameplayLayout';
import { getLiveNoteOrders } from '../liveNoteOrders';
import {
  clueFlowFixtureOrders,
  getClueFlowScenarios,
  getGameplayScenarios,
  getNoteFlowScenarios,
  noteFlowFixture,
} from './gameplayScenarios';

describe('gameplay scenario harness', () => {
  const scenarios = getGameplayScenarios();

  test('keeps canonical ids unique and bootstraps every scenario through the real headless client', () => {
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(scenarios.length);

    for (const scenario of scenarios) {
      const room = scenario.store.getState().room.room;
      expect(room.kind).toBe('live_game');
      if (room.kind !== 'live_game') continue;
      expect(room.clientState.visibleState).not.toBeNull();
      expect(room.clientState.visibleState).toBe(room.clientState.ongoingGame);
      expect(room.clientState.ongoingGame.turn.currentPlayerIndex).toBe(scenario.expectedCurrentPlayerIndex);
    }
  });

  test('keeps scenario stores isolated from one another', () => {
    const stores = scenarios.map((scenario) => scenario.store);
    expect(new Set(stores).size).toBe(stores.length);
  });

  test('contains a deterministic one-card clue preview source', () => {
    const scenario = scenarios.find((candidate) => candidate.id === 'clue-preview-source');
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;
    const room = scenario.store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live clue-preview scenario.');
    const game = room.clientState.visibleState;
    if (game === null) throw new Error('Expected visible clue-preview game.');

    const previewState = scenario.expectedInteraction.cluePreview;
    const target = scenario.expectedInteraction.clueTarget;
    expect(previewState).not.toBeNull();
    expect(target).toBe(1);
    if (previewState === null || target === null) return;

    const preview = getCluePreview(
      game,
      room.clientState.metadata.options.variantName,
      target,
      previewState.type,
      previewState.value,
    );
    expect(preview?.touchedOrders).toEqual([clueFlowFixtureOrders.bobRed]);
  });

  test('captures authoritative clue persistence, giver semantics, retouch, and cleanup', () => {
    const clueFlow = new Map(getClueFlowScenarios().map((scenario) => [scenario.id, scenario]));
    const committed = liveScenario(clueFlow, 'clue-committed');
    const retouched = liveScenario(clueFlow, 'clue-retouched-quacker');
    const cleaned = liveScenario(clueFlow, 'clue-cleanup-after-discard');
    const order = clueFlowFixtureOrders.bobRed;

    const committedClue = getLastCluePresentation(committed.clientState.replay.actions);
    expect(committedClue).toMatchObject({
      giverPlayerIndex: 0,
      targetPlayerIndex: 1,
      clueType: 'color',
      value: 0,
      touchedOrders: [order],
    });
    const committedCard = committed.clientState.ongoingGame.deck[order];
    expect(committedCard).toBeDefined();
    if (committedCard === undefined) return;
    expect(committedCard.numPositiveClues).toBe(1);
    expect(getCardKnowledgeViewModel(
      committed.clientState.metadata.options.variantName,
      committedCard,
    ).borderColor).toBe('orange');
    expect(getCommittedClueMarkerForMetadata(
      committedClue,
      order,
      committedCard.numPositiveClues,
      committed.clientState.metadata,
    )).toMatchObject({ label: 'Red', retouched: false });

    const retouchedClue = getLastCluePresentation(retouched.clientState.replay.actions);
    expect(retouchedClue?.giverPlayerIndex).toBe(2);
    const retouchedCard = retouched.clientState.ongoingGame.deck[order];
    expect(retouchedCard).toBeDefined();
    if (retouchedCard === undefined) return;
    expect(retouchedCard.numPositiveClues).toBe(2);
    expect(getCommittedClueMarkerForMetadata(
      retouchedClue,
      order,
      retouchedCard.numPositiveClues,
      retouched.clientState.metadata,
    )).toMatchObject({ label: 'Quack', retouched: true });

    expect(getLastCluePresentation(cleaned.clientState.replay.actions)).toBeNull();
    const cleanedCard = cleaned.clientState.ongoingGame.deck[order];
    expect(cleanedCard).toBeDefined();
    if (cleanedCard === undefined) return;
    expect(cleanedCard.numPositiveClues).toBe(2);
    expect(getCardKnowledgeViewModel(
      cleaned.clientState.metadata.options.variantName,
      cleanedCard,
    ).borderColor).toBe('orange');
  });

  test('captures opponent note save, turn persistence, and live-editor cleanup after the card leaves hand', () => {
    const noteFlow = new Map(getNoteFlowScenarios().map((scenario) => [scenario.id, scenario]));
    const source = liveScenario(noteFlow, 'note-edit-source');
    const saved = liveScenario(noteFlow, 'note-saved');
    const advanced = liveScenario(noteFlow, 'note-survives-turn');
    const leftHand = liveScenario(noteFlow, 'note-card-left-hand');
    const order = noteFlowFixture.opponentOrder;

    expect(source.clientState.ongoingGame.hands[1]).toContain(order);
    expect(source.clientState.notes.ourNotes[order]?.text ?? '').toBe('');

    const replayLength = saved.clientState.replay.actions.length;
    expect(saved.clientState.notes.ourNotes[order]?.text).toBe(noteFlowFixture.text);
    expect(replayLength).toBe(source.clientState.replay.actions.length);
    expect(saved.clientState.ongoingGame.hands[1]).toContain(order);

    expect(advanced.clientState.notes.ourNotes[order]?.text).toBe(noteFlowFixture.text);
    expect(advanced.clientState.ongoingGame.hands[1]).toContain(order);
    expect(advanced.clientState.replay.actions).toHaveLength(replayLength + 1);

    expect(leftHand.clientState.notes.ourNotes[order]?.text).toBe(noteFlowFixture.text);
    expect(leftHand.clientState.ongoingGame.hands[1]).not.toContain(order);
    expect(leftHand.clientState.ongoingGame.discardStacks[0]).toContain(order);
    expect(leftHand.clientState.ongoingGame.hands[1]).toContain(15);

    const opened = {
      ...initialGameplayInteractionState,
      noteCard: order,
    };
    const synchronized = gameplayInteractionReducer(opened, {
      type: 'sync-hands',
      ownOrders: leftHand.clientState.ongoingGame.hands[0] ?? [],
      clueTargets: [1, 2],
      visibleOrders: getLiveNoteOrders(leftHand.clientState.ongoingGame),
    });
    expect(synchronized.noteCard).toBeNull();
  });

  test('keeps empathy momentary while rendering the upstream owner-perspective knowledge in stable geometry', () => {
    const clueFlow = new Map(getClueFlowScenarios().map((scenario) => [scenario.id, scenario]));
    const committed = liveScenario(clueFlow, 'clue-committed');
    const game = committed.clientState.ongoingGame;
    const order = clueFlowFixtureOrders.bobRed;
    const card = game.deck[order];
    expect(card).toBeDefined();
    if (card === undefined) return;

    const variantName = committed.clientState.metadata.options.variantName;
    const normal = getCardKnowledgeViewModel(variantName, card, undefined, false);
    const empathy = getCardKnowledgeViewModel(variantName, card, undefined, false, true);
    expect(normal).toMatchObject({ displaySuitIndex: 0, displayRank: 1, borderColor: 'orange' });
    expect(empathy).toMatchObject({ displaySuitIndex: 0, displayRank: null, borderColor: 'orange' });
    expect(empathy.positiveColorLabels).toContain('Red');

    const layoutInput = {
      viewportWidth: 390,
      viewportHeight: 844,
      handSizes: game.hands.map((hand) => hand.length),
      ourPlayerIndex: committed.clientState.metadata.ourPlayerIndex,
    };
    const beforeHold = getGameplayLayout(layoutInput);
    const held = gameplayInteractionReducer(initialGameplayInteractionState, {
      type: 'hold-empathy',
      playerIndex: 1,
    });
    expect(held.empathyPlayer).toBe(1);
    expect(getGameplayLayout(layoutInput)).toEqual(beforeHold);

    const released = gameplayInteractionReducer(held, { type: 'hold-empathy', playerIndex: null });
    expect(released.empathyPlayer).toBeNull();
    const synchronized = gameplayInteractionReducer(held, {
      type: 'sync-hands',
      ownOrders: game.hands[0] ?? [],
      clueTargets: [1, 2],
      visibleOrders: getLiveNoteOrders(game),
    });
    expect(synchronized.empathyPlayer).toBeNull();
  });

  test('runs canonical viewport targets through the production layout calculation', () => {
    const expectedOrientations = new Map<string, 'portrait' | 'landscape'>([
      ['three-player-base', 'portrait'],
      ['clue-preview-source', 'portrait'],
      ['clue-committed', 'portrait'],
      ['clue-retouched-quacker', 'portrait'],
      ['clue-cleanup-after-discard', 'landscape'],
      ['note-edit-source', 'portrait'],
      ['note-saved', 'portrait'],
      ['note-survives-turn', 'portrait'],
      ['note-card-left-hand', 'landscape'],
      ['three-player-extra-card', 'portrait'],
      ['six-player-landscape', 'landscape'],
    ]);

    for (const scenario of scenarios) {
      const room = scenario.store.getState().room.room;
      if (room.kind !== 'live_game') throw new Error(`Missing live room for ${scenario.id}.`);
      const game = room.clientState.visibleState;
      if (game === null) throw new Error(`Missing visible game for ${scenario.id}.`);

      const layout = getGameplayLayout({
        viewportWidth: scenario.viewport.width,
        viewportHeight: scenario.viewport.height,
        handSizes: game.hands.map((hand) => hand.length),
        ourPlayerIndex: room.clientState.metadata.ourPlayerIndex,
      });

      expect(layout.orientation).toBe(expectedOrientations.get(scenario.id));
      expect(layout.ownCardHeight).toBeGreaterThan(0);
      expect(layout.opponentCardHeight).toBeGreaterThan(0);
      expect(layout.ownCardHeight).toBeGreaterThanOrEqual(layout.opponentCardHeight);
    }
  });

  test('keeps the dense six-player fixture honest', () => {
    const scenario = scenarios.find((candidate) => candidate.id === 'six-player-landscape');
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;
    const room = scenario.store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live six-player scenario.');
    const game = room.clientState.visibleState;
    if (game === null) throw new Error('Expected visible six-player game.');

    expect(room.clientState.metadata.playerNames).toHaveLength(6);
    expect(game.hands).toHaveLength(6);
    expect(game.hands.map((hand) => hand.length)).toEqual([4, 4, 4, 4, 4, 4]);
  });
});

function liveScenario(
  scenarios: ReadonlyMap<string, ReturnType<typeof getGameplayScenarios>[number]>,
  id: string,
) {
  const scenario = scenarios.get(id);
  if (scenario === undefined) throw new Error(`Missing scenario ${id}.`);
  const room = scenario.store.getState().room.room;
  if (room.kind !== 'live_game') throw new Error(`Expected live room for ${id}.`);
  return room;
}
