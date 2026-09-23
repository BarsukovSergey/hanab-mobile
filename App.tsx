import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { lobbyRuntime, networkSession } from './src/runtime/application';
import { useAppSelector } from './src/store/hooks';
import { selectLobbyHydrated } from './src/store/store';
import { ChatPanel } from './src/ui/ChatPanel';
import {
  ActionButton,
  Field,
  HanabThemeProvider,
  Notice,
  Panel,
  SectionHeading,
  useHanabTheme,
  useResponsiveLayout,
} from './src/ui/designSystem';
import { GameScreen } from './src/ui/game/GameScreen';
import { LastClueNotice } from './src/ui/game/LastClueNotice';
import { TerminationControls } from './src/ui/game/TerminationControls';
import { isC17WorkspaceEligible } from './src/ui/game/c17Workspace';
import { getBackAction, type LocalScreen } from './src/ui/navigationPolicy';
import { HistoryScreen } from './src/ui/screens/HistoryScreen';
import { LobbyScreen } from './src/ui/screens/LobbyScreen';
import { PregameScreen } from './src/ui/screens/PregameScreen';
import { SettingsScreen } from './src/ui/screens/SettingsScreen';

type ProbeStatus = 'checking' | 'valid' | 'missing' | 'indeterminate';
type LiveSheet = 'menu' | 'chat' | 'settings' | null;

