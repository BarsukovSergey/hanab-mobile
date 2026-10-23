import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';
import { getRoomChildBackDecision } from './roomChildPresentation';

const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8').replace(/\r\n/g, '\n');
const roomChild = app.slice(app.indexOf('const renderRoomChildren'), app.indexOf('    focusedRoomPresentation = ('));
const menu = roomChild.slice(roomChild.indexOf("{roomChild !== null && !isRoomConversationChild(roomChild) && roomChild !== 'chat' && roomChild !== 'settings'"));

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
  expect(getRoomChildBackDecision('tag')).toEqual({ kind: 'open-child', child: 'menu-tools' });
  expect(getRoomChildBackDecision('replay-export')).toEqual({ kind: 'open-child', child: 'menu-tools' });
});

test('Settings returns to Menu and retains nested Back ownership', () => {
  expect(roomChild).toContain('title="Settings >"');
  expect(roomChild).toContain("<SettingsScreen onBack={() => setRoomChild('menu')}");
  expect(app).toContain("else if (decision.kind === 'settings') settingsBackRef.current?.();");
  expect(roomChild).not.toContain('<ActionButton title="Sign out"');
});

test('Menu has a fixed header and Close above the bounded inner scroll', () => {
  expect(menu.indexOf('title="Close"')).toBeLessThan(menu.indexOf('<ScrollView'));
  expect(menu.indexOf('title="Back"')).toBeLessThan(menu.indexOf('<ScrollView'));
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
  expect(back).toContain("if (decision.kind === 'chat')");
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
  expect(app).toContain("roomState.room.kind !== 'none' ? roomState.room.tableID : null");
});

