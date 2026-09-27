import { describe, expect, test } from '@jest/globals';

import { createSpecificSeedTableName } from './specificSeedName';

describe('createSpecificSeedTableName', () => {
  test('trims outer whitespace and constructs the upstream seed suffix name', () => {
    expect(createSpecificSeedTableName('  123  ')).toBe('!seed 123');
  });

  test('rejects a blank suffix and names over the table-name boundary', () => {
    expect(createSpecificSeedTableName('  ')).toBeNull();
    expect(createSpecificSeedTableName('x'.repeat(40))).toBeNull();
    expect(createSpecificSeedTableName('x'.repeat(39))).toBe(`!seed ${'x'.repeat(39)}`);
  });

  test('preserves suffix characters without validation or normalization', () => {
    expect(createSpecificSeedTableName('  bad suffix/!  ')).toBe('!seed bad suffix/!');
  });
});
