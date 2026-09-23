import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

import { getC17HandRows } from './c17DenseLayout';
import { gameplayInteractionReducer, initialGameplayInteractionState } from './gameplayInteraction';

function readC17Screen() {
  return fs.readFileSync(path.join(process.cwd(), 'src/ui/game/C17GameScreen.tsx'), 'utf8');
}

function readC17Layout() {
  return fs.readFileSync(path.join(process.cwd(), 'src/ui/game/c17DenseLayout.ts'), 'utf8');
}

describe('C17 hypothetical seating and action-hand separation', () => {
  const hands = [[10, 11], [20, 21], [30, 31]] as const;

  test('keeps player 0 anchored while hypothetical actors 1 and 2 advance', () => {
    const normal = getC17HandRows(3, 0, 0);
    expect(normal).toEqual({
      opponentIndices: [1, 2],
      anchoredPlayerIndex: 0,
      actionHandIndex: 0,
      clueTargetIndices: [1, 2],
    });
    expect(hands[normal.actionHandIndex!]).toBe(hands[0]);

    const actorOne = getC17HandRows(3, 0, 1);
    expect(actorOne.opponentIndices).toEqual([1, 2]);
    expect(actorOne.anchoredPlayerIndex).toBe(0);
    expect(actorOne.actionHandIndex).toBe(1);
    expect(hands[actorOne.actionHandIndex!]).toBe(hands[1]);
    expect(actorOne.clueTargetIndices).toEqual([0, 2]);

    const selectedActorOneCard = gameplayInteractionReducer(
      initialGameplayInteractionState,
      { type: 'select-card', order: hands[1][0] },
    );
    expect(selectedActorOneCard.selectedCard).toBe(hands[1][0]);

    const actorTwo = getC17HandRows(3, 0, 2);
    expect(actorTwo.opponentIndices).toEqual([1, 2]);
    expect(actorTwo.anchoredPlayerIndex).toBe(0);
    expect(hands[actorTwo.actionHandIndex!]).toBe(hands[2]);
    expect(actorTwo.clueTargetIndices).toEqual([0, 1]);

    const advanced = gameplayInteractionReducer(selectedActorOneCard, {
      type: 'sync-hands',
      ownOrders: hands[2],
      clueTargets: actorTwo.clueTargetIndices,
      empathyPlayers: [0, 1, 2],
      visibleOrders: hands.flat(),
    });
    expect(advanced.selectedCard).toBeNull();
  });

  test('keeps the anchored bottom row actionable when actor is player 0', () => {
    const actorZero = getC17HandRows(3, 0, 0);

    expect(actorZero.opponentIndices).toEqual([1, 2]);
    expect(actorZero.anchoredPlayerIndex).toBe(0);
    expect(actorZero.actionHandIndex).toBe(0);
    expect(hands[actorZero.actionHandIndex!]).toBe(hands[0]);
    expect(actorZero.clueTargetIndices).toEqual([1, 2]);
  });

  test('wires stable seating separately from hypothetical action semantics', () => {
    const screen = readC17Screen();
    const layout = readC17Layout();

    expect(screen).toContain('const seatingAnchorIndex = clientState?.metadata.ourPlayerIndex ?? null;');
    expect(screen).toContain('const actionHandIndex = hypotheticalActive ? hypotheticalActor : seatingAnchorIndex;');
    expect(screen).toContain('game?.hands[actionHandIndex] ?? []');
    expect(screen).toContain('getC17HandRows(metadata.playerNames.length, seatingAnchorIndex, actionHandIndex).opponentIndices');
    expect(layout).toContain('opponentIndices: getRelativeOpponentIndices(playerCount, seatingAnchorIndex)');
    expect(screen).toContain('seatingAnchorIndex={seatingAnchorIndex}');
    expect(screen).not.toContain('ourIndex={actionHandIndex ?? ourIndex}');
    expect(screen).toContain('const isActionHand = actionHandIndex === index;');
    expect(screen).toContain('onSelect={() => onSelectCard(order)}');
    expect(screen).toContain('if (canEnterClue && !isActionHand) onSelectClueTarget(index);');
    expect(screen).toContain('if (canEnterClue && !anchoredIsActionHand) onSelectClueTarget(seatingAnchorIndex);');
    expect(screen).toContain("{isSpectator ? 'OBSERVED' : usesSideLabelRows ? 'YOU' : 'YOUR HAND'}");
    expect(screen).not.toContain('`ACTOR · ${metadata.playerNames');
    expect(screen).toContain('lobbyRuntime.hypotheticalPlay(selectedCard)');
    expect(screen).toContain('lobbyRuntime.hypotheticalDiscard(selectedCard)');
    expect(screen).toContain('lobbyRuntime.hypotheticalColorClue(selectedTarget, interaction.cluePreview.value)');
    expect(screen).toContain('lobbyRuntime.hypotheticalRankClue(selectedTarget, interaction.cluePreview.value)');
  });
});
