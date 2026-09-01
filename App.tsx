import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AppState, Button, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';

import { BASIC_VARIANT_NAMES } from './src/protocol/lobbyProtocol';
import { isJoinEligible, isSpectateEligible } from './src/runtime/LobbyRuntime';
import { lobbyRuntime, networkSession } from './src/runtime/application';
import { useAppSelector } from './src/store/hooks';
import { selectLobbyHydrated, tableSelectors } from './src/store/store';
import { GameScreen } from './src/ui/game/GameScreen';
import { ChatPanel } from './src/ui/ChatPanel';

type ProbeStatus = 'checking' | 'valid' | 'missing' | 'indeterminate';

export default function App() {
  const [probe, setProbe] = useState<ProbeStatus>('checking');
  const [statusMessage, setStatusMessage] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tableName, setTableName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [variant, setVariant] = useState<(typeof BASIC_VARIANT_NAMES)[number]>('No Variant');
  const session = useAppSelector((state) => state.session);
  const hydrated = useAppSelector(selectLobbyHydrated);
  const tables = useAppSelector(tableSelectors.selectAll);
  const lobbyNotice = useAppSelector((state) => state.lobby.notice);
  const roomState = useAppSelector((state) => state.room);
  const spectateTables = tables.filter(isSpectateEligible);
  const joinTables = tables.filter(isJoinEligible);
  const pregameRoom = roomState.room.kind === 'pregame' ? roomState.room : null;
  const attendancePending = roomState.pendingSpectateTableID !== null
    || roomState.pendingRecovery !== null
    || roomState.pendingJoin !== null
    || roomState.pendingCreate !== null;

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

  const submitLogin = async () => {
    setLoginPending(true);
    setStatusMessage('');
    try {
      await networkSession.submitLogin(username, password);
      setPassword('');
      const result = await lobbyRuntime.checkSession();
      if (result.kind === 'valid') {
        setProbe('valid');
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
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.authBar}>
          <Text style={styles.authName}>{session.authenticatedUser?.username ?? 'Hanab'}</Text>
          <Button title="Sign out" onPress={() => void signOut()} />
        </View>
        <ScrollView contentContainerStyle={styles.gameContainer} keyboardShouldPersistTaps="handled">
          <GameScreen />
          <ChatPanel room={`table${roomState.room.tableID}`} title="Table chat" />
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
        <Button title="Retry" onPress={() => void lobbyRuntime.connect()} />
      </View>
    );
  } else if (session.phase !== 'ready' || !hydrated) {
    content = <Text>Connecting to lobby...</Text>;
  } else if (roomState.room.kind === 'awaiting_game_bootstrap') {
    content = <Text style={styles.heading}>Loading game...</Text>;
  } else if (pregameRoom !== null) {
    const isOwner = session.authenticatedUser?.userID === pregameRoom.data.owner;
    content = (
      <View style={styles.section}>
        <Text style={styles.heading}>{pregameRoom.data.name}</Text>
        <Text>{pregameRoom.data.options.variantName}</Text>
        <Text>{pregameRoom.data.players.length}/{pregameRoom.data.maxPlayers} players</Text>
        {pregameRoom.data.players.map((player) => (
          <Text key={player.index}>
            {player.name}{player.you ? ' (you)' : ''}{player.present ? '' : ' (away)'}
          </Text>
        ))}
        {isOwner && (
          <Button disabled={pregameRoom.data.players.length < 2
              || roomState.pendingStart !== null || roomState.pendingLeaveTableID !== null}
            title={roomState.pendingStart === null ? 'Start' : 'Starting...'}
            onPress={() => lobbyRuntime.startGame()} />
        )}
        <Button disabled={roomState.pendingLeaveTableID !== null || roomState.pendingStart !== null}
          title={roomState.pendingLeaveTableID === null ? 'Leave' : 'Leaving...'}
          onPress={() => lobbyRuntime.leave(pregameRoom.tableID)} />
        <ChatPanel room={`table${pregameRoom.tableID}`} title="Pre-game chat" />
      </View>
    );
  } else {
    content = (
      <>
        <View style={styles.section}>
          <Text style={styles.heading}>Lobby</Text>
          <Text>{tables.length} tables available</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Create table</Text>
          <TextInput maxLength={45} onChangeText={setTableName} placeholder="Table name"
            style={styles.input} value={tableName} />
          <Text>Max players: {maxPlayers}</Text>
          <View style={styles.buttonRow}>
            <Button disabled={maxPlayers <= 2} title="−"
              onPress={() => setMaxPlayers((count) => count - 1)} />
            <Button disabled={maxPlayers >= 6} title="+"
              onPress={() => setMaxPlayers((count) => count + 1)} />
          </View>
          <Text>Variant</Text>
          {BASIC_VARIANT_NAMES.map((name) => (
            <Button key={name} title={`${variant === name ? '✓ ' : ''}${name}`}
              onPress={() => setVariant(name)} />
          ))}
          <Button disabled={attendancePending || tableName.trim().length === 0}
            title={roomState.pendingCreate === null ? 'Create' : 'Creating...'}
            onPress={() => lobbyRuntime.createTable(tableName, maxPlayers, variant)} />
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Running tables</Text>
          {spectateTables.length === 0 && <Text>No running tables.</Text>}
          {spectateTables.map((table) => (
            <View style={styles.tableRow} key={table.id}>
              <Text style={styles.tableName}>{table.name}</Text>
              <Text>{table.variant} · {table.numPlayers}/{table.maxPlayers}</Text>
              <Button disabled={attendancePending} title="Spectate"
                onPress={() => lobbyRuntime.spectate(table.id)} />
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Joinable tables</Text>
          {joinTables.length === 0 && <Text>No joinable tables.</Text>}
          {joinTables.map((table) => (
            <View style={styles.tableRow} key={table.id}>
              <Text style={styles.tableName}>{table.name}</Text>
              <Text>{table.variant} · {table.numPlayers}/{table.maxPlayers}</Text>
              <Button disabled={attendancePending} title="Join"
                onPress={() => lobbyRuntime.join(table.id)} />
            </View>
          ))}
        </View>
        <ChatPanel room="lobby" title="Lobby chat" />
      </>
    );
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: 16, padding: 20, paddingTop: 56 },
  gameContainer: { flexGrow: 1, padding: 16, paddingTop: 48 },
  centered: { flex: 1, gap: 8, justifyContent: 'center', padding: 24 },
  authBar: {
    alignItems: 'center', borderBottomColor: '#d5d9dd', borderBottomWidth: 1,
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16,
    paddingTop: 44, paddingBottom: 8,
  },
  authName: { fontSize: 16, fontWeight: '700' },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '700' },
  section: { borderColor: '#999', borderWidth: 1, gap: 10, padding: 14 },
  heading: { fontSize: 19, fontWeight: '600' },
  input: { borderColor: '#777', borderWidth: 1, padding: 10 },
  tableRow: { borderColor: '#bbb', borderWidth: 1, gap: 5, padding: 10 },
  tableName: { fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  error: { color: '#a00' },
});
