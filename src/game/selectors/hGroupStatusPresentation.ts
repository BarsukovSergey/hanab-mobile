import type { GameState } from '../upstream/interfaces/GameState';
import { getVariant } from '../upstream/gameData';
import { isAtMaxClueTokens } from '../upstream/rules/clueTokens';
import { isHandLocked } from '../upstream/rules/hand';
import { hasClueTokenForVariant } from './gameplay';

export type HGroupCurrentPlayerCue = 'locked' | 'double-discard';

export type HGroupStatusPresentation = {
  readonly lowScorePhase: boolean;
  readonly currentPlayerCue: HGroupCurrentPlayerCue | null;
};

export function getHGroupStatusPresentation(input: {
  readonly game: GameState;
  readonly variantName: string;
  readonly hyphenatedConventions: boolean;
  readonly colorblindMode: boolean;
  readonly realLifeMode: boolean;
  readonly showCurrentPlayerCue: boolean;
}): HGroupStatusPresentation {
  const { game, variantName, hyphenatedConventions } = input;
  const variant = getVariant(variantName);
  const lowScorePhase = hyphenatedConventions
    && game.score < variant.suits.length * 2;

  let currentPlayerCue: HGroupCurrentPlayerCue | null = null;
  const currentPlayerIndex = game.turn.currentPlayerIndex;
  if (hyphenatedConventions && input.showCurrentPlayerCue && !input.realLifeMode
    && currentPlayerIndex !== null
    && hasClueTokenForVariant(game.clueTokens, variantName)
    && !isAtMaxClueTokens(game.clueTokens, variant)) {
    const hand = game.hands[currentPlayerIndex];
    if (hand !== undefined && isHandLocked(hand, game.deck)) {
      currentPlayerCue = 'locked';
    } else if (game.stats.doubleDiscardCard !== null) {
      currentPlayerCue = 'double-discard';
    }
  }

  return { lowScorePhase, currentPlayerCue };
}