export default function App() {
  return (
    <SafeAreaProvider>
      <HanabThemeProvider>
        <AppContent />
      </HanabThemeProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { theme } = useHanabTheme();
  const { contentMaxWidth, width, height } = useResponsiveLayout();
  const landscapePhone = width > height && height < 700;
  const [probe, setProbe] = useState<ProbeStatus>('checking');
  const [statusMessage, setStatusMessage] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localScreen, setLocalScreen] = useState<LocalScreen>('lobby');
  const [returnAfterUnattend, setReturnAfterUnattend] = useState<LocalScreen | null>(null);
  const [liveSheet, setLiveSheet] = useState<LiveSheet>(null);
  const session = useAppSelector((state) => state.session);
  const hydrated = useAppSelector(selectLobbyHydrated);
  const lobbyNotice = useAppSelector((state) => state.lobby.notice);
  const roomState = useAppSelector((state) => state.room);
  const pendingReplayCreate = useAppSelector((state) => state.history.pendingReplayCreate);

  const runProbe = useCallback(async () => {
    setProbe('checking');
    setStatusMessage('');
    const result = await lobbyRuntime.checkSession();
    if (result.kind === 'valid') {
      setProbe('valid');
      void lobbyRuntime.connect();
    } else if (result.kind === 'missing') {
      setProbe('missing');
    } else {
      setProbe('indeterminate');
      setStatusMessage(result.error.message);
    }
  }, []);

  useEffect(() => { void runProbe(); }, [runProbe]);

  useEffect(() => {
    lobbyRuntime.setAppActive(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      lobbyRuntime.setAppActive(state === 'active');
    });
    return () => {
      subscription.remove();
      lobbyRuntime.disconnect();
    };
  }, []);

  useEffect(() => {
    if (roomState.room.kind !== 'none' || roomState.rematchTransition !== null) {
      setLocalScreen('lobby');
      return;
    }
    if (returnAfterUnattend !== null && pendingReplayCreate === null) {
      setLocalScreen(returnAfterUnattend);
      setReturnAfterUnattend(null);
    }
  }, [pendingReplayCreate, returnAfterUnattend, roomState.rematchTransition, roomState.room.kind]);

  useEffect(() => {
    if (roomState.room.kind !== 'live_game') setLiveSheet(null);
  }, [roomState.room.kind]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (liveSheet !== null) {
        setLiveSheet(null);
        return true;
      }
      const roomRole = roomState.room.kind === 'pregame'
        || roomState.room.kind === 'awaiting_game_bootstrap'
        || roomState.room.kind === 'live_game'
        ? roomState.room.role
        : null;
      const action = getBackAction({
        localScreen,
        authenticated: probe === 'valid' && session.phase === 'ready' && hydrated,
        roomKind: roomState.room.kind,
        roomRole,
        rematchPending: roomState.rematchTransition !== null,
      });
      if (action === 'go_to_lobby') {
        setLocalScreen('lobby');
        return true;
      }
      if (action === 'leave_pregame') {
        if (roomState.room.kind === 'pregame' && roomState.pendingLeaveTableID === null) {
          lobbyRuntime.leave(roomState.room.tableID);
        }
        return true;
      }
      if (action === 'unattend') {
        if (roomState.room.kind === 'live_game' && roomState.pendingUnattendTableID === null) {
          lobbyRuntime.unattendLiveGame(roomState.room.tableID);
        }
        return true;
      }
      return action === 'consume';
    });
    return () => subscription.remove();
  }, [
    hydrated, liveSheet, localScreen, probe, roomState.pendingLeaveTableID,
    roomState.pendingUnattendTableID, roomState.rematchTransition,
    roomState.room, session.phase,
  ]);

  const submitLogin = async () => {
    setLoginPending(true);
    setStatusMessage('');
    try {
      await networkSession.submitLogin(username, password);
      setPassword('');
      const result = await lobbyRuntime.checkSession();
      if (result.kind === 'valid') {
        setProbe('valid');
        setLocalScreen('lobby');
        setReturnAfterUnattend(null);
        void lobbyRuntime.connect();
      } else {
        setProbe(result.kind === 'missing' ? 'missing' : 'indeterminate');
        setStatusMessage(result.kind === 'indeterminate'
          ? result.error.message
          : 'Login was not accepted. Check your username and password.');
      }
    } catch (error) {
      setPassword('');
      setStatusMessage(error instanceof Error ? error.message : 'Login request failed');
    } finally {
      setLoginPending(false);
    }
  };

  const signOut = async () => {
    setSignOutPending(true);
    setStatusMessage('');
    const result = await lobbyRuntime.signOut();
    if (result.kind === 'signedOut') {
      setProbe('missing');
      setLocalScreen('lobby');
      setReturnAfterUnattend(null);
      setLiveSheet(null);
      setUsername('');
      setPassword('');
    } else {
      setProbe(result.sessionValid ? 'valid' : 'indeterminate');
      setStatusMessage(result.message);
    }
    setSignOutPending(false);
  };

  if (signOutPending) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Panel style={styles.centerCard}>
          <SectionHeading title="Signing out…" detail="Closing the realtime session and clearing local game data." />
        </Panel>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
      </View>
    );
  }

  if (probe === 'valid' && roomState.room.kind === 'live_game') {
    const liveTableID = roomState.room.tableID;
    const liveClientState = roomState.room.clientState;
    const liveConnectionProblem = session.phase === 'failed' || session.phase === 'closed';
    const pauseEligible = session.phase === 'ready'
      && roomState.room.role === 'player'
      && !roomState.room.sharedReplay
      && !liveClientState.finished
      && !liveClientState.replay.active
      && liveClientState.ongoingGame.turn.currentPlayerIndex !== null
      && liveClientState.metadata.options.timed;
    const pauseLabel = liveClientState.pause.active
      ? 'Unpause'
      : liveClientState.ongoingGame.turn.currentPlayerIndex === liveClientState.metadata.ourPlayerIndex
        ? 'Pause'
        : liveClientState.pause.queued ? 'Cancel queued pause' : 'Queue pause';
    const c17Workspace = isC17WorkspaceEligible({
      isLiveParticipant: true,
      playerCount: roomState.room.clientState.metadata.playerNames.length,
      portrait: true,
      finished: roomState.room.clientState.finished,
      replayActive: roomState.room.clientState.replay.active,
      sharedReplay: roomState.room.sharedReplay,
    });
    const gameRootScrollable = !c17Workspace || width > height || height < 700;
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.flex, { backgroundColor: theme.colors.background }]}
      >
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        <View style={[
          styles.gameBar,
          landscapePhone && styles.gameBarLandscape,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}>
          {!landscapePhone && <View style={styles.brandCopy}>
            <Text style={[styles.gameBrand, { color: theme.colors.text }]}>Hanab</Text>
            <Text numberOfLines={1} style={[styles.authName, { color: theme.colors.textMuted }]}>{session.authenticatedUser?.username ?? 'Hanab'}</Text>
          </View>}
          <View style={[styles.headerActions, landscapePhone && styles.headerActionsLandscape]}>
            <ActionButton compact title="More" tone="ghost" onPress={() => setLiveSheet('menu')} />
          </View>
        </View>
        {liveConnectionProblem && (
          <View style={styles.liveConnectionNotice}>
            <Notice tone="error">{session.error ?? 'Connection lost. Game actions are disabled until the realtime session reconnects.'}</Notice>
            <ActionButton compact title="Reconnect" tone="primary" onPress={() => void lobbyRuntime.connect()} />
          </View>
        )}
        <SafeAreaView edges={['bottom']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
          styles.gameContainer,
          landscapePhone && styles.gameContainerLandscape,
          c17Workspace && styles.gameContainerC17,
          { maxWidth: contentMaxWidth },
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={gameRootScrollable}
        >
          {!c17Workspace && <LastClueNotice />}
          <View style={c17Workspace ? [styles.gameWorkspace, styles.gameWorkspaceC17] : undefined}>
            <GameScreen />
          </View>
        </ScrollView>
        </SafeAreaView>
        <Modal animationType="fade" onRequestClose={() => setLiveSheet(null)} statusBarTranslucent transparent visible={liveSheet !== null}>
          <View style={styles.sheetBackdrop}>
            <View style={[styles.sheet, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
              {liveSheet === 'menu'
                ? <>
                  <SectionHeading title="Game menu" detail="Secondary controls stay off the gameplay surface." />
                  <View style={styles.menuActions}>
                    <ActionButton title="Table chat" onPress={() => setLiveSheet('chat')} />
                    <SectionHeading title="Players" detail={liveClientState.metadata.playerNames.join(', ')} />
                    <SectionHeading
                      title={`Spectators (${liveClientState.spectators.length})`}
                      detail={liveClientState.spectators.length === 0
                        ? 'No spectators'
                        : liveClientState.spectators.map((spectator) => spectator.name).join(', ')}
                    />
                    <ActionButton
                      disabled={roomState.pendingUnattendTableID !== null}
                      title={roomState.pendingUnattendTableID === null ? 'Lobby' : 'Leaving...'}
                      onPress={() => {
                        setLiveSheet(null);
                        setReturnAfterUnattend(null);
                        setLocalScreen('lobby');
                        lobbyRuntime.unattendLiveGame(liveTableID);
                      }}
                    />
                    {pauseEligible && <ActionButton title={pauseLabel} onPress={() => lobbyRuntime.pauseGame()} />}
                    <TerminationControls />
                    <ActionButton title="Settings" onPress={() => setLiveSheet('settings')} />
                    <ActionButton title="Sign out" tone="ghost" onPress={() => void signOut()} />
                  </View>
                  <ActionButton title="Close" tone="ghost" onPress={() => setLiveSheet(null)} />
                </>
                : liveSheet === 'chat'
                  ? <>
                    <ChatPanel room={`table${liveTableID}`} title="Table chat" />
                    <ActionButton title="Back" onPress={() => setLiveSheet('menu')} />
                  </>
                  : liveSheet === 'settings'
                    ? <SettingsScreen onBack={() => setLiveSheet('menu')} />
                    : null}
            </View>
          </View>
        </Modal>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  let content: ReactNode;
  if (probe === 'checking') {
    content = <Panel><SectionHeading title="Checking session…" detail="Looking for an existing hanab.live session." /></Panel>;
  } else if (probe === 'missing') {
    content = (
      <Panel style={styles.loginCard}>
        <View style={styles.loginIntro}>
          <Text style={[styles.loginEyebrow, { color: theme.colors.accent }]}>HANAB</Text>
          <Text style={[styles.loginTitle, { color: theme.colors.text }]}>Sign in to play</Text>
          <Text style={[styles.loginDetail, { color: theme.colors.textMuted }]}>Use your hanab.live account.</Text>
        </View>
        {statusMessage.length > 0 && <Notice tone="error">{statusMessage || 'Network request failed.'}</Notice>}
        <Field autoCapitalize="none" autoCorrect={false} onChangeText={setUsername} placeholder="Username" value={username} />
        <Field autoCapitalize="none" autoCorrect={false} onChangeText={setPassword} placeholder="Password" secureTextEntry value={password} />
        <ActionButton disabled={loginPending || username.trim().length === 0 || password.length === 0}
          title={loginPending ? 'Logging in…' : 'Login'} tone="primary" onPress={() => void submitLogin()} />
      </Panel>
    );
  } else if (probe === 'indeterminate') {
    content = <Panel><SectionHeading title="Unable to check session" detail="The server could not confirm your current session." />
      <Notice tone="error">{statusMessage || 'Network request failed.'}</Notice>
      <ActionButton title="Retry" tone="primary" onPress={() => void runProbe()} /></Panel>;
  } else if (session.phase === 'failed' || session.phase === 'closed') {
    content = <Panel><SectionHeading title="Connection lost" detail="Reconnect to continue using the lobby." />
      {session.error !== null && <Notice tone="error">{session.error}</Notice>}
      <ActionButton title="Retry" tone="primary" onPress={() => { lobbyRuntime.disconnect(); void runProbe(); }} /></Panel>;
  } else if (session.phase !== 'ready' || !hydrated) {
    content = <Panel><SectionHeading title="Connecting to lobby…" detail="Synchronizing tables and chat." /></Panel>;
  } else if (roomState.room.kind === 'awaiting_game_bootstrap') {
    content = <Panel><SectionHeading title="Loading game…" detail="Receiving the authoritative game state." /></Panel>;
  } else if (roomState.rematchTransition !== null) {
    content = <Panel><SectionHeading title="Starting rematch…" detail="Waiting for the new authoritative room state." /></Panel>;
  } else if (roomState.room.kind === 'pregame') {
    content = <PregameScreen />;
  } else if (localScreen === 'history') {
    content = <HistoryScreen onBack={() => { setReturnAfterUnattend(null); setLocalScreen('lobby'); }}
      onWatchReplay={(databaseID) => { if (lobbyRuntime.watchHistoricalGame(databaseID)) setReturnAfterUnattend('history'); }} />;
  } else if (localScreen === 'settings') {
    content = <SettingsScreen onBack={() => setLocalScreen('lobby')} />;
  } else {
    content = <LobbyScreen onOpenHistory={() => setLocalScreen('history')} />;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={[styles.container, { maxWidth: contentMaxWidth }]} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <View style={styles.appHeader}>
          <View style={styles.brandCopy}>
            <Text style={[styles.brand, { color: theme.colors.text }]}>Hanab</Text>
            {probe === 'valid' && session.authenticatedUser !== null && (
              <Text style={[styles.authName, { color: theme.colors.textMuted }]}>{session.authenticatedUser.username}</Text>
            )}
          </View>
          <View style={styles.headerActions}>
            {probe === 'valid' && session.authenticatedUser !== null && <>
              <ActionButton compact title="Settings" tone="ghost" onPress={() => setLocalScreen('settings')} />
              <ActionButton compact title="Sign out" tone="ghost" onPress={() => void signOut()} />
            </>}
          </View>
        </View>
        {lobbyNotice !== null && <Notice tone={lobbyNotice.kind === 'error' ? 'error' : 'neutral'}>{lobbyNotice.message}</Notice>}
        {content}
      </ScrollView>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { alignSelf: 'center', gap: 16, paddingBottom: 36, paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 42 : 54, width: '100%' },
  gameContainer: { alignSelf: 'center', flexGrow: 1, gap: 10, paddingBottom: 18, paddingHorizontal: 10, paddingTop: 9, width: '100%' },
  gameContainerC17: { flex: 1, paddingBottom: 0 },
  gameContainerLandscape: { gap: 4, paddingBottom: 10, paddingHorizontal: 8, paddingTop: 4 },
  gameWorkspace: { alignSelf: 'center', flex: 1, paddingBottom: 10, paddingHorizontal: 10, paddingTop: 7, width: '100%' },
  gameWorkspaceC17: { paddingBottom: 0, paddingHorizontal: 0 },
  liveConnectionNotice: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingTop: 8 },
  centered: { flex: 1, justifyContent: 'center', padding: 20 },
  centerCard: { alignSelf: 'center', maxWidth: 520, width: '100%' },
  appHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  gameBar: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'space-between', paddingBottom: 7, paddingHorizontal: 10, paddingTop: 9 },
  gameBarLandscape: { minHeight: 34, paddingBottom: 3, paddingHorizontal: 8, paddingTop: 5 },
  brandCopy: { flexShrink: 1, gap: 1, minWidth: 0 },
  brand: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  gameBrand: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  authName: { fontSize: 11, fontWeight: '700' },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'flex-end' },
  headerActionsLandscape: { flex: 1, justifyContent: 'flex-end' },
  menuActions: { gap: 7 },
  loginCard: { alignSelf: 'center', maxWidth: 520, width: '100%' },
  loginIntro: { gap: 4, marginBottom: 4 },
  loginEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  loginTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -0.6 },
  loginDetail: { fontSize: 14, lineHeight: 20 },
  sheetBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.58)', flex: 1, justifyContent: 'center', padding: 14 },
  sheet: { borderRadius: 16, borderWidth: 1, gap: 10, maxHeight: '90%', maxWidth: 720, padding: 10, width: '100%' },
});
