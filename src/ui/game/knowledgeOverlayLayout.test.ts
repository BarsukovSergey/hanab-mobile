import { describe, expect, test } from '@jest/globals';

import { getKnowledgeOverlayMetrics } from './knowledgeOverlayLayout';

describe('getKnowledgeOverlayMetrics', () => {
  test('keeps full-size knowledge tokens comfortably readable', () => {
    expect(getKnowledgeOverlayMetrics(112, 5, 5)).toEqual({
      pipBox: 14,
      pipSize: 13,
      rankBox: 12,
      rankFontSize: 10,
    });
  });

  test('shrinks six suit pips enough to stay inside a dense card', () => {
    const metrics = getKnowledgeOverlayMetrics(68, 6, 5);
    expect(metrics.pipBox).toBeLessThanOrEqual(7);
    expect(metrics.pipSize).toBeLessThanOrEqual(6);
    expect(metrics.rankBox).toBeLessThanOrEqual(7);
  });

  test('uses available width rather than a fixed minimum that can overflow', () => {
    const roomy = getKnowledgeOverlayMetrics(112, 6, 5);
    const dense = getKnowledgeOverlayMetrics(60, 6, 5);
    expect(dense.pipBox).toBeLessThan(roomy.pipBox);
    expect(dense.rankBox).toBeLessThan(roomy.rankBox);
  });
});
