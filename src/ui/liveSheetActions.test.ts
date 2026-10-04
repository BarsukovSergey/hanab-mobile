import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8').replace(/\r\n/g, '\n');
const roomChild = app.slice(app.indexOf('const renderRoomChildren'), app.indexOf('    focusedRoomPresentation = ('));

test('keeps one table Chat mounted outside conditional Menu with a direct Return', () => {
  expect(roomChild.match(/<ChatPanel/g)).toHaveLength(1);
  expect(roomChild).toContain('key={liveTableID}');
  expect(roomChild).toContain('title="Return to game" onPress={closeRoomChild}');
  expect(roomChild).toContain("roomChild !== 'chat' && { display: 'none' }");
  expect(roomChild).not.toContain('<ActionButton title="Table chat"');
  expect(app).not.toContain('type LiveSheet');
});

test('groups tools and preserves normal Show tags submission', () => {
  expect(roomChild).toContain("roomChild === 'menu-tools'");
  expect(roomChild).toContain("chatRuntime.submit('/tags')");
  expect(app).toContain("roomChild === 'tag' || roomChild === 'replay-export'");
  expect(app).toContain("setRoomChild('menu-tools')");
});

test('Settings returns to Menu and retains nested Back ownership', () => {
  expect(roomChild).toContain('title="Settings >"');
  expect(roomChild).toContain("<SettingsScreen onBack={() => setRoomChild('menu')}");
  expect(app).toContain("else if (roomChild === 'settings') settingsBackRef.current?.();");
  expect(roomChild).not.toContain('<ActionButton title="Sign out"');
});

test('Menu has a fixed header and Close above the bounded inner scroll', () => {
  expect(roomChild.indexOf('title="Close"')).toBeLessThan(roomChild.indexOf('<ScrollView'));
  expect(roomChild).toContain('onPress={(event) => event.stopPropagation()}');
  expect(app).toContain('menuScroll: { flex: 1, minHeight: 0 }');
  expect(roomChild).toContain('Math.min(288, Math.max(220, landscapeRightWidth - 32))');
});

test('only destructive attendance confirmation sends unattend', () => {
  expect(roomChild).toContain("Alert.alert(label, 'Leave this table?'");
  expect(roomChild).toContain("{ text: 'Cancel', style: 'cancel' }");
  expect(roomChild).toMatch(/style: 'destructive', onPress: \(\) => \{\s*closeRoomChild\(\);\s*lobbyRuntime.unattendLiveGame\(liveTableID\)/);
  expect(app.match(/lobbyRuntime.unattendLiveGame/g)).toHaveLength(1);
  expect(roomChild).toContain("'Unattend' : 'Stop watching'");
});

test('Chat hardware Back dismisses only keyboard first', () => {
  const back = app.slice(app.indexOf('const backRoomChild'), app.indexOf('  useEffect(() => {', app.indexOf('const backRoomChild')));
  expect(back).toContain("if (roomChild === 'chat')");
  expect(back).toContain('if (keyboardOpen.current || Keyboard.isVisible()) Keyboard.dismiss();');
  expect(back).toContain('else setRoomChild(null);');
  expect(back).not.toContain('unattend');
});

test('C17 child host uses the allocated right column without changing allocator inputs', () => {
  const c17 = readFileSync(resolve(__dirname, 'game/C17GameScreen.tsx'), 'utf8');
  expect(c17).toContain('roomChildren?.(portraitV2 ? null : landscapeLayout.fits ? landscapeLayout.rightWidth : 0)');
  expect(c17).not.toContain('useWindowDimensions');
  const allocator = c17.slice(c17.indexOf('const landscapeLayout ='), c17.indexOf('const layout: C17DenseLayout'));
  expect(allocator).not.toMatch(/roomChildren|roomChild|ime/);
  expect(app).toContain("roomState.room.kind === 'live_game' ? roomState.room.tableID : null");
});

test('keeps live-game header actions outlined, matched, and tall enough to tap', () => {
  const headerStart = app.indexOf('<View style={[styles.headerActions');
  const headerEnd = app.indexOf('</View>', headerStart);
  const headerActions = app.slice(headerStart, headerEnd);
  const buttons = headerActions.match(/<ActionButton[\s\S]*?\/>/g) ?? [];

  expect(buttons).toHaveLength(3);
  const [browse, chat, more] = buttons;
  expect(browse).toContain('title="Home"');
  expect(browse).toContain('onPress={homeFromLive}');
  expect(chat).toContain("title={liveChatUnreadCount === 0 ? 'Chat' : `Chat (${liveChatUnreadCount})`}");
  expect(chat).toContain("onPress={() => setRoomChild('chat')}");
  expect(more).toContain('title="Menu"');
  expect(more).toContain("onPress={() => setRoomChild('menu')}");
  for (const button of buttons) {
    expect(button).toContain('compact');
    expect(button).toContain('tone="secondary"');
    expect(button).toContain('style={styles.liveHeaderAction}');
  }
  expect(app).toMatch(/liveHeaderAction:\s*\{[^}]*minHeight:\s*40[^}]*paddingHorizontal:\s*12/);
});

test('uses explicit export feedback tone instead of inferring it from message text', () => {
  expect(app).toContain("message: string;\n    tone: 'success' | 'error';");
  expect(roomChild).toContain('<Notice tone={exportFeedback.tone}>{exportFeedback.message}</Notice>');
  expect(roomChild).not.toMatch(/exportFeedback\.startsWith\(/);
  expect(roomChild).toContain("message: result.error, tone: 'error'");
  expect(roomChild).toContain("message: 'Replay link copied.', tone: 'success'");
  expect(roomChild).toContain("message: 'Share sheet opened.', tone: 'success'");
  expect(roomChild).toContain("message: 'Replay JSON copied.', tone: 'success'");
  expect(roomChild).toContain("message: 'Could not copy replay link.', tone: 'error'");
  expect(roomChild).toContain("message: 'Could not share replay link.', tone: 'error'");
  expect(roomChild).toContain("message: 'Could not copy replay JSON.', tone: 'error'");
});


test('Live header shares Home variant Chat Menu in both orientations', () => {
  const header = app.slice(app.indexOf('const gameRootScrollable'), app.indexOf('{liveConnectionProblem'));
  expect(header).toContain('title="Home"');
  expect(header).toContain('onPress={homeFromLive}');
  expect(header).toContain('liveClientState.metadata.options.variantName');
  expect(header).toContain('title="Menu"');
  expect(header).toContain("onPress={() => setRoomChild('chat')}");
  expect(header).not.toMatch(/Browse|More|username|YOUR TURN|LIVE T/);
  expect(header).not.toContain('width <= height');
});
