import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const read = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8');

test('global navigation belongs to authenticated browsing and uses responsive geometry', () => {
  const app = read('App.tsx');
  const nav = read('src/ui/BrowsingNavigation.tsx');
  const navPolicy = app.slice(app.indexOf('const showBrowsingNavigation ='), app.indexOf('const railNavigation ='));
  expect(navPolicy).toContain("presentationFocus === 'browsing'");
  expect(navPolicy).toContain('!passwordTaskOpen && !createTaskOpen');
  expect(navPolicy).not.toContain("roomState.room.kind === 'none'");
  expect(navPolicy).not.toContain('roomState.rematchTransition');
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

test('focused rooms stay mounted in an App-owned layer while browsing has focus', () => {
  const app = read('App.tsx').replace(/\r\n/g, '\n');
  const liveStart = app.indexOf('const gameRootScrollable');
  const live = app.slice(liveStart, app.indexOf("if (roomState.room.kind === 'pregame')", liveStart));
  const pregame = app.slice(app.indexOf("if (roomState.room.kind === 'pregame') {\n    const pregameReady"), app.indexOf('  let content: ReactNode;'));
  const finalRender = app.slice(app.indexOf('  const browsingPresentation = ('));
  expect(app).toContain('let focusedRoomPresentation: ReactNode = null;');
  expect(live).toContain('focusedRoomPresentation = (');
  expect(live).toContain('const gameRootScrollable = !c17Workspace;');
  expect(live).toContain('scrollEnabled={gameRootScrollable}');
  expect(live).toContain('<GameScreen presentationVisible={roomPresentationVisible} />');
  expect(live).toContain('visible={roomPresentationVisible && liveSheet !== null}');
  expect(live).toContain("readActive={roomPresentationVisible && liveSheet === 'chat'}");
  expect(live).not.toMatch(/\breturn\s*\(\s*<KeyboardAvoidingView/);
  expect(pregame).toContain('focusedRoomPresentation = <KeyboardAvoidingView');
  expect(pregame).not.toContain('return <KeyboardAvoidingView');
  expect(finalRender).toContain('const browsingPresentation = (');
  expect(finalRender).toContain('{focusedRoomPresentation !== null && <View');
  expect(finalRender).toContain("!roomPresentationVisible && { display: 'none' }");
  expect(finalRender).toContain("pointerEvents={roomPresentationVisible ? 'auto' : 'none'}");
  expect(finalRender).toContain('accessibilityElementsHidden={!roomPresentationVisible}');
  expect(finalRender).toContain("importantForAccessibility={roomPresentationVisible ? 'auto' : 'no-hide-descendants'}");
  expect(finalRender).toContain("(focusedRoomPresentation === null || presentationFocus === 'browsing') && browsingPresentation");
  expect(finalRender).toContain('<BrowsingNavigation destination={browsing.destination} onNavigate={navigate} />');
  expect(finalRender).toContain('{content}');
});

test('App reconciles focus before paint and hidden focus only closes the live sheet', () => {
  const app = read('App.tsx').replace(/\r\n/g, '\n');
  expect(app).toContain('useLayoutEffect(() => {\n    const result = reconcilePresentationFocus(');
  expect(app).toContain('roomMigrationPending: roomState.rematchTransition !== null');
  expect(app).toContain('if (result.enteredRoom) closeCreateTask();');
  const hiddenEffect = app.slice(app.indexOf("if (presentationFocus !== 'room') setLiveSheet(null);"));
  expect(hiddenEffect.slice(0, hiddenEffect.indexOf('}, [presentationFocus]);')))
    .toBe("if (presentationFocus !== 'room') setLiveSheet(null);\n  ");
  expect(app).toContain('title="Home"');
  expect(app).toContain('returnPresentation={returnPresentation} onReturn={returnToRoom}');
});

test('App passes owned-room and recovery occupancy to browsing surfaces', () => {
  const app = read('App.tsx').replace(/\r\n/g, '\n');
  const predicate = app.slice(app.indexOf('  const browsingRoomOccupied ='), app.indexOf(';', app.indexOf('  const browsingRoomOccupied =')) + 1);
  expect(predicate).toBe("  const browsingRoomOccupied =\n    roomState.room.kind !== 'none'\n    || roomState.pendingRecovery !== null\n    || roomState.rematchTransition !== null;");
  expect(app).toContain('<HistoryScreen roomOccupied={browsingRoomOccupied}');
  expect(app).toContain('<LobbyScreen\n      roomOccupied={browsingRoomOccupied}');
  expect(app).toContain('roomOccupied={browsingRoomOccupied} showEmbeddedBack={false}');
});

test('stable no-room waits for authoritative recovery and sign-out clears room ownership memory', () => {
  const app = read('App.tsx').replace(/\r\n/g, '\n');
  const guard = app.slice(app.indexOf('  const stableNoOwnedRoom ='), app.indexOf('  useLayoutEffect(', app.indexOf('  const stableNoOwnedRoom =')));
  expect(guard).toContain("&& roomState.room.kind === 'none'");
  expect(guard).toContain('&& roomState.pendingRecovery === null');
  expect(guard).toContain('&& roomState.rematchTransition === null;');
  expect(guard).not.toContain('resumeHints');

  const signOut = app.slice(app.indexOf('  const signOut = async () => {'), app.indexOf('  if (signOutPending) {'));
  expect(signOut).toContain("if (result.kind === 'signedOut') {");
  expect(signOut).toContain("setPresentationFocus('browsing');");
  expect(signOut).toContain("presentationFocusMemory.current = {\n        previousConnectionEpoch: session.connectionEpoch,\n        previousRoomKind: 'none',\n        preserveNextRoomEntry: false,\n      };");
});

test('hardware Back assigns browsing ownership before room attendance', () => {
  const app = read('App.tsx').replace(/\r\n/g, '\n');
  const hardwareBack = app.slice(app.indexOf("BackHandler.addEventListener('hardwareBackPress'"), app.indexOf('return () => subscription.remove();', app.indexOf("BackHandler.addEventListener('hardwareBackPress'")));
  const liveMenu = app.slice(app.indexOf("liveSheet === 'menu'"), app.indexOf(": liveSheet === 'chat'"));
  expect(hardwareBack.indexOf("if (presentationFocus === 'browsing')")).toBeLessThan(hardwareBack.indexOf("if (roomState.room.kind === 'pregame')"));
  expect(hardwareBack).toContain("getFocusedRoomBackDecision(roomState.room)");
  expect(hardwareBack).not.toContain('lobbyRuntime.unattendLiveGame');
  expect(liveMenu).toContain('lobbyRuntime.unattendLiveGame(liveTableID);');
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


test('Live Home opens the Home root without changing room ownership; Pregame retains Browse', () => {
  const app = read('App.tsx');
  const home = app.slice(app.indexOf('  const homeFromLive ='), app.indexOf('  const exitOwnRewind ='));
  expect(home).toContain("navigateBrowsing(state, 'home')");
  expect(home).toContain("setPresentationFocus('browsing')");
  expect(home).not.toMatch(/lobbyRuntime|dispatch|Leave|unattend/);
  expect(app).toContain('onBrowse={browseFromRoom}');
});
