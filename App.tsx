import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
  ThemeSwitcher,
  useHanabTheme,
  useResponsiveLayout,
} from './src/ui/designSystem';
import { GameScreen } from './src/ui/game/GameScreen';
import { getBackAction, type LocalScreen } from './src/ui/navigationPolicy';
import { HistoryScreen } from './src/ui/screens/HistoryScreen';
import { LobbyScreen } from './src/ui/screens/LobbyScreen';
import { PregameScreen } from './src/ui/screens/PregameScreen';

type ProbeStatus = 'checking' | 'valid' | 'missing' | 'indeterminate';

export default function App() {
  return (
    <HanabThemeProvider>
      <AppContent />
    </HanabThemeProvider>
  );
}

function AppContent() {
  const { theme } = useHanabTheme();
  const { contentMaxWidth } = useResponsiveLayout();
  const [probe, setProbe] = useState<ProbeStatus>('checking');
  const [statusMessage, setStatusMessage] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localScreen, setLocalScreen] = useState<LocalScreen>('lobby');
  const [returnAfterUnattend, setReturnAfterUnattend] = useState<LocalScreen | null>(null);
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
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
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
    hydrated, localScreen, probe, roomState.pendingLeaveTableID,
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
    const liveConnectionProblem = session.phase === 'failed' || session.phase === 'closed';
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.flex, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.gameBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.brandCopy}>
            <Text style={[styles.brand, { color: theme.colors.text }]}>Hanab</Text>
            <Text style={[styles.authName, { color: theme.colors.textMuted }]}>{session.authenticatedUser?.username ?? 'Hanab'}</Text>
          </View>
          <View style={styles.headerActions}>
            <ThemeSwitcher compact />
            <ActionButton
              compact
              disabled={roomState.pendingUnattendTableID !== null}
              title={roomState.pendingUnattendTableID === null ? 'Lobby' : 'Leaving…'}
              onPress={() => {
                setReturnAfterUnattend(null);
                setLocalScreen('lobby');
                lobbyRuntime.unattendLiveGame(liveTableID);
              }}
            />
            <ActionButton compact title="Sign out" tone="ghost" onPress={() => void signOut()} />
          </View>
        </View>
        {liveConnectionProblem && (
          <View style={styles.liveConnectionNotice}>
            <Notice tone="error">{session.error ?? 'Connection lost. Game actions are disabled until the realtime session reconnects.'}</Notice>
            <ActionButton compact title="Reconnect" tone="primary" onPress={() => void lobbyRuntime.connect()} />
          </View>
        )}
        <ScrollView contentContainerStyle={[styles.gameContainer, { maxWidth: contentMaxWidth }]} keyboardShouldPersistTaps="handled">
          <GameScreen />
          <ChatPanel room={`table${liveTableID}`} title="Table chat" />
        </ScrollView>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
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
        {statusMessage.length > 0 && <Notice tone="error">{statusMessage}</Notice>}
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setUsername}
          placeholder="Username"
          value={username}
        />
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          value={password}
        />
        <ActionButton
          disabled={loginPending || username.trim().length === 0 || password.length === 0}
          title={loginPending ? 'Logging in…' : 'Login'}
          tone="primary"
          onPress={() => void submitLogin()}
        />
      </Panel>
    );
  } else if (probe === 'indeterminate') {
    content = (
      <Panel>
        <SectionHeading title="Unable to check session" detail="The server could not confirm your current session." />
        <Notice tone="error">{statusMessage || 'Network request failed.'}</Notice>
        <ActionButton title="Retry" tone="primary" onPress={() => void runProbe()} />
      </Panel>
    );
  } else if (session.phase === 'failed' || session.phase === 'closed') {
    content = (
      <Panel>
        <SectionHeading title="Connection lost" detail="Reconnect to continue using the lobby." />
        {session.error !== null && <Notice tone="error">{session.error}</Notice>}
        <ActionButton title="Retry" tone="primary" onPress={() => { lobbyRuntime.disconnect(); void runProbe(); }} />
      </Panel>
    );
  } else if (session.phase !== 'ready' || !hydrated) {
    content = <Panel><SectionHeading title="Connecting to lobby…" detail="Synchronizing tables and chat." /></Panel>;
  } else if (roomState.room.kind === 'awaiting_game_bootstrap') {
    content = <Panel><SectionHeading title="Loading game…" detail="Receiving the authoritative game state." /></Panel>;
  } else if (roomState.rematchTransition !== null) {
    content = <Panel><SectionHeading title="Starting rematch…" detail="Waiting for the new authoritative room state." /></Panel>;
  } else if (roomState.room.kind === 'pregame') {
    content = <PregameScreen />;
  } else if (localScreen === 'history') {
    content = (
      <HistoryScreen
        onBack={() => {
          setReturnAfterUnattend(null);
          setLocalScreen('lobby');
        }}
        onWatchReplay={(databaseID) => {
          if (lobbyRuntime.watchHistoricalGame(databaseID)) {
            setReturnAfterUnattend('history');
          }
        }}
      />
    );
  } else {
    content = <LobbyScreen onOpenHistory={() => setLocalScreen('history')} />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { maxWidth: contentMaxWidth }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.appHeader}>
          <View style={styles.brandCopy}>
            <Text style={[styles.brand, { color: theme.colors.text }]}>Hanab</Text>
            {probe === 'valid' && session.authenticatedUser !== null && (
              <Text style={[styles.authName, { color: theme.colors.textMuted }]}>{session.authenticatedUser.username}</Text>
            )}
          </View>
          <View style={styles.headerActions}>
            <ThemeSwitcher compact />
            {probe === 'valid' && session.authenticatedUser !== null && (
              <ActionButton compact title="Sign out" tone="ghost" onPress={() => void signOut()} />
            )}
          </View>
        </View>
        {lobbyNotice !== null && (
          <Notice tone={lobbyNotice.kind === 'error' ? 'error' : 'neutral'}>{lobbyNotice.message}</Notice>
        )}
        {content}
      </ScrollView>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    alignSelf: 'center',
    gap: 16,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 42 : 54,
    width: '100%',
  },
  gameContainer: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: 16,
    paddingBottom: 28,
    paddingHorizontal: 14,
    paddingTop: 14,
    width: '100%',
  },
  liveConnectionNotice: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  centered: { flex: 1, justifyContent: 'center', padding: 20 },
  centerCard: { alignSelf: 'center', maxWidth: 520, width: '100%' },
  appHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  gameBar: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 9,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 38 : 48,
  },
  brandCopy: { flexShrink: 1, gap: 1 },
  brand: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  authName: { fontSize: 12, fontWeight: '700' },
  headerActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-end' },
  loginCard: { alignSelf: 'center', maxWidth: 520, width: '100%' },
  loginIntro: { gap: 4, marginBottom: 4 },
  loginEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  loginTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -0.6 },
  loginDetail: { fontSize: 14, lineHeight: 20 },
});