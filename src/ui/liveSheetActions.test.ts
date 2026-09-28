import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8').replace(/\r\n/g, '\n');
const liveSheet = app.slice(app.indexOf('<Modal animationType="fade"'), app.indexOf('</Modal>', app.indexOf('<Modal animationType="fade"')));

test('keeps chat out of More and closes Chat directly to the game', () => {
  expect(liveSheet).not.toContain('<ActionButton title="Table chat"');
  const chatBranch = liveSheet.match(/: liveSheet === 'chat'([\s\S]*?)(?=: liveSheet === 'settings')/)?.[1];
  expect(chatBranch).toContain('<ActionButton title="Back" onPress={() => setLiveSheet(null)} />');
  expect(chatBranch).not.toContain("setLiveSheet('menu')");
});

test('submits Show tags as a normal chat command', () => {
  expect(liveSheet).toContain('<ActionButton title="Show tags" onPress={() => chatRuntime.submit(\'/tags\')} />');
});

test('keeps Settings in More and removes Sign out', () => {
  expect(liveSheet).toContain('<ActionButton title="Settings" onPress={() => setLiveSheet(\'settings\')} />');
  const menuBranch = liveSheet.slice(liveSheet.indexOf("liveSheet === 'menu'"), liveSheet.indexOf(": liveSheet === 'chat'"));
  expect(menuBranch).not.toContain('<ActionButton title="Sign out"');
});

test('dismisses on backdrop taps and stops dismissal inside the sheet', () => {
  expect(liveSheet).toContain('onRequestClose={() => setLiveSheet(null)}');
  expect(liveSheet).toContain('<Pressable onPress={() => setLiveSheet(null)} style={styles.sheetBackdrop}>');
  expect(liveSheet).toContain('<Pressable onPress={(event) => event.stopPropagation()} style={[styles.sheet,');
});

test('bounds the More scroll viewport to the sheet so dynamic content remains reachable', () => {
  expect(liveSheet).toContain('<ScrollView style={styles.menuScroll} contentContainerStyle={styles.menuActions}>');
  expect(app).toContain("menuScroll: { flexGrow: 0, flexShrink: 1 }");
  expect(app).toContain("sheet: { borderRadius: 16, borderWidth: 1, gap: 10, maxHeight: '90%'");
});

test('keeps live-game header actions outlined, matched, and tall enough to tap', () => {
  const headerStart = app.indexOf('<View style={[styles.headerActions');
  const headerEnd = app.indexOf('</View>', headerStart);
  const headerActions = app.slice(headerStart, headerEnd);
  const buttons = headerActions.match(/<ActionButton[\s\S]*?\/>/g) ?? [];

  expect(buttons).toHaveLength(2);
  const [chat, more] = buttons;
  expect(chat).toContain("title={liveChatUnreadCount === 0 ? 'Chat' : `Chat (${liveChatUnreadCount})`}");
  expect(chat).toContain("onPress={() => setLiveSheet('chat')}");
  expect(more).toContain('title="More"');
  expect(more).toContain("onPress={() => setLiveSheet('menu')}");
  for (const button of buttons) {
    expect(button).toContain('compact');
    expect(button).toContain('tone="secondary"');
    expect(button).toContain('style={styles.liveHeaderAction}');
  }
  expect(app).toMatch(/liveHeaderAction:\s*\{[^}]*minHeight:\s*40[^}]*paddingHorizontal:\s*12/);
});

test('uses explicit export feedback tone instead of inferring it from message text', () => {
  expect(app).toContain("message: string;\n    tone: 'success' | 'error';");
  expect(liveSheet).toContain('<Notice tone={exportFeedback.tone}>{exportFeedback.message}</Notice>');
  expect(liveSheet).not.toMatch(/exportFeedback\.startsWith\(/);
  expect(liveSheet).toContain("message: result.error, tone: 'error'");
  expect(liveSheet).toContain("message: 'Replay link copied.', tone: 'success'");
  expect(liveSheet).toContain("message: 'Share sheet opened.', tone: 'success'");
  expect(liveSheet).toContain("message: 'Replay JSON copied.', tone: 'success'");
  expect(liveSheet).toContain("message: 'Could not copy replay link.', tone: 'error'");
  expect(liveSheet).toContain("message: 'Could not share replay link.', tone: 'error'");
  expect(liveSheet).toContain("message: 'Could not copy replay JSON.', tone: 'error'");
});
