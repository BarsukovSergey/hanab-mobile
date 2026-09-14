import { describe, expect, test } from '@jest/globals';

import { getDiscardSummary } from '../../../game/selectors/discardSummary';
import { getGameTableSuits } from '../../../game/selectors/gameplay';
import { getCompactTableFireworkCellWidth, getCompactTableFireworksLayout } from '../tableLayout';
import { getTableSurfaceScenarios } from './gameplayScenarios';

describe('table surface acceptance', () => {
  test('renders a real six-suit authoritative surface with sixth firework and discard source', () => {
    const scenario = getTableSurfaceScenarios().find((candidate) => candidate.id === 'rainbow-table-surface');
    if (scenario === undefined) throw new Error('Missing rainbow-table-surface scenario.');
    const room = scenario.store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live rainbow table scenario.');

    const { metadata, ongoingGame } = room.clientState;
    expect(metadata.options.variantName).toBe('Rainbow (6 Suits)');
    const suits = getGameTableSuits(metadata.options.variantName, ongoingGame);
    expect(suits).toHaveLength(6);
    expect(suits[5]).toMatchObject({
      suitIndex: 5,
      suitName: 'Rainbow',
      topCardLabel: 'Rainbow 1',
    });
    expect(ongoingGame.playStacks[5]).toEqual([0]);

    const discard = getDiscardSummary(metadata.options.variantName, ongoingGame);
    expect(discard).toEqual({
      total: 1,
      suits: [{
        suitIndex: 0,
        suitName: 'Red',
        total: 1,
        unknownCount: 0,
        ranks: [{ rank: 1, count: 1 }],
      }],
    });
    expect(ongoingGame.discardStacks[0]).toEqual([5]);
  });

  test('fits all six fireworks inside canonical phone table widths', () => {
    for (const [width, landscapePhone] of [[286, false], [300, true]] as const) {
      const layout = getCompactTableFireworksLayout(width, 6, landscapePhone);
      expect(layout.stackHeight).toBeGreaterThan(0);
      expect(layout.stackWidth).toBeGreaterThan(0);
      expect(layout.usedWidth).toBeLessThanOrEqual(width + 0.001);
    }
  });

  test('applies the computed stack width to every production firework cell', () => {
    const layout = getCompactTableFireworksLayout(286, 6, false);

    expect(getCompactTableFireworkCellWidth(layout.stackWidth)).toBe(layout.stackWidth);
  });
});
