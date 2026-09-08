import { describe, expect, test } from '@jest/globals';

import { getWebRankPipLayout, getWebSuitPipLayout } from './knowledgeOverlayLayout';

describe('web knowledge overlay geometry', () => {
  test('lays five suit pips around the center instead of in a tiny strip', () => {
    const top = getWebSuitPipLayout(112, 0, 5);
    const right = getWebSuitPipLayout(112, 1, 5);
    const bottom = getWebSuitPipLayout(112, 3, 5);

    expect(top.size).toBeGreaterThan(20);
    expect(top.top).toBeLessThan(30);
    expect(right.left).toBeLessThan(top.left);
    expect(bottom.top).toBeGreaterThan(top.top);
  });

  test('scales suit geometry with card height', () => {
    const roomy = getWebSuitPipLayout(112, 2, 6);
    const dense = getWebSuitPipLayout(56, 2, 6);

    expect(dense.size).toBeCloseTo(roomy.size / 2, 5);
    expect(dense.left).toBeCloseTo(roomy.left / 2, 5);
    expect(dense.top).toBeCloseTo(roomy.top / 2, 5);
  });

  test('uses the upstream five-rank bottom-row geometry', () => {
    const one = getWebRankPipLayout(112, 1, 5);
    const five = getWebRankPipLayout(112, 5, 5);

    expect(one.top).toBeCloseTo(90.72, 5);
    expect(five.left).toBeGreaterThan(one.left);
    expect(one.fontSize).toBeGreaterThan(one.boxSize);
  });
});
