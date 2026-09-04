import { describe, expect, test } from '@jest/globals';

import { getCardKnowledgeViewModel } from '../../../game/selectors/cardKnowledge';
import { getCluePreview } from '../../../game/selectors/cluePreview';
import { getLastCluePresentation } from '../../../game/selectors/lastClue';
import { getCommittedClueMarkerForMetadata } from '../clueIndication';
import { getGameplayLayout } from '../gameplayLayout';
import {
  clueFlowFixtureOrders,
  getClueFlowScenarios,
  getGameplayScenarios,
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

  test('runs canonical viewport targets through the production layout calculation', () => {
    const expectedOrientations = new Map<string, 'portrait' | 'landscape'>([
      ['three-player-base', 'portrait'],
      ['clue-preview-source', 'portrait'],
      ['clue-committed', 'portrait'],
      ['clue-retouched-quacker', 'portrait'],
      ['clue-cleanup-after-discard', 'landscape'],
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
