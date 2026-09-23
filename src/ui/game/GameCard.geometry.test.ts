import { describe, expect, jest, test } from '@jest/globals';

jest.mock('./UpstreamCardFace', () => ({
  UpstreamCardFace: () => null,
}));

import { getCardGeometry } from './GameCard';

describe('game card geometry', () => {
  test('uses the same card radius for semantic borders at rendered mobile sizes', () => {
    for (const height of [56, 86, 112]) {
      const { radius } = getCardGeometry(height);

      expect(radius).toBeCloseTo((height * 286 / 406) * 0.12, 5);
      expect(radius).not.toBeCloseTo(6 * height / 406, 5);
    }
  });
});
