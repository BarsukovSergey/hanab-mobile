import { describe, expect, test } from '@jest/globals';

import { composeQuickNote } from './noteComposition';

describe('composeQuickNote', () => {
  test('ports upstream appendNote history behavior for identity plus finesse', () => {
    expect(composeQuickNote('No Variant', '1', 'f')).toBe('1 | [1] [f]');
    expect(composeQuickNote('No Variant', '[1]', 'f')).toBe('[1] | [1] [f]');
    expect(composeQuickNote('No Variant', 'r2', 'f')).toBe('r2 | [r2] [f]');
  });

  test('repeats the active pipe segment and appends a new semantic token', () => {
    expect(composeQuickNote('No Variant', 'old thought | 1', 'kt'))
      .toBe('old thought | 1 | [1] [kt]');
  });

  test('keeps prose in history while stripping it from the new active interpretation', () => {
    expect(composeQuickNote('No Variant', 'remember tempo', 'f'))
      .toBe('remember tempo | [f]');
  });

  test('replaces conflicting border tokens exactly like upstream appendNote', () => {
    expect(composeQuickNote('No Variant', '[1] [cm]', 'f'))
      .toBe('[1] [cm] | [1] [f]');
    expect(composeQuickNote('No Variant', '[1] [f]', 'cm'))
      .toBe('[1] [f] | [1] [cm]');
  });

  test('preserves compact web-style history when switching finesse to chop move', () => {
    const cm = composeQuickNote('No Variant', '[1][f]', 'cm');
    expect(cm).toBe('[1][f] | [1] [cm]');
    expect(composeQuickNote('No Variant', cm, 'f'))
      .toBe('[1][f] | [1] [cm] | [1] [f]');
  });

  test('does not update when the requested semantic meaning is already active', () => {
    expect(composeQuickNote('No Variant', '[1] [f]', 'f')).toBe('[1] [f]');
  });
});
