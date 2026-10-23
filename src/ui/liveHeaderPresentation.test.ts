import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8').replace(/\r\n/g, '\n');
const header = app.slice(app.indexOf('styles.gameBar,'), app.indexOf('{liveConnectionProblem'));

test('Live and own Rewind keep visible ghost Home; Review keeps Home; landscape Home preserves attendance', () => {
  const navigation = header.match(/<ActionButton compact title="Home"[^\n]+/u)?.[0];
  expect(navigation).toBeDefined();
  expect(navigation).toContain("title=\"Home\"");
  expect(navigation).toContain("tone={workspacePresentation.review ? 'secondary' : 'ghost'}");
  expect(navigation).toContain('onPress={homeFromLive}');
  expect(navigation).toContain('style={[styles.liveHeaderAction, styles.liveHeaderNavigation]}');
});

test('navigation alone narrows to 8dp while header actions retain 40dp height and compact hit slop', () => {
  expect(app).toContain("liveHeaderAction: { justifyContent: 'center', minHeight: 40, paddingHorizontal: 12 }");
  expect(app).toContain('liveHeaderNavigation: { paddingHorizontal: 8 }');
  expect(header.match(/styles\.liveHeaderNavigation/g)).toHaveLength(1);
  const buttons = readFileSync(resolve(__dirname, 'designSystem.tsx'), 'utf8');
  expect(buttons).toContain('hitSlop={compact ? COMPACT_HIT_SLOP : undefined}');
});

test('portrait header uses 5dp vertical padding and landscape keeps its existing override', () => {
  const portrait = app.match(/gameBar: \{[^\n]+/u)?.[0];
  expect(portrait).toContain('paddingBottom: 5, paddingHorizontal: 10, paddingTop: 5');
  expect(app).toContain('gameBarLandscape: { minHeight: 34, paddingBottom: 3, paddingHorizontal: 8, paddingTop: 5 }');
  expect(header).toContain('styles.gameBar,\n          landscapePhone && styles.gameBarLandscape,');
});

test('variant and mode identity, Chat unread, Menu and portrait Table Chat return remain in the header', () => {
  expect(header).toContain('<Text numberOfLines={1} ellipsizeMode="tail" style={[styles.gameIdentity, styles.flex, width > height && { minWidth: Math.ceil(48 * Math.max(1, fontScale)) }, { color: theme.colors.text }]}>{workspacePresentation.review || workspacePresentation.ownRewind ? workspacePresentation.identity : liveClientState.metadata.options.variantName}</Text>');
  expect(app).toContain("gameIdentity: { fontSize: 18, fontWeight: '800', minWidth: 0 }");
  expect(header).toContain("title={headerDisplayedUnreadCount === 0 ? 'Chat' : `Chat (${headerDisplayedUnreadCount})`}");
  expect(header).toContain("onPress={() => setRoomChild('chat')}");
  expect(header).toContain('title="Menu" accessibilityLabel={workspacePresentation.menuAccessibilityLabel} tone="secondary" style={styles.liveHeaderAction}');
  expect(header).toContain("onPress={() => setRoomChild('menu')}");
  expect(header).toContain('{portraitChatOpen ? <>');
  expect(header).toContain('<ActionButton compact title="Return to game" style={styles.liveHeaderAction} onPress={closeRoomChild} />');
});

test('Home dismisses IME and targets Home while Browse only changes focus, preserving attendance', () => {
  const navigation = app.slice(app.indexOf('  const browseFromRoom ='), app.indexOf('  const exitOwnRewind ='));
  expect(navigation).toBe(`  const browseFromRoom = () => {
    setPresentationFocus('browsing');
  };
  const homeFromLive = () => {
    Keyboard.dismiss();
    setBrowsing((state) => navigateBrowsing(state, 'home'));
    setPresentationFocus('browsing');
  };
`);
});
