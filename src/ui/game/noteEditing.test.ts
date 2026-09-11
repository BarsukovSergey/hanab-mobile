import { describe, expect, test } from '@jest/globals';

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

  test('prepends current turn and replaces an existing leading turn marker', () => {
    expect(prependTurnToNote('f', 8)).toBe('#8 f');
    expect(prependTurnToNote('#4 f', 8)).toBe('#8 f');
    expect(prependTurnToNote('', 8)).toBe('#8');
  });
});
