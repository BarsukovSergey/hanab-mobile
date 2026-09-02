import { describe, expect, test } from '@jest/globals';

import { getDefaultMetadata } from '../../../upstream/metadata';
import { getVariant } from '../../../upstream/gameData';
import { getTotalCardsInDeck } from '../../../upstream/rules/deck';
import { initialState } from './initialState';

describe('headless initial notes state', () => {
  test('preallocates deck and stack-base note slots like pinned upstream', () => {
    const metadata = getDefaultMetadata(2, 'No Variant');
    const variant = getVariant(metadata.options.variantName);
    const expectedSize = getTotalCardsInDeck(variant) + variant.suits.length + 1;
    const state = initialState(metadata);

    expect(state.notes.ourNotes).toHaveLength(expectedSize);
    expect(state.notes.allNotes).toHaveLength(expectedSize);
    expect(state.notes.ourNotes[expectedSize - 1]).toEqual({
      possibilities: [],
      chopMoved: false,
      needsFix: false,
      questionMark: false,
      exclamationMark: false,
      knownTrash: false,
      finessed: false,
      discardPermission: false,
      blank: false,
      unclued: false,
      clued: false,
      text: '',
    });
    expect(state.notes.allNotes[expectedSize - 1]).toEqual([]);
  });
});
