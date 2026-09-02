import { describe, expect, test } from '@jest/globals';

import type { MobileTableOptions } from '../protocol/lobbyProtocol';
import { toggleMobileTableBooleanOption } from './tableOptions';

const untimed: MobileTableOptions = {
  variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
  cardCycle: false, emptyClues: false, oneExtraCard: false,
  oneLessCard: false, allOrNothing: false,
};

describe('mobile timed option toggle', () => {
  test('enabling zero-valued timed options defaults to 120 / 20', () => {
    expect(toggleMobileTableBooleanOption(untimed, 'timed')).toMatchObject({
      timed: true, timeBase: 120, timePerTurn: 20,
    });
  });

  test('disabling timed resets both numeric fields to zero', () => {
    expect(toggleMobileTableBooleanOption({
      ...untimed, timed: true, timeBase: 300, timePerTurn: 45,
    }, 'timed')).toMatchObject({ timed: false, timeBase: 0, timePerTurn: 0 });
  });
});
