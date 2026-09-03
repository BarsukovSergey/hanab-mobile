import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AppState, BackHandler, Button, KeyboardAvoidingView, Platform, ScrollView,
  Text, TextInput, View,
} from 'react-native';

import { lobbyRuntime, networkSession } from './src/runtime/application';
import { useAppSelector } from './src/store/hooks';
import { selectLobbyHydrated } from './src/store/store';
import { ChatPanel } from './src/ui/ChatPanel';
import { GameScreen } from './src/ui/game/GameScreen';
import { getBackAction, type LocalScreen } from './src/ui/navigationPolicy';
import { HistoryScreen } from './src/ui/screens/HistoryScreen';
import { LobbyScreen } from './src/ui/screens/LobbyScreen';
import { PregameScreen } from './src/ui/screens/PregameScreen';
import { shellStyles as styles } from './src/ui/shellStyles';

type ProbeStatus = 'checking' | 'valid' | 'missing' | 'indeterminate';

export default function App() {
  const [probe, setProbe] = useState<ProbeStatus>('checking');
  const [statusMessage, setStatusMessage] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localScreen, setLocalScreen] = useState<LocalScreen>('lobby');
  const session = useAppSelector((state) => state.session);
  const hydrated = useAppSelector(selectLobbyHydrated);
  const lobbyNotice = useAppSelector((state) => state.lobby.notice);
  const roomState = useAppSelector((state) => state.room);

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
    }
  }, [roomState.room.kind, roomState.rematchTransition]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const action = getBackAction({
        localScreen,
        authenticated: probe === 'valid' && session.phase === 'ready' && hydrated,
        roomKind: roomState.room.kind,
        rematchPending: roomState.rematchTransition !== null,
      });
      if (action === 'go_to_lobby') {
        setLocalScreen('lobby');
        return true;
      }
      return action === 'consume';
    });
    return () => subscription.remove();
  }, [hydrated, localScreen, probe, roomState.rematchTransition, roomState.room.kind, session.phase]);

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
      <View style={styles.centered}>
        <Text style={styles.heading}>Signing out…</Text>
        <Text>Closing the realtime session and clearing local game data.</Text>
      </View>
    );
  }

  if (probe === 'valid' && roomState.room.kind === 'live_game') {
    const liveTableID = roomState.room.tableID;
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.authBar}>
          <Text style={styles.authName}>{session.authenticatedUser?.username ?? 'Hanab'}</Text>
          <View style={styles.authActions}>
            <Button disabled={roomState.pendingUnattendTableID !== null}
              title={roomState.pendingUnattendTableID === null ? 'Lobby' : 'Leaving...'}
              onPress={() => lobbyRuntime.unattendLiveGame(liveTableID)} />
            <Button title="Sign out" onPress={() => void signOut()} />
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.gameContainer} keyboardShouldPersistTaps="handled">
          <GameScreen />
          <ChatPanel room={`table${liveTableID}`} title="Table chat" />
        </ScrollView>
        <StatusBar style="auto" />
      </KeyboardAvoidingView>
    );
  }

  let content: ReactNode;
  if (probe === 'checking') {
    content = <Text>Checking session...</Text>;
  } else if (probe === 'missing') {
    content = (
      <View style={styles.section}>
        <Text style={styles.heading}>Login</Text>
        {statusMessage.length > 0 && <Text style={styles.error}>{statusMessage}</Text>}
        <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setUsername}
          placeholder="Username" style={styles.input} value={username} />
        <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setPassword}
          placeholder="Password" secureTextEntry style={styles.input} value={password} />
        <Button disabled={loginPending || username.trim().length === 0 || password.length === 0}
          title={loginPending ? 'Logging in...' : 'Login'} onPress={() => void submitLogin()} />
      </View>
    );
  } else if (probe === 'indeterminate') {
    content = (
      <View style={styles.section}>
        <Text style={styles.heading}>Unable to check session</Text>
        <Text style={styles.error}>{statusMessage || 'Network request failed.'}</Text>
        <Button title="Retry" onPress={() => void runProbe()} />
      </View>
    );
  } else if (session.phase === 'failed' || session.phase === 'closed') {
    content = (
      <View style={styles.section}>
        <Text style={styles.heading}>Connection lost</Text>
        {session.error !== null && <Text style={styles.error}>{session.error}</Text>}
        <Button title="Retry" onPress={() => { lobbyRuntime.disconnect(); void runProbe(); }} />
      </View>
    );
  } else if (session.phase !== 'ready' || !hydrated) {
    content = <Text>Connecting to lobby...</Text>;
  } else if (roomState.room.kind === 'awaiting_game_bootstrap') {
    content = <Text style={styles.heading}>Loading game...</Text>;
  } else if (roomState.rematchTransition !== null) {
    content = <Text style={styles.heading}>Starting rematch...</Text>;
  } else if (roomState.room.kind === 'pregame') {
    content = <PregameScreen />;
  } else if (localScreen === 'history') {
    content = <HistoryScreen onBack={() => setLocalScreen('lobby')} />;
  } else {
    content = <LobbyScreen onOpenHistory={() => setLocalScreen('history')} />;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <Text style={styles.title}>Hanab</Text>
          {probe === 'valid' && session.authenticatedUser !== null && (
            <Button title="Sign out" onPress={() => void signOut()} />
          )}
        </View>
        {lobbyNotice !== null && (
          <Text style={lobbyNotice.kind === 'error' ? styles.error : undefined}>
            {lobbyNotice.message}
          </Text>
        )}
        {content}
        <StatusBar style="auto" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
