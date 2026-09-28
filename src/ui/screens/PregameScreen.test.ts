import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const screen = readFileSync(resolve(__dirname, 'PregameScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');
const app = readFileSync(resolve(__dirname, '../../../App.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('focused Pregame surface', () => {
  test('App hosts Pregame outside the browsing shell and leaves browsing navigation hidden', () => {
    const start = app.indexOf("if (roomState.room.kind === 'pregame') {\n    const pregameReady");
    const end = app.indexOf('\n  return (', start);
    const host = app.slice(start, end);
    expect(host).toContain("<SafeAreaView edges={['top', 'right', 'bottom', 'left']}");
    expect(host).toContain('<PregameScreen backRef={pregameBackRef} />');
    expect(host).not.toContain('<ScrollView');
    expect(host).not.toContain('<BrowsingNavigation');
    expect(host).not.toContain('styles.appHeader');
    expect(host).toContain('const pregameReady = session.phase === \'ready\' && hydrated;');
    expect(host).toContain('{pregameReady ? <PregameScreen backRef={pregameBackRef} /> : pregameConnectionStatus}');
    expect(host).toContain('Session unavailable');
    expect(host).toContain('Connection lost');
    expect(host).toContain('Connecting to lobby');
    expect(host).toContain('title="Retry"');
    expect(app).not.toContain('content = <PregameScreen />');
  });

  test('root shows compact identity, roster and setup entries before a fixed role/start footer', () => {
    const root = screen.slice(screen.indexOf("{surface === 'root' && <>"), screen.indexOf("{surface === 'table-settings'"));
    expect(root).toContain('{tableIdentity}');
    expect(root).toContain('{roster}');
    expect(root).toContain('{setupSummary}');
    expect(screen).toContain('<ChatPanel room={`table${room.tableID}`} title="Pre-game chat" />');
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
    const tableMenu = screen.slice(screen.indexOf("{surface === 'table-menu'"), screen.indexOf('<ChatPanel'));
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
