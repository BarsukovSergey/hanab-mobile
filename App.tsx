import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { runGameCoreProbe } from './src/game/c2/gameCoreProbe';
import { isSpectateEligible } from './src/runtime/LobbyRuntime';
import { lobbyRuntime, networkSession } from './src/runtime/application';
import { useAppSelector } from './src/store/hooks';
import {
  selectAuthReady,
  selectLobbyHydrated,
  tableSelectors,
  userSelectors,
} from './src/store/store';

type ProbeStatus = 'UNKNOWN' | 'VALID' | 'MISSING' | 'INDETERMINATE';
type LoginStatus = 'NOT_ATTEMPTED' | 'SUCCESS' | 'FAILED';

export default function App() {
  const [gameCoreProbe] = useState(runGameCoreProbe);
  const [probe, setProbe] = useState<ProbeStatus>('UNKNOWN');
  const [probeNote, setProbeNote] = useState('');
  const [login, setLogin] = useState<LoginStatus>('NOT_ATTEMPTED');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const session = useAppSelector((state) => state.session);
  const lobby = useAppSelector((state) => state.lobby);
  const authReady = useAppSelector(selectAuthReady);
  const hydrated = useAppSelector(selectLobbyHydrated);
  const usersCount = useAppSelector(userSelectors.selectTotal);
  const tablesCount = useAppSelector(tableSelectors.selectTotal);
  const tables = useAppSelector(tableSelectors.selectAll);
  const roomState = useAppSelector((state) => state.room);
  const spectateTables = tables.filter(isSpectateEligible);

  const runProbe = useCallback(async () => {
    setProbe('UNKNOWN');
    setProbeNote('Checking...');
    const result = await networkSession.checkSession();
    if (result.kind === 'valid') {
      setProbe('VALID');
      setProbeNote('HTTP 200');
    } else if (result.kind === 'missing') {
      setProbe('MISSING');
      setProbeNote('HTTP 204');
    } else {
      setProbe('INDETERMINATE');
      setProbeNote(result.error.message);
    }
  }, []);

  useEffect(() => {
    void runProbe();
  }, [runProbe]);

  useEffect(() => () => lobbyRuntime.disconnect(), []);

  const submitLogin = async () => {
    setLogin('NOT_ATTEMPTED');
    try {
      await networkSession.submitLogin(username, password);
      setPassword('');
      const result = await networkSession.checkSession();
      if (result.kind === 'valid') {
        setLogin('SUCCESS');
        setProbe('VALID');
        setProbeNote('HTTP 200 after login');
      } else {
        setLogin('FAILED');
        setProbe(result.kind === 'missing' ? 'MISSING' : 'INDETERMINATE');
        setProbeNote(
          result.kind === 'indeterminate'
            ? result.error.message
            : 'Login POST succeeded but session probe returned HTTP 204',
        );
      }
    } catch (error) {
      setPassword('');
      setLogin('FAILED');
      setProbeNote(error instanceof Error ? error.message : 'Login request failed');
    }
  };

  const canConnect = probe === 'VALID'
    && !['connecting', 'openAwaitingWelcome', 'ready'].includes(session.phase);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Hanab C4-A Proof</Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Typed lobby runtime</Text>
          <Text>Connection epoch: {session.connectionEpoch}</Text>
          <Text>Connection phase: {session.phase}</Text>
          <Text>Welcome: {authReady ? 'YES' : 'NO'}</Text>
          <Text>User list: {lobby.userListReceived ? 'YES' : 'NO'}</Text>
          <Text>Table list: {lobby.tableListReceived ? 'YES' : 'NO'}</Text>
          <Text>Lobby hydrated: {hydrated ? 'YES' : 'NO'}</Text>
          <Text>Users count: {usersCount}</Text>
          <Text>Tables count: {tablesCount}</Text>
          <Text>Protocol issue count: {session.protocolIssueCount}</Text>
          {session.error !== null && <Text selectable>Error: {session.error}</Text>}
          {session.lastProtocolIssue !== null && (
            <Text selectable>Last protocol issue: {session.lastProtocolIssue}</Text>
          )}
          {lobby.notice !== null && (
            <Text selectable>{lobby.notice.kind}: {lobby.notice.message}</Text>
          )}
          <Button
            disabled={!canConnect}
            title="Connect realtime"
            onPress={() => void lobbyRuntime.connect()}
          />
          <Button
            disabled={session.phase === 'idle' || session.phase === 'closed'}
            title="Disconnect"
            onPress={() => lobbyRuntime.disconnect()}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Running tables</Text>
          {spectateTables.length === 0 && <Text>No eligible running tables.</Text>}
          {spectateTables.map((table) => (
            <View style={styles.tableRow} key={table.id}>
              <Text style={styles.tableName}>{table.name}</Text>
              <Text>{table.variant} · {table.numPlayers}/{table.maxPlayers}</Text>
              <Button
                disabled={session.phase !== 'ready'
                  || roomState.pendingSpectateTableID !== null
                  || roomState.room.kind !== 'none'}
                title={roomState.pendingSpectateTableID === table.id
                  ? 'Awaiting tableStart'
                  : 'Spectate'}
                onPress={() => lobbyRuntime.spectate(table.id)}
              />
            </View>
          ))}
        </View>

        {roomState.room.kind === 'awaiting_game_bootstrap' && (
          <View style={styles.section}>
            <Text style={styles.heading}>C4-A authoritative room</Text>
            <Text>tableID: {roomState.room.tableID}</Text>
            <Text>role: spectator</Text>
            <Text>tableStart: YES</Text>
            <Text>bootstrap: PENDING C5</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.heading}>Session</Text>
          <Text>Session probe: {probe}</Text>
          <Text selectable>{probeNote}</Text>
          <Text>Login: {login}</Text>
          <Button title="Probe session" onPress={() => void runProbe()} />
        </View>

        {probe !== 'VALID' && (
          <View style={styles.section}>
            <Text style={styles.heading}>Login</Text>
            <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setUsername}
              placeholder="username" style={styles.input} value={username} />
            <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setPassword}
              placeholder="password" secureTextEntry style={styles.input} value={password} />
            <Button disabled={username.length === 0 || password.length === 0}
              title="Login and verify" onPress={() => void submitLogin()} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.heading}>C2 pinned game core</Text>
          <Text>Game core import: {gameCoreProbe.gameCoreImport ? 'PASS' : 'FAIL'}</Text>
          <Text>Reducer sequence: {gameCoreProbe.reducerSequence ? 'PASS' : 'FAIL'}</Text>
          <Text>Hermes runtime: {gameCoreProbe.hermes ? 'YES' : 'NO'}</Text>
          <Text>Probe: {gameCoreProbe.deviceProbePassed ? 'PASS' : 'FAIL'}</Text>
        </View>
        <StatusBar style="auto" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: 12, padding: 20, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: '700' },
  section: { borderColor: '#999', borderWidth: 1, gap: 8, padding: 12 },
  heading: { fontSize: 18, fontWeight: '600' },
  input: { borderColor: '#777', borderWidth: 1, padding: 10 },
  tableRow: { borderColor: '#bbb', borderWidth: 1, gap: 3, padding: 10 },
  tableName: { fontWeight: '600' },
});
