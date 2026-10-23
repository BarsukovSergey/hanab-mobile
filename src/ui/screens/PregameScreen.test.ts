import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const screen = readFileSync(resolve(__dirname, 'PregameScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');
const app = readFileSync(resolve(__dirname, '../../../App.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('focused Pregame surface', () => {
  test('only root header offers Home beside Table menu without changing local task state', () => {
    const header = screen.slice(screen.indexOf('<View style={styles.header}>'), screen.indexOf('</View>', screen.indexOf('<View style={styles.header}>')) + 7);
    expect(header).toContain("{surface === 'root' && <View style={styles.actionsRow}>");
    expect(header).toContain('title="Home" onPress={onBrowse}');
    expect(header).toContain('title="Table menu"');
    expect(screen.match(/title="Home"/g)).toHaveLength(1);
    expect(app).toContain('onBrowse={homeFromLive}');
    const browse = app.slice(app.indexOf('const browseFromRoom ='), app.indexOf('const exitOwnRewind ='));
    expect(browse).toContain("setPresentationFocus('browsing')");
    expect(browse).not.toContain('lobbyRuntime');
  });
  test('App hosts Pregame outside the browsing shell and leaves browsing navigation hidden', () => {
    const start = app.indexOf("if (roomState.room.kind === 'pregame') {\n    const pregameReady");
    const end = app.indexOf('\n  let content: ReactNode;', start);
    const host = app.slice(start, end);
    expect(host).toContain("<SafeAreaView edges={['top', 'right', 'bottom', 'left']}");
    expect(host).toContain('<PregameScreen backRef={pregameBackRef} onBrowse={homeFromLive}');
    expect(host).not.toContain('<ScrollView');
    expect(host).toContain('presentationVisible={roomPresentationVisible && !isRoomConversationChild(roomChild)}');
    expect(host).not.toContain('<BrowsingNavigation');
    expect(host).not.toContain('styles.appHeader');
    expect(host).toContain('const pregameReady = session.phase === \'ready\' && hydrated;');
    expect(host).toContain('</View> : pregameConnectionStatus}');
    expect(host).toContain('Session unavailable');
    expect(host).toContain('Connection lost');
    expect(host).toContain('Connecting to lobby');
    expect(host).toContain('title="Retry"');
    expect(host).toContain('focusedRoomPresentation = <KeyboardAvoidingView');
    expect(host).not.toContain('return <KeyboardAvoidingView');
    expect(app).not.toContain('content = <PregameScreen />');
  });

  test('visibility defaults to visible and only gates root Chat reads without resetting local state', () => {
    expect(screen).toContain('presentationVisible?: boolean;');
    expect(screen).toContain('presentationVisible = true');
    const effects = screen.slice(screen.indexOf('  useEffect('), screen.indexOf('  const handleBack'));
    expect(effects).not.toContain('presentationVisible');
    expect(effects).toContain("setSurface('root');");
    expect(effects).toContain('setEditName(room.data.name);');
  });

  test('root shows compact identity, roster and setup entries before a fixed role/start footer', () => {
    const root = screen.slice(screen.indexOf("{surface === 'root' && <>"), screen.indexOf("{surface === 'table-settings'"));
    expect(root).toContain('{tableIdentity}');
    expect(root).toContain('{roster}');
    expect(root).toContain('{setupSummary}');
    expect(root).toContain('<ChatPanel room={`table${room.tableID}`} title="Pre-game chat" readActive={presentationVisible} />');
    const nestedSurfaces = screen.slice(
      screen.indexOf("{surface === 'table-settings'"),
      screen.indexOf('</ScrollView>', screen.indexOf("{surface === 'table-settings'")),
    );
    expect(nestedSurfaces).not.toContain('<ChatPanel');
    for (const surface of ['table-settings', 'spectators', 'team-tools', 'table-menu']) {
      expect(screen).toContain(`{surface === '${surface}' &&`);
    }
    expect(screen).toContain('<ScrollView style={styles.scroll}');
    expect(screen).toContain("{surface === 'root' && <View style={styles.footer}>");
    expect(root).not.toContain('formatPregamePlayerStats');
    expect(root).not.toContain('<BotPicker');
    expect(root).not.toContain('<TableOptionsEditor');
    expect(root).not.toContain('spectators.map');
    expect(screen).toContain('import { isPregameLandscape } from \'../navigationPolicy\';');
    expect(screen).toContain('const { availableWidth, availableHeight } = useResponsiveLayout();');
    expect(screen).toContain('const landscape = isPregameLandscape(availableWidth, availableHeight);');
    expect(screen).toContain('const leaderName = users.find((user) => user.userID === room.data.owner)?.name');
    expect(screen).toContain('<Pill>Leader{leaderName === undefined ?');
    expect(screen).not.toContain('const { wide } = useResponsiveLayout()');
    expect(screen).toContain('landscapeRegions: { alignItems: \'flex-start\', flexDirection: \'row\'');
  });

  test('nested Back is local and bare Pregame Back is handled by the Pregame policy', () => {
    expect(screen).toContain('const handleBack = () => setSurface(\'root\');');
    expect(screen).toContain('if (backRef) backRef.current = handleBack;');
    expect(screen).toContain('useEffect(() => () => { if (backRef) backRef.current = null; }, [backRef]);');
    const localBack = screen.slice(screen.indexOf('const handleBack'), screen.indexOf('if (room === null) return null;'));
    expect(localBack).not.toContain('lobbyRuntime.leave');
    expect(localBack).not.toContain('lobbyRuntime.unattendLiveGame');
    expect(app).toContain('pregameBackRef.current?.();');
    expect(app).toContain("if (roomState.room.kind === 'pregame') {");
    expect(app).not.toContain("action === 'leave_pregame'");
  });

  test('attendance exit is confirmed from Table menu and core room commands remain wired', () => {
    const tableMenuStart = screen.indexOf("{surface === 'table-menu'");
    const tableMenu = screen.slice(tableMenuStart, screen.indexOf('</ScrollView>', tableMenuStart));
    expect(tableMenu).toContain("room.role === 'player' ? 'Leave table' : 'Stop watching'");
    expect(tableMenu).toContain('Alert.alert(');
    expect(tableMenu).toContain("{ text: 'Cancel', style: 'cancel' }");
    expect(tableMenu).toContain("onPress: () => lobbyRuntime.leave(room.tableID)");
    expect(screen).toContain("onPress={() => lobbyRuntime.startGame()}");
    expect(screen).toContain('lobbyRuntime.switchToSpectator()');
    expect(screen).toContain('lobbyRuntime.joinAsPlayer(joinPassword)');
    expect(screen).toContain('lobbyRuntime.setTableLeader(player.name)');
    expect(screen).toContain('chatRuntime.submit(`/kick ${player.name}`)');
    expect(screen).toContain('lobbyRuntime.updateTable(editName, editMaxPlayers, editOptions)');
    expect(screen).toContain("chatRuntime.submit('/findvariant')");
    expect(screen).toContain("chatRuntime.submit('/missing')");
    expect(screen).toContain('lobbyRuntime.inviteBots(room.tableID, selectedBots, botInvitePassword)');
    expect(screen).toContain('title={isOwner ? (roomState.pendingUpdate === null ? \'Apply changes\' : \'Applying…\') : \'Propose changes\'}');
  });
});
