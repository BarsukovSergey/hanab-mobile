import { describe, expect, test } from '@jest/globals';

import { getCluePreview, isCluePreviewConfirmable } from '../../../game/selectors/cluePreview';
import { getGameplayClueChoicesForPlayer } from '../../../game/selectors/gameplay';
import { getEmptyClueGalleryScenarios } from './emptyClueGalleryScenarios';

describe('Empty Clues acceptance', () => {
  test('uses authoritative option to decide whether a zero-touch clue can be confirmed', () => {
    const scenarios = new Map(getEmptyClueGalleryScenarios().map((scenario) => [scenario.id, scenario]));
    const disabled = liveRoom(scenarios, 'empty-clue-off');
    const enabled = liveRoom(scenarios, 'empty-clue-on');

    const disabledPreview = getCluePreview(
      disabled.clientState.ongoingGame,
      disabled.clientState.metadata.options.variantName,
      1,
      'color',
      0,
    );
    const enabledPreview = getCluePreview(
      enabled.clientState.ongoingGame,
      enabled.clientState.metadata.options.variantName,
      1,
      'color',
      0,
    );

    expect(disabledPreview?.touchedOrders).toEqual([]);
    expect(enabledPreview?.touchedOrders).toEqual([]);

    const disabledChoices = getGameplayClueChoicesForPlayer(disabled.clientState.metadata);
    const enabledChoices = getGameplayClueChoicesForPlayer(enabled.clientState.metadata);
    expect(disabledChoices.allowEmptyClues).toBe(false);
    expect(enabledChoices.allowEmptyClues).toBe(true);

    expect(isCluePreviewConfirmable(disabledPreview, disabledChoices.allowEmptyClues, 'No Variant')).toBe(false);
    expect(isCluePreviewConfirmable(enabledPreview, enabledChoices.allowEmptyClues, 'No Variant')).toBe(true);
  });

  test('keeps both modifier states directly inspectable in the developer gallery fixtures', () => {
    const scenarios = getEmptyClueGalleryScenarios();
    expect(scenarios.map((scenario) => scenario.id)).toEqual(['empty-clue-off', 'empty-clue-on']);
    expect(scenarios.every((scenario) => scenario.expectedInteraction.clueTarget === 1)).toBe(true);
    expect(scenarios.every((scenario) => scenario.expectedInteraction.cluePreview?.type === 'color')).toBe(true);
  });
});

function liveRoom(
  scenarios: ReadonlyMap<string, ReturnType<typeof getEmptyClueGalleryScenarios>[number]>,
  id: string,
) {
  const scenario = scenarios.get(id);
  if (scenario === undefined) throw new Error(`Missing Empty Clues scenario ${id}.`);
  const room = scenario.store.getState().room.room;
  if (room.kind !== 'live_game') throw new Error(`Expected live room for ${id}.`);
  return room;
}
