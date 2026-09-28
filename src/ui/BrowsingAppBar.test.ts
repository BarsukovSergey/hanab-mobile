import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const read = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8').replace(/\r\n/g, '\n');

test('fixed app bar owns browsing Back and keeps one complete Return control', () => {
  const app = read('App.tsx');
  const bar = read('src/ui/BrowsingAppBar.tsx');
  const start = app.indexOf('<View style={styles.browsingMain}>');
  expect(start).toBeGreaterThan(0);
  expect(app.indexOf('<BrowsingAppBar', start)).toBeLessThan(app.indexOf('<ScrollView ref={browsingScrollRef}', start));
  expect(app).toContain('{showBrowsingAppBar && <BrowsingAppBar');
  expect(app).toContain("presentationFocus === 'browsing'\n    && (probe === 'valid' || returnPresentation !== null)");
  expect(bar).toContain('minHeight: SURFACE_METRICS.primaryTouchTarget');
  expect(bar).toContain('returnPresentation.status');
  expect(bar).toContain('returnPresentation.action');
  expect(bar).not.toContain('numberOfLines={1}');
  expect(bar).toContain('accessibilityRole="button"');
  expect(bar).toContain('measureBrowsingAppBar(availableWidth');
  expect(bar).toContain('RETURN_STATUS_LABELS');
  expect(bar).toContain('RETURN_ACTION_LABELS');
  for (const label of ['Reconnecting', 'YOUR TURN', 'SHARED REVIEW', 'LIVE · T9999', 'Return to hypothetical']) expect(bar).toContain(label);
  expect(app).toContain('onBack={appBarBack}');
  expect(app).toContain('() => settingsBackRef.current?.()');
  expect(app).toContain('? backFromBrowsing : undefined;');
});

test('browsing hides embedded Back while room Settings keeps its own Back', () => {
  const app = read('App.tsx');
  for (const screen of ['HistoryScreen', 'PeopleScreen', 'MoreScreen', 'SettingsScreen']) {
    expect(read(`src/ui/screens/${screen}.tsx`)).toContain('showEmbeddedBack = true');
  }
  expect(app).toContain('<HistoryScreen roomOccupied={browsingRoomOccupied} showEmbeddedBack={false}');
  expect(app).toContain('<PeopleScreen onBack={() => navigate(\'home\')} roomOccupied={browsingRoomOccupied} showEmbeddedBack={false}');
  expect(app).toContain('showEmbeddedBack={false}\n      onBack={() => setBrowsing');
  expect(app).toContain('backRef={settingsBackRef} showEmbeddedBack={false}');
  const roomSettings = app.slice(app.indexOf("liveSheet === 'settings'"), app.indexOf("liveSheet === 'tag'"));
  expect(roomSettings).toContain('<SettingsScreen');
  expect(roomSettings).not.toContain('showEmbeddedBack={false}');
});
