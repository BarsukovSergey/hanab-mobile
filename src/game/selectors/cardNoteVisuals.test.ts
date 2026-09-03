import { describe, expect, it } from '@jest/globals';

import { getHandCardBorderColor, type CardNoteVisual } from './cardNoteVisuals';

const empty: CardNoteVisual = {
  hasText: false,
  clued: false,
  unclued: false,
  chopMoved: false,
  finessed: false,
  discardPermission: false,
  knownTrash: false,
  needsFix: false,
  questionMark: false,
  exclamationMark: false,
};

describe('hand card note border precedence', () => {
  it('matches upstream clue/finesse/discard/chop precedence', () => {
    expect(getHandCardBorderColor(true, empty)).toBe('orange');
    expect(getHandCardBorderColor(true, { ...empty, unclued: true })).toBeNull();
    expect(getHandCardBorderColor(false, { ...empty, clued: true, finessed: true })).toBe('orange');
    expect(getHandCardBorderColor(false, { ...empty, finessed: true, discardPermission: true, chopMoved: true })).toBe('aqua');
    expect(getHandCardBorderColor(false, { ...empty, discardPermission: true, chopMoved: true })).toBe('#812020');
    expect(getHandCardBorderColor(false, { ...empty, chopMoved: true })).toBe('#fffce6');
  });
});
