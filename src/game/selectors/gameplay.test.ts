import { describe, expect, it } from '@jest/globals';

import {
  getClueColorFill,
  getDisplayedClueTokens,
  getGameplayPresentation,
  getGameTableSuits,
  getGameplayClueChoices,
  getGameplayClueChoicesForPlayerIndex,
  hasClueTokenForVariant,
  canDiscardForVariant,
  getDisplayedClockTime,
} from './gameplay';
import { PaceRisk } from '../upstream/enums/PaceRisk';

describe('getGameTableSuits', () => {
  it('counts down only the active clock and ignores timeTaken', () => {
    const clock = {
      times: [12_000, 9_000], activePlayerIndex: 0, timeTaken: 8_000, receivedAtMs: 1_000,
    };
    expect(getDisplayedClockTime(clock, 0, false, 4_500)).toBe(8_500);
    expect(getDisplayedClockTime(clock, 1, false, 4_500)).toBe(9_000);
    expect(getDisplayedClockTime(clock, 0, true, 99_000)).toBe(12_000);
    expect(getDisplayedClockTime(clock, 0, false, 0)).toBe(12_000);
  });
  it('uses upstream clue names for variant and character semantics', () => {
    expect(getGameplayClueChoices('Odds and Evens (5 Suits)').ranks).toEqual([
      { value: 1, label: 'Odd' }, { value: 2, label: 'Even' },
    ]);
    expect(getGameplayClueChoices('No Variant', 'Quacker').colors[0]?.label).toBe('Quack');
  });

  it('carries the Empty Clues modifier through clue presentation data', () => {
    expect(getGameplayClueChoices('No Variant').allowEmptyClues).toBe(false);
    expect(getGameplayClueChoices('No Variant', '', true).allowEmptyClues).toBe(true);
  });

  it('uses the actual clue giver character when presenting an authoritative clue', () => {
    const metadata = {
      options: { variantName: 'No Variant', emptyClues: false },
      ourPlayerIndex: 0,
      characterAssignments: [null, 34],
    } as unknown as Parameters<typeof getGameplayClueChoicesForPlayerIndex>[0];
    expect(getGameplayClueChoicesForPlayerIndex(metadata, 1).colors[0]?.label).toBe('Quack');
    expect(getGameplayClueChoicesForPlayerIndex(metadata, 0).colors[0]?.label).toBe('Red');
  });

  it('exposes exact variant clue fills without leaking upstream imports into UI', () => {
    expect(getClueColorFill('No Variant', 0)).toBe('#e60000');
    expect(getClueColorFill('No Variant', 99)).toBeNull();
  });

  it('maps authoritative play and discard orders to visible suit labels', () => {
    const game = {
      playStacks: [[0, 1], [], [], [], []],
      discardStacks: [[2], [3, 4], [], [], []],
      deck: [
        { suitIndex: 0, rank: 1 },
        { suitIndex: 0, rank: 2 },
        { suitIndex: 0, rank: 3 },
        { suitIndex: 1, rank: 1 },
        { suitIndex: 1, rank: 4 },
      ],
    } as unknown as Parameters<typeof getGameTableSuits>[1];

    const suits = getGameTableSuits('No Variant', game);

    expect(suits[0]).toEqual({
      suitIndex: 0,
      suitName: 'Red',
      topCardLabel: 'Red 2',
      discardCardLabels: ['Red 3'],
    });
    expect(suits[1]).toEqual({
      suitIndex: 1,
      suitName: 'Yellow',
      topCardLabel: null,
      discardCardLabels: ['Yellow 1', 'Yellow 4'],
    });
  });

  it('uses adjusted Clue Starved thresholds and unadjusted display values', () => {
    const variantName = 'Clue Starved (5 Suits)';
    expect(hasClueTokenForVariant(1, variantName)).toBe(false);
    expect(hasClueTokenForVariant(2, variantName)).toBe(true);
    expect(getDisplayedClueTokens(1, variantName)).toBe(0.5);
    expect(getDisplayedClueTokens(2, variantName)).toBe(1);
  });

  it('permits discards only below the upstream maximum clue-token threshold', () => {
    expect(canDiscardForVariant(7, 'No Variant')).toBe(true);
    expect(canDiscardForVariant(8, 'No Variant')).toBe(false);
    expect(canDiscardForVariant(15, 'Clue Starved (5 Suits)')).toBe(true);
    expect(canDiscardForVariant(16, 'Clue Starved (5 Suits)')).toBe(false);
  });

  it('applies notes and a manual modifier to the authoritative current game', () => {
    const presentation = getPresentation({ viewingOngoingGame: true });
    expect(presentation).toMatchObject({
      rawCardsGotten: 3,
      cardsGottenByNotes: 2,
      efficiencyModifier: 1,
      appliesEfficiencyModifier: true,
      cardsRemainingToGet: 19,
      remainingPossibleClues: 20.9,
      futureRequiredEfficiency: 19 / 20,
      currentEfficiency: 6 / 8,
      finessesRequired: 0,
    });
  });

  it('ignores notes and modifier while rewound in an unfinished game', () => {
    expect(getPresentation({ viewingOngoingGame: false })).toMatchObject({
      cardsGottenByNotes: null,
      efficiencyModifier: null,
      appliesEfficiencyModifier: false,
      cardsRemainingToGet: 22,
      futureRequiredEfficiency: 22 / 20,
      currentEfficiency: 3 / 8,
      finessesRequired: 2,
    });
  });

  it('applies adjustments to a finished shared replay following shared segments', () => {
    expect(getPresentation({ finished: true, sharedReplayUseSharedSegments: true }))
      .toMatchObject({ cardsRemainingToGet: 19, futureRequiredEfficiency: 19 / 20 });
  });

  it.each([
    ['detached shared replay', { finished: true, sharedReplayUseSharedSegments: false }],
    ['finished solo replay', { finished: true, sharedReplayUseSharedSegments: false }],
  ])('ignores adjustments in a %s', (_label, context) => {
    expect(getPresentation(context)).toMatchObject({
      cardsGottenByNotes: null,
      efficiencyModifier: null,
      cardsRemainingToGet: 22,
      futureRequiredEfficiency: 22 / 20,
    });
  });

  it('formats ordinary positive pace with a plus and retains risk', () => {
    expect(getPresentation({ pace: 2.5, paceRisk: PaceRisk.High })).toMatchObject({
      pace: '+2.5', paceRisk: PaceRisk.High,
    });
  });

  it.each([
    ['final round', { finalRoundEffectivelyStarted: true }, {}],
    ['All or Nothing', {}, { allOrNothing: true }],
    ['null pace', { pace: null }, {}],
  ])('suppresses pace and risk for %s', (_label, stats, options) => {
    expect(getPresentation({ stats, options })).toMatchObject({ pace: '-', paceRisk: null });
  });

  it('returns immutable minimum efficiency and keeps MRE available when FRE is unavailable', () => {
    const presentation = getPresentation({ cluesStillUsableNotRounded: 0 });
    expect(presentation.futureRequiredEfficiency).toBeNull();
    expect(presentation.minimumRequiredEfficiency).toBe(0.88);
    expect(`${presentation.futureRequiredEfficiency ?? '-'} | ${presentation.minimumRequiredEfficiency.toFixed(2)}`)
      .toBe('- | 0.88');
  });
});

