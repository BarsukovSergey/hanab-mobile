import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const read = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8');

test('global navigation belongs to authenticated browsing and uses responsive geometry', () => {
  const app = read('App.tsx');
  const nav = read('src/ui/BrowsingNavigation.tsx');
  expect(app).toContain("roomState.room.kind === 'none' && roomState.rematchTransition === null && !passwordTaskOpen");
  expect(app).toContain("windowClass !== 'compact'");
  expect(app).toContain('<BrowsingNavigation destination={browsing.destination} onNavigate={navigate} />');
  expect(app).not.toContain('<ActionButton compact title="Settings" tone="ghost"');
  for (const destination of ['Home', 'History', 'People', 'More']) expect(nav).toContain("label: '" + destination + "'");
  expect(nav).toContain("measureNavigation('bottom'");
  expect(nav).toContain("measureNavigation('rail'");
  expect(nav).toContain('accessibilityElementsHidden');
  expect(nav).toContain('pointerEvents="none"');
  expect(nav).toContain('styles.measurementLabel');
  expect(nav).toContain('COMPACT_ACTION_BUTTON_LABEL_STYLE');
  expect(nav).not.toContain('numberOfLines={1}');
  expect(nav).toContain('measureNavigation(\'bottom\', labelWidth, labelHeight, availableWidth)');
  expect(nav).toContain('measureNavigation(\'rail\', labelWidth, labelHeight)');
  expect(nav).not.toContain('64, 20');
});

test('More routes to current task owners and reads the repository version', () => {
  const app = read('App.tsx');
  const more = read('src/ui/screens/MoreScreen.tsx');
  expect(app).toContain("setGameLinkRequest((request) => request + 1)");
  expect(app).toContain('openGameLinkRequest={gameLinkRequest}');
  expect(app).toContain("onHistoryTools={() => navigate('history')}");
  const lobby = read('src/ui/screens/LobbyScreen.tsx');
  expect(lobby).toContain('if (openGameLinkRequest <= handledGameLinkRequest.current) return;');
  expect(lobby).toContain('setShowLiveGameLink(true);');
  expect(lobby).toContain('{showLiveGameLink && <Panel style={styles.linkPanel}>');
  expect(more).toContain("from '../../../package.json'");
  expect(more).toContain('Signed in as');
  expect(more).not.toContain('My Profile');
  expect(more).not.toContain('lobbyRuntime');
});
