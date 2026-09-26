import { describe, expect, test } from '@jest/globals';

import type { GameState } from '../upstream/interfaces/GameState';
import { getHGroupStatusPresentation } from './hGroupStatusPresentation';

function game(overrides: Partial<GameState> = {}): GameState {
  return {
    score: 0,
    clueTokens: 1,
    turn: { currentPlayerIndex: 0 } as GameState['turn'],
    hands: [[0]] as unknown as GameState['hands'],
    deck: [{ numPositiveClues: 1 } as GameState['deck'][number]],
    stats: { doubleDiscardCard: null } as GameState['stats'],
    ...overrides,
  } as GameState;
}

function present(state: GameState, options: Partial<{
  hyphenatedConventions: boolean;
  realLifeMode: boolean;
  showCurrentPlayerCue: boolean;
}> = {}) {
  return getHGroupStatusPresentation({
    game: state,
    variantName: '4 Suits',
    hyphenatedConventions: options.hyphenatedConventions ?? true,
    colorblindMode: false,
    realLifeMode: options.realLifeMode ?? false,
    showCurrentPlayerCue: options.showCurrentPlayerCue ?? true,
  });
}

describe('H-group status presentation', () => {
  test('uses H-group only and the variant suit count for Low Score Phase', () => {
    expect(present(game({ score: 7 }), { hyphenatedConventions: false }).lowScorePhase).toBe(false);
    expect(present(game({ score: 7 })).lowScorePhase).toBe(true);
    expect(present(game({ score: 8 })).lowScorePhase).toBe(false);
    expect(present(game({ score: 9 })).lowScorePhase).toBe(false);
  });

  test('shows locked status only for the authoritative locked current hand', () => {
    expect(present(game()).currentPlayerCue).toBe('locked');
    expect(present(game(), { hyphenatedConventions: false }).currentPlayerCue).toBeNull();
    expect(present(game({ deck: [{ numPositiveClues: 0 } as GameState['deck'][number]] })).currentPlayerCue).toBeNull();
    expect(present(game({ turn: { currentPlayerIndex: null } as GameState['turn'] })).currentPlayerCue).toBeNull();
    expect(present(game(), { realLifeMode: true }).currentPlayerCue).toBeNull();
  });

  test('shows upstream Double Discard state when the hand is not locked', () => {
    const unlocked = game({
      deck: [{ numPositiveClues: 0 } as GameState['deck'][number]],
      stats: { doubleDiscardCard: 42 } as GameState['stats'],
    });
    expect(present(unlocked).currentPlayerCue).toBe('double-discard');
    expect(present(unlocked, { hyphenatedConventions: false }).currentPlayerCue).toBeNull();
    expect(present(game({ ...unlocked, stats: { doubleDiscardCard: null } as GameState['stats'] })).currentPlayerCue).toBeNull();
    expect(present(unlocked, { realLifeMode: true }).currentPlayerCue).toBeNull();
  });

  test('prioritizes locked status and suppresses status when clue constraints take priority', () => {
    const both = game({ stats: { doubleDiscardCard: 42 } as GameState['stats'] });
    expect(present(both).currentPlayerCue).toBe('locked');
    expect(present(game({ clueTokens: 0, stats: { doubleDiscardCard: 42 } as GameState['stats'] })).currentPlayerCue).toBeNull();
    expect(present(game({ clueTokens: 8, stats: { doubleDiscardCard: 42 } as GameState['stats'] })).currentPlayerCue).toBeNull();
  });
});
