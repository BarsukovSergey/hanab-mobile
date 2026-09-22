import { describe, expect, test } from '@jest/globals';

import { composeQuickNote } from '../../game/selectors/noteComposition';
import { beginNoteEdit, normalizeSubmittedNote, prependTurnToNote } from './noteEditing';

describe('noteEditing', () => {
  test('starts a new interpretation for a non-empty saved note', () => {
    expect(beginNoteEdit('f')).toBe('f | ');
    expect(beginNoteEdit('f | cm')).toBe('f | cm | ');
    expect(beginNoteEdit('')).toBe('');
  });

  test('does not rewrite existing upstream note syntax before the new pipe', () => {
    expect(beginNoteEdit('[r2] [f]')).toBe('[r2] [f] | ');
    expect(beginNoteEdit('reasoning | cm')).toBe('reasoning | cm | ');
  });

  test('normalizes outer whitespace and removes an unused trailing interpretation pipe on submit', () => {
    expect(normalizeSubmittedNote('  [r2] [f]  ')).toBe('[r2] [f]');
    expect(normalizeSubmittedNote('reasoning | cm | ')).toBe('reasoning | cm');
  });

  test('normalizes an unused edit separator before quick-token composition', () => {
    expect(composeQuickNote('No Variant', normalizeSubmittedNote(beginNoteEdit('abc')), 'cm'))
      .toBe('abc | [cm]');
    expect(composeQuickNote('No Variant', normalizeSubmittedNote(beginNoteEdit('[1] [f]')), 'cm'))
      .toBe('[1] [f] | [1] [cm]');
  });

  test('prepends current turn and replaces an existing leading turn marker', () => {
    expect(prependTurnToNote('f', 8)).toBe('#8 f');
    expect(prependTurnToNote('#4 f', 8)).toBe('#8 f');
    expect(prependTurnToNote('', 8)).toBe('#8');
  });
});