function getPresentation({
  stats = {},
  options = {},
  ...context
}: {
  stats?: Record<string, unknown>;
  options?: Record<string, unknown>;
  finished?: boolean;
  viewingOngoingGame?: boolean;
  sharedReplayUseSharedSegments?: boolean;
  pace?: number | null;
  paceRisk?: PaceRisk;
  finalRoundEffectivelyStarted?: boolean;
  cluesStillUsableNotRounded?: number | null;
} = {}) {
  const game = {
    stats: {
      maxScore: 25,
      pace: 1,
      paceRisk: PaceRisk.Low,
      finalRoundEffectivelyStarted: false,
      cardsGotten: 3,
      potentialCluesLost: 8,
      cluesStillUsableNotRounded: 20.9,
      cardsGottenByNotes: 2,
      ...stats,
      ...(context.pace === undefined ? {} : { pace: context.pace }),
      ...(context.paceRisk === undefined ? {} : { paceRisk: context.paceRisk }),
      ...(context.finalRoundEffectivelyStarted === undefined
        ? {} : { finalRoundEffectivelyStarted: context.finalRoundEffectivelyStarted }),
      ...(context.cluesStillUsableNotRounded === undefined
        ? {} : { cluesStillUsableNotRounded: context.cluesStillUsableNotRounded }),
    },
  } as unknown as Parameters<typeof getGameplayPresentation>[0];
  const selectorContext = {
    finished: false,
    viewingOngoingGame: false,
    sharedReplayUseSharedSegments: false,
    ...context,
  };
  return getGameplayPresentation(
    game,
    { allOrNothing: false, ...options } as Parameters<typeof getGameplayPresentation>[1],
    0.88,
    1,
    selectorContext,
  );
}
