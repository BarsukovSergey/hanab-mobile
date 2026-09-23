import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8').replace(/\r\n/g, '\n');

test('lobby notice is rendered in a shell overlay outside the main ScrollView', () => {
  const scrollStart = app.indexOf('<ScrollView contentContainerStyle={[styles.container');
  const scrollEnd = app.indexOf('</ScrollView>', scrollStart);
  const overlay = app.indexOf('style={styles.lobbyNoticeOverlay}', scrollEnd);

  expect(scrollStart).toBeGreaterThanOrEqual(0);
  expect(scrollEnd).toBeGreaterThan(scrollStart);
  expect(app.slice(scrollStart, scrollEnd)).not.toContain('lobbyNotice');
  expect(overlay).toBeGreaterThan(scrollEnd);
  expect(app.slice(overlay, app.indexOf('<StatusBar', overlay))).toContain('<SafeAreaView edges={[\'top\']}');
  expect(app.slice(overlay, app.indexOf('<StatusBar', overlay))).toContain('maxWidth: contentMaxWidth');
  expect(app.slice(overlay, app.indexOf('<StatusBar', overlay))).toContain('title="Dismiss"');
});

test('lobby notice keeps error and warning tone mapping without automatic scrolling', () => {
  expect(app).toContain("tone={lobbyNotice.kind === 'error' ? 'error' : 'neutral'}");
  expect(app).not.toMatch(/scrollTo|scrollRef|scrollViewRef|autoScroll/i);
});
