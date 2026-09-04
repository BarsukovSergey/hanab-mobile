import { describe, expect, test } from '@jest/globals';

import { appendNoteToken, beginNoteEdit, normalizeSubmittedNote } from './noteEditing';

describe('noteEditing', () => {
  test('appends a web-style separator when editing an existing note', () => {
    expect(beginNoteEdit('f')).toBe('f | ');
    expect(beginNoteEdit('f   ')).toBe('f | ');
    expect(beginNoteEdit('')).toBe('');
  });

  test('does not duplicate an existing separator', () => {
    expect(beginNoteEdit('f |')).toBe('f |');
    expect(beginNoteEdit('f |   ')).toBe('f |');
  });

  test('trims a trailing separator on submit', () => {
    expect(normalizeSubmittedNote('f | ')).toBe('f');
    expect(normalizeSubmittedNote('f | cm |')).toBe('f | cm');
  });

  test('appends quick tokens without inventing parser semantics', () => {
    expect(appendNoteToken('', 'f')).toBe('f');
    expect(appendNoteToken('f', 'cm')).toBe('f | cm');
    expect(appendNoteToken('f |', 'ptd')).toBe('f | ptd');
  });
});