test('keeps Live Home quiet, Review Browse outlined, and header actions tall enough to tap', () => {
  const headerStart = app.indexOf('<View style={[styles.headerActions');
  const headerEnd = app.indexOf('{liveConnectionProblem', headerStart);
  const headerActions = app.slice(headerStart, headerEnd);
  const normalHeader = headerActions.slice(headerActions.indexOf('</> : <>'));
  const buttons = (normalHeader.match(/<ActionButton[\s\S]*?\/>/g) ?? []).filter((button) => !button.includes('onPress={() => {}}'));

  expect(buttons).toHaveLength(3);
  const [browse, chat, more] = buttons;
  expect(browse).toContain("title={workspacePresentation.review && width <= height ? 'Browse' : 'Home'}");
  expect(browse).toContain('onPress={workspacePresentation.review && width <= height ? browseFromRoom : homeFromLive}');
  expect(browse).toContain("tone={workspacePresentation.review ? 'secondary' : 'ghost'}");
  expect(browse).toContain('style={[styles.liveHeaderAction, styles.liveHeaderNavigation]}');
  expect(chat).toContain("title={headerDisplayedUnreadCount === 0 ? 'Chat' : `Chat (${headerDisplayedUnreadCount})`}");
  expect(chat).toContain("onPress={() => setRoomChild('chat')}");
  expect(more).toContain('title="Menu"');
  expect(more).toContain("onPress={() => setRoomChild('menu')}");
  for (const button of buttons) {
    expect(button).toContain('compact');
  }
  for (const button of [chat, more]) {
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


test('Live header retains Home variant Chat Menu outside portrait Chat', () => {
  const header = app.slice(app.indexOf('const gameHeader = ('), app.indexOf('focusedRoomPresentation = ('));
  expect(header).toContain("title={workspacePresentation.review && width <= height ? 'Browse' : 'Home'}");
  expect(header).toContain('onPress={workspacePresentation.review && width <= height ? browseFromRoom : homeFromLive}');
  expect(header).toContain('liveClientState.metadata.options.variantName');
  expect(header).toContain('title="Menu"');
  expect(header).toContain("onPress={() => setRoomChild('chat')}");
  expect(header).not.toMatch(/More|username|YOUR TURN|LIVE T/);
  expect(header).toContain('workspacePresentation.identity');
  expect(header).toContain("workspacePresentation.review && width <= height ? 'Browse' : 'Home'");
});

test('portrait Chat replaces contents of the same Live header and has no second task header', () => {
  expect(app).toContain("const portraitChatOpen = roomChild === 'chat' && width <= height;");
  const header = app.slice(app.indexOf('styles.gameBar,'), app.indexOf('{liveConnectionProblem'));
  expect(header.match(/styles.gameBar,/g)).toHaveLength(1);
  const chatHeader = header.slice(header.indexOf('{portraitChatOpen ? <>'), header.indexOf('</> : <>'));
  expect(chatHeader).toContain('>Table chat</Text>');
  expect(chatHeader).toContain('title="Return to game" style={styles.liveHeaderAction} onPress={closeRoomChild}');
  expect(chatHeader).not.toMatch(/title="Home"|title="Menu"|variantName/);
  const task = roomChild.slice(roomChild.indexOf('<View style={[styles.chatTask'), roomChild.indexOf("{roomChild === 'settings'"));
  expect(task).toMatch(/\{landscape && <View style=\{styles.childHeader\}>[\s\S]*?title="Table chat"[\s\S]*?title="Return to game"[\s\S]*?<\/View>\}/);
  expect(task.match(/styles.childHeader/g)).toHaveLength(1);
  expect(task.match(/<ChatPanel/g)).toHaveLength(1);
  expect(task).toContain('fill readActive={roomPresentationVisible && roomChild === \'chat\'}');
});

test('portrait Menu is bottom anchored with 12 outer margin and an 82 percent cap', () => {
  expect(menu).toContain('!landscape && styles.roomMenuPortrait');
  expect(app).toMatch(/roomMenuBackdrop: \{[^}]*justifyContent: 'flex-end'/);
  expect(app).toContain("roomMenuPortrait: { alignSelf: 'stretch', margin: 12, width: 'auto' }");
  expect(app).toMatch(/roomMenu: \{[^}]*maxHeight: '82%'/);
  expect(menu).toContain("landscape && { width: Math.min(288, Math.max(220, landscapeRightWidth - 32)), height: '100%', maxHeight: '100%' }");
  expect(roomChild).toContain("pointerEvents={childVisible ? 'auto' : 'none'}");
});

test('canonical Settings is a room task outside the Menu panel and its scrolling body', () => {
  const settingsTask = roomChild.slice(roomChild.indexOf("{roomChild === 'settings' && <ScrollView"), roomChild.indexOf("{isRoomConversationChild(roomChild)"));
  expect(settingsTask).toContain('styles.roomSettingsTask');
  expect(settingsTask).toContain("<SettingsScreen onBack={() => setRoomChild('menu')}");
  expect(settingsTask).toContain('backRef={settingsBackRef}');
  expect(settingsTask).not.toMatch(/SectionHeading|ActionButton|styles.roomMenu|styles.menuScroll/);
  expect(menu).not.toContain('<SettingsScreen');
  expect(menu).not.toContain("roomChild === 'settings' ? 'Settings'");
  expect(roomChild).toContain("width: roomChild === 'settings' ? '100%' : landscapeRightWidth ?? '100%'");
  const settings = readFileSync(resolve(__dirname, 'screens/SettingsScreen.tsx'), 'utf8');
  const back = settings.slice(settings.indexOf('const handleBack ='), settings.indexOf('if (backRef)'));
  expect(back).toMatch(/else if \(category !== null\) \{\s*setCategory\(null\);\s*\} else \{\s*onBack\(\);/);
  expect(settings).toContain('backRef.current = handleBack');
  expect(app).toContain("else if (decision.kind === 'settings') settingsBackRef.current?.();");
});

test('section 10 documents exact right-column Chat replacement without a full-window fallback', () => {
  const doc = readFileSync(resolve(__dirname, '../../docs/MOBILE_APP_DESIGN_V2.md'), 'utf8');
  const section = doc.slice(doc.indexOf('## 10.'), doc.indexOf('## 11.'));
  expect(section).toContain('Landscape Chat replaces exactly the existing Slice 8b right column');
  expect(section).toContain('landscapeLayout.rightWidth');
  expect(section).toContain('There is no full-window Chat fallback.');
  expect(section).toContain('The left hand grid, divider, and card geometry do not reflow');
  expect(section).not.toMatch(/full-window task/);
});
