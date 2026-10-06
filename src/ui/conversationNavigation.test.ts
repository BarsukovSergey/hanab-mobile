import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');

test('Conversation Back dismisses IME before navigating for both owners', () => {
  const browseBack = app.slice(app.indexOf('const backFromBrowsing'), app.indexOf('useLayoutEffect(', app.indexOf('const backFromBrowsing')));
  expect(browseBack).toMatch(/kind === 'conversation'.*keyboardOpen.current.*Keyboard.isVisible/);
  expect(browseBack).toMatch(/Keyboard.dismiss\(\);\s*return;/);
  const roomBack = app.slice(app.indexOf('const backRoomChild'), app.indexOf("BackHandler.addEventListener"));
  expect(roomBack).toMatch(/decision.kind === 'conversation-origin'[\s\S]*?if \(keyboardOpen.current \|\| Keyboard.isVisible\(\)\) Keyboard.dismiss\(\);\s*else setRoomChild\(decision.origin\)/);
  expect(app).toContain("browsingSurface.kind === 'conversation' && imeOcclusion > 0");
});

test('Conversation gets a bounded transcript instead of an enclosing browsing ScrollView', () => {
  expect(app).toContain("browsingSurface.kind === 'conversation' && browsingAuthenticated && !createTaskOpen ? <View style={styles.flex}>{content}</View> : <ScrollView");
});

test('Pregame stays mounted beneath Conversation; both room origins preserve visible-only focus', () => {
  expect(app).toContain("styles.flex, isRoomConversationChild(roomChild) && { display: 'none' }");
  expect(app).toContain('presentationVisible={roomPresentationVisible && !isRoomConversationChild(roomChild)}');
  expect(app).toContain("kind: 'conversation', username: name, origin: null");
  expect(app).toContain("kind: 'conversation', username: roomChild.username, origin: roomChild");
  expect(app).toContain('visible={childVisible}');
  expect(app).toContain('visible={roomPresentationVisible}');
});
