import { describe, expect, test } from '@jest/globals';

import type { GameState } from '../bootstrap/types';
import { getVariant } from '../upstream/gameData';
import { DEFAULT_VARIANT_NAME, MAX_CLUE_NUM } from '../upstream/constants';
import { getAdjustedClueTokens, isAtMaxClueTokens } from '../upstream/rules/clueTokens';
import { getGameResourcePresentation } from './gameResourcePresentation';

function makeGame(clueTokens: number, doubleDiscardCard: number | null = null): GameState {
  return {
    clueTokens,
    stats: { doubleDiscardCard },
  } as GameState;
}

function present(
  clueTokens: number,
  options: {
    variantName?: string;
    hyphenatedConventions?: boolean;
    realLifeMode?: boolean;
    showResourceCues?: boolean;
    doubleDiscardCard?: number | null;
  } = {},
) {
  return getGameResourcePresentation({
    game: makeGame(clueTokens, options.doubleDiscardCard ?? null),
    variantName: options.variantName ?? DEFAULT_VARIANT_NAME,
    hyphenatedConventions: options.hyphenatedConventions ?? false,
    realLifeMode: options.realLifeMode ?? false,
    showResourceCues: options.showResourceCues ?? true,
  });
}

describe('getGameResourcePresentation', () => {
  const standard = getVariant(DEFAULT_VARIANT_NAME);

  test('selects standard clue resource cues using upstream thresholds', () => {
    const one = getAdjustedClueTokens(1, standard);
    const max = getAdjustedClueTokens(MAX_CLUE_NUM, standard);
    expect(present(one - 1).clueCue).toBe('no-clues');
    expect(present(one).clueCue).toBe('one-clue');
    expect(present(one + 1).clueCue).toBe('default');
    expect(present(max).clueCue).toBe('max-clues');
    expect(isAtMaxClueTokens(max, standard)).toBe(true);
  });

  test('suppresses all clue cues in real-life mode or when resource cues are hidden', () => {
    const max = getAdjustedClueTokens(MAX_CLUE_NUM, standard);
    expect(present(getAdjustedClueTokens(1, standard) - 1, { realLifeMode: true }).clueCue).toBe('default');
    expect(present(getAdjustedClueTokens(1, standard), { realLifeMode: true }).clueCue).toBe('default');
    expect(present(max, { realLifeMode: true }).clueCue).toBe('default');
    expect(present(getAdjustedClueTokens(1, standard) - 1, { showResourceCues: false }).clueCue).toBe('default');
    expect(present(getAdjustedClueTokens(1, standard), { showResourceCues: false }).clueCue).toBe('default');
    expect(present(max, { showResourceCues: false }).clueCue).toBe('default');
  });

  test('uses adjusted one-clue math for the vendored Clue Starved (5 Suits) variant', () => {
    const variantName = 'Clue Starved (5 Suits)';
    const variant = getVariant(variantName);
    const adjustedOneClue = getAdjustedClueTokens(1, variant);
    expect(variant.clueStarved).toBe(true);
    expect(adjustedOneClue).not.toBe(1);
    expect(present(adjustedOneClue, { variantName }).clueCue).toBe('one-clue');
    expect(present(1, { variantName }).clueCue).toBe('no-clues');
  });

  test('marks discard unavailable at maximum clues, ahead of Double Discard', () => {
    const max = getAdjustedClueTokens(MAX_CLUE_NUM, standard);
    expect(present(max).discardCue).toBe('blocked');
    expect(present(max, { doubleDiscardCard: 42, hyphenatedConventions: true }).discardCue).toBe('blocked');
  });

  test('marks only authoritative H-group Double Discard when discard is available', () => {
    const available = getAdjustedClueTokens(1, standard);
    expect(present(available, { doubleDiscardCard: 42, hyphenatedConventions: true }).discardCue).toBe('double-discard');
    expect(present(available, { doubleDiscardCard: 42, hyphenatedConventions: false }).discardCue).toBe('default');
    expect(present(available, { doubleDiscardCard: null, hyphenatedConventions: true }).discardCue).toBe('default');
  });

  test('suppresses discard cues in real-life mode and while resource cues are hidden', () => {
    const max = getAdjustedClueTokens(MAX_CLUE_NUM, standard);
    const available = getAdjustedClueTokens(1, standard);
    expect(present(max, { realLifeMode: true }).discardCue).toBe('default');
    expect(present(available, { realLifeMode: true, doubleDiscardCard: 42, hyphenatedConventions: true }).discardCue).toBe('default');
    expect(present(max, { showResourceCues: false }).discardCue).toBe('default');
    expect(present(available, { showResourceCues: false, doubleDiscardCard: 42, hyphenatedConventions: true }).discardCue).toBe('default');
  });
});
