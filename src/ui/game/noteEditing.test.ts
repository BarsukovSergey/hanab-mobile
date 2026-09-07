import { describe, expect, test } from '@jest/globals';

import { beginNoteEdit, normalizeSubmittedNote } from './noteEditing';

describe('noteEditing', () => {
  test('starts editing from the exact saved note instead of creating a new pipe segment', () => {
    expect(beginNoteEdit('f')).toBe('f');
    expect(beginNoteEdit('f | cm')).toBe('f | cm');
    expect(beginNoteEdit('')).toBe('');
  });

  test('does not silently rewrite existing upstream note syntax', () => {
    expect(beginNoteEdit('[r2] [f]')).toBe('[r2] [f]');
    expect(beginNoteEdit('reasoning | cm')).toBe('reasoning | cm');
  });

  test('normalizes only outer whitespace on explicit submit', () => {
    expect(normalizeSubmittedNote('  [r2] [f]  ')).toBe('[r2] [f]');
    expect(normalizeSubmittedNote('reasoning | cm')).toBe('reasoning | cm');
  });
});
