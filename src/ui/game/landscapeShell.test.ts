import { readFileSync } from 'node:fs';
import { expect, test } from '@jest/globals';

const app = readFileSync('App.tsx', 'utf8').replace(/\r\n/g, '\n');
const c17 = readFileSync('src/ui/game/C17GameScreen.tsx', 'utf8').replace(/\r\n/g, '\n');

test('App supplies the existing header into the landscape left pane without changing mounted game ownership', () => {
  expect(app).toContain('const gameHeader = (');
  expect(app).toContain('{!c17HeaderOwned && gameHeader}');
  expect(app).toContain('landscapeHeader={gameHeader}');
  const left = c17.slice(c17.indexOf('{landscapeHeader}'), c17.indexOf('style={[styles.landscapeLiveColumn'));
  expect(left).toContain('{temporalContext}');
  expect(left).toContain('landscapeLayout.rows.map');
  expect(c17).toContain('setLeftHeaderHeight(event.nativeEvent.layout.height)');
  expect(c17).toContain('leftHeaderHeight,');
  expect(c17).toContain('metricRowWidth: metricMeasurement.shellKey === shellKey');
});

test('right top row uses Score then original metrics with native full-value fit gating', () => {
  const strip = c17.slice(c17.indexOf('const metricStrip ='), c17.indexOf('const metricsReady ='));
  expect(strip.indexOf('<TableScore')).toBeLessThan(strip.indexOf('<HudStat label="Pace"'));
  expect(strip.indexOf('<HudStat label="Pace"')).toBeLessThan(strip.indexOf('<HudStat label="Efficiency"'));
  expect(strip).toContain('lowScorePhase: hGroupStatus.lowScorePhase, colorblindMode');
  expect(c17).toContain("measureMetric('actual', event)");
  expect(c17).toContain("measureMetric('maximum', event)");
  expect(c17).toContain('landscapeMetricsFit(landscapeLayout.rightWidth,');
  expect(c17).toContain('!landscapeLayout.fits || !metricsReady');
  expect(c17).toContain('shellMeasured && landscapeLayout.fits && metricsReady');
  expect(c17).toContain('accessibilityElementsHidden importantForAccessibility="no-hide-descendants"');
  expect(c17).toContain('pointerEvents={presentationVisible ? \'auto\' : \'none\'}');
});
