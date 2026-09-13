import { describe, expect, test } from '@jest/globals';

import { getInitialCardState } from '../upstream/reducers/initialStates/initialCardState';
import { getDefaultVariant } from '../upstream/gameData';
import type { CardState } from '../upstream/interfaces/CardState';
import { cardOrder } from '../upstream/types/CardOrder';
import { getNoteImpossibilityWarning } from './noteImpossibility';

const variant = getDefaultVariant();

function ownCard(possibleCardsForEmpathy: CardState['possibleCardsForEmpathy']): CardState {
  return {
    ...getInitialCardState(cardOrder.parse(0), variant, 2),
    location: 0,
    possibleCardsForEmpathy,
  };
}

function warning(noteText: string, card: CardState): string | null {
  return getNoteImpossibilityWarning({
    card,
    noteText,
    ourPlayerIndex: 0,
    variantName: variant.name,
  });
}

describe('getNoteImpossibilityWarning', () => {
  test('does not warn for an empty or non-identity note', () => {
    const card = ownCard([[0, 1]]);

    expect(warning('', card)).toBeNull();
    expect(warning('remember tempo [f]', card)).toBeNull();
  });

  test('does not warn when one stated identity remains possible via empathy', () => {
    expect(warning('r1,y2', ownCard([[1, 2]]))).toBeNull();
  });

  test('warns for one impossible identity', () => {
    expect(warning('r1', ownCard([[1, 2]])))
      .toBe('That card cannot possibly be red 1');
  });

  test('warns for multiple impossible identities', () => {
    expect(warning('r1,y2', ownCard([[2, 3]])))
      .toBe('That card cannot possibly be any of red 1, yellow 2');
  });

  test('does not warn for an opponent-hand card', () => {
    const card: CardState = { ...ownCard([[1, 2]]), location: 1 };

    expect(warning('r1', card)).toBeNull();
  });
});
