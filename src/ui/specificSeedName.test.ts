import { describe, expect, test } from '@jest/globals';

import { createSpecificSeedTableName, extractCanonicalHistorySeedSuffix } from './specificSeedName';

describe('extractCanonicalHistorySeedSuffix', () => {
  test('extracts only the exact canonical prefix and preserves suffix characters', () => {
    expect(extractCanonicalHistorySeedSuffix('p2v0s123', 2, 0)).toBe('123');
    expect(extractCanonicalHistorySeedSuffix('p2v0sAb-Cd9', 2, 0)).toBe('Ab-Cd9');
  });

  test('rejects noncanonical, mismatched, empty, and overlong seeds', () => {
    expect(extractCanonicalHistorySeedSuffix('p3v0s123', 2, 0)).toBeNull();
    expect(extractCanonicalHistorySeedSuffix('p2v1s123', 2, 0)).toBeNull();
    expect(extractCanonicalHistorySeedSuffix('p2v0s', 2, 0)).toBeNull();
    expect(extractCanonicalHistorySeedSuffix('JSON', 2, 0)).toBeNull();
    expect(extractCanonicalHistorySeedSuffix('legacy-seed', 2, 0)).toBeNull();
    expect(extractCanonicalHistorySeedSuffix('p2v0sFoo_Bar', 2, 0)).toBeNull();
    expect(extractCanonicalHistorySeedSuffix('p2v0sFoo Bar', 2, 0)).toBeNull();
    expect(extractCanonicalHistorySeedSuffix('p2v0sFoo/Bar', 2, 0)).toBeNull();
    expect(extractCanonicalHistorySeedSuffix('p2v0sFoo!Bar', 2, 0)).toBeNull();
    expect(extractCanonicalHistorySeedSuffix(`p2v0s${'x'.repeat(40)}`, 2, 0)).toBeNull();
  });
});

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
    expect(createSpecificSeedTableName('Foo_Bar')).toBe('!seed Foo_Bar');
    expect(createSpecificSeedTableName('AbC-123')).toBe('!seed AbC-123');
  });

  test('rejects an overlong suffix without truncating it into a different valid seed', () => {
    const suffix = 'x'.repeat(40);
    expect(createSpecificSeedTableName(suffix)).toBeNull();
    expect(suffix).toBe('x'.repeat(40));
  });
});
