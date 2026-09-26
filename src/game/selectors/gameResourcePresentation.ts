import type { GameState } from '../bootstrap/types';
import { getVariant } from '../upstream/gameData';
import { getAdjustedClueTokens, isAtMaxClueTokens } from '../upstream/rules/clueTokens';

export type ClueResourceCue = 'default' | 'no-clues' | 'one-clue' | 'max-clues';
export type DiscardResourceCue = 'default' | 'blocked' | 'double-discard';

export type GameResourcePresentation = {
  clueCue: ClueResourceCue;
  discardCue: DiscardResourceCue;
};

export function getGameResourcePresentation({
  game,
  variantName,
  hyphenatedConventions,
  realLifeMode,
  showResourceCues,
}: {
  game: GameState;
  variantName: string;
  hyphenatedConventions: boolean;
  realLifeMode: boolean;
  showResourceCues: boolean;
}): GameResourcePresentation {
  if (realLifeMode || !showResourceCues) {
    return { clueCue: 'default', discardCue: 'default' };
  }

  const variant = getVariant(variantName);
  const noClues = game.clueTokens < getAdjustedClueTokens(1, variant);
  const maxClues = isAtMaxClueTokens(game.clueTokens, variant);
  const clueCue: ClueResourceCue = noClues
    ? 'no-clues'
    : game.clueTokens === getAdjustedClueTokens(1, variant)
      ? 'one-clue'
      : maxClues ? 'max-clues' : 'default';
  const discardCue: DiscardResourceCue = maxClues
    ? 'blocked'
    : hyphenatedConventions && game.stats.doubleDiscardCard !== null
      ? 'double-discard'
      : 'default';

  return { clueCue, discardCue };
}
