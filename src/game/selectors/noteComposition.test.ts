import { describe, expect, test } from '@jest/globals';

import { composeQuickNote } from './noteComposition';

describe('composeQuickNote', () => {
  test('turns an identity note plus finesse into separate upstream keywords', () => {
    expect(composeQuickNote('No Variant', 'r2', 'f')).toBe('[r2] [f]');
  });

  test('preserves an existing semantic token while adding another one', () => {
    expect(composeQuickNote('No Variant', 'f', 'cm')).toBe('[f] [cm]');
    expect(composeQuickNote('No Variant', '[r2] [f]', 'kt')).toBe('[r2] [f] [kt]');
  });

  test('preserves prose that previously had no parser meaning', () => {
    expect(composeQuickNote('No Variant', 'remember tempo', 'f')).toBe('remember tempo [f]');
  });

  test('only edits the active segment after the final pipe', () => {
    expect(composeQuickNote('No Variant', 'old thought | cm', 'f')).toBe('old thought | [cm] [f]');
  });

  test('does not duplicate an already-active marker', () => {
    expect(composeQuickNote('No Variant', '[r2] [f]', 'f')).toBe('[r2] [f]');
  });

  test('refuses malformed bracket syntax instead of guessing', () => {
    expect(composeQuickNote('No Variant', '[r2', 'f')).toBeNull();
  });
});
