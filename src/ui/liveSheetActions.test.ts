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

test('dismisses on backdrop taps and stops dismissal inside the sheet', () => {
  expect(liveSheet).toContain('onRequestClose={() => setLiveSheet(null)}');
  expect(liveSheet).toContain('<Pressable onPress={() => setLiveSheet(null)} style={styles.sheetBackdrop}>');
  expect(liveSheet).toContain('<Pressable onPress={(event) => event.stopPropagation()} style={[styles.sheet,');
});

test('bounds the More scroll viewport to the sheet so dynamic content remains reachable', () => {
  expect(liveSheet).toContain('<ScrollView style={styles.menuScroll} contentContainerStyle={styles.menuActions}>');
  expect(app).toContain("menuScroll: { flex: 1 }");
  expect(app).toContain("sheet: { borderRadius: 16, borderWidth: 1, gap: 10, maxHeight: '90%'");
});
