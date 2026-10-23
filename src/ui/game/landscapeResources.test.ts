import { readFileSync } from 'node:fs';
import { expect, test } from '@jest/globals';
import { getC17LandscapeLayout } from './c17LandscapeLayout';
import { getLandscapeLastActionHeight, getLandscapeResourceEnvelope } from './landscapeResources';

test('resource allocation enlarges faces within its own envelope and preserves primary-action reserve', () => {
  for (const fontScale of [1, 1.3, 1.5, 2]) {
    for (const suitCount of [3, 5, 6, 8]) {
      const resources = getLandscapeResourceEnvelope(fontScale, suitCount);
      expect(resources.discardCardHeight).toBe(36);
      expect(resources.discardCardHeight + 6).toBeLessThanOrEqual(resources.discardHeight);
      for (const playerCount of [2, 3, 4, 5, 6]) {
        const layout = getC17LandscapeLayout({ availableWidth: 1200, availableHeight: 600, fontScale,
          playerCount, cardsPerHand: 5, ownHandPosition: 'bottom', seatingAnchorIndex: 0,
          leftHeaderHeight: 78, suitCount });
        expect(layout.fits).toBe(true);
        if (!layout.fits) throw new Error(layout.reason);
        expect(layout.rightWidth).toBeGreaterThanOrEqual(resources.minimumWidth);
        expect(layout.workbenchHeight).toBeGreaterThanOrEqual(128);
        expect(layout.cardHeight).toBeGreaterThanOrEqual(68);
      }
    }
  }
  expect(getLandscapeResourceEnvelope(1, 5).height).toBe(92);
  expect(getLandscapeResourceEnvelope(1, 8).minimumWidth).toBeGreaterThan(252);
  expect(getLandscapeLastActionHeight(1)).toBe(28);
  expect(getLandscapeLastActionHeight(1.5)).toBe(42);
});

test('landscape Last Action preserves full accessible event/history and moves secondary controls to Workbench', () => {
  const screen = readFileSync('src/ui/game/C17GameScreen.tsx', 'utf8');
  const lastAction = screen.slice(screen.indexOf('const lastActionPanel ='), screen.indexOf('const cardActions ='));
  expect(lastAction).toContain('accessibilityLabel={lastAction}');
  expect(lastAction).toContain('accessibilityHint="Opens detailed Recent actions and history"');
  expect(lastAction).toContain('onPress={() => setRecentOpen(true)}');
  expect(lastAction).toContain('ellipsizeMode="tail" numberOfLines={portraitV2 ? undefined : 1}');
  expect(lastAction).not.toContain('adjustsFontSizeToFit');
  expect(lastAction).toContain('{portraitV2 && <View');
  const workbench = screen.slice(screen.indexOf('const workbench = ('), screen.lastIndexOf('return <View style={styles.workspace}'));
  expect(workbench).toContain('!portraitV2 || !shellMeasured || showWorkbench');
  expect(workbench).toContain('title="Rewind" onPress={() => takeWorkbenchTask(onEnterRewind)}');
  expect(workbench).toContain('onPress={onToggleGlobalEmpathy}');
});
