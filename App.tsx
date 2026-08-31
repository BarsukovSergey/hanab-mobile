import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { isJoinEligible, isSpectateEligible } from './src/runtime/LobbyRuntime';
import { lobbyRuntime, networkSession } from './src/runtime/application';
import { useAppSelector } from './src/store/hooks';
import {
  selectAuthReady,
  selectLobbyHydrated,
  tableSelectors,
  userSelectors,
} from './src/store/store';
import { GameScreen } from './src/ui/game/GameScreen';

type ProbeStatus = 'UNKNOWN' | 'VALID' | 'MISSING' | 'INDETERMINATE';
type LoginStatus = 'NOT_ATTEMPTED' | 'SUCCESS' | 'FAILED';

export default function App() {
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
  const joinTables = tables.filter(isJoinEligible);
  const pregameRoom = roomState.room.kind === 'pregame' ? roomState.room : null;

  const runProbe = useCallback(async () => {
    setProbe('UNKNOWN');
    setProbeNote('Checking...');
    const result = await networkSession.checkSession();
    if (result.kind === 'valid') {
      setProbe('VALID');
      setProbeNote('HTTP 200');
      void lobbyRuntime.connect();
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
    setLogin('NOT_ATTEMPTED');
    try {
      await networkSession.submitLogin(username, password);
      setPassword('');
      const result = await networkSession.checkSession();
      if (result.kind === 'valid') {
        setLogin('SUCCESS');
        setProbe('VALID');
        setProbeNote('HTTP 200 after login');
        void lobbyRuntime.connect();
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

  if (roomState.room.kind === 'live_game') {
    return (
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.gameContainer}>
          <GameScreen />
        </ScrollView>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Hanab</Text>

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
          <Text style={styles.subheading}>Current-connection gameAction diagnostics</Text>
          <Text>Total gameAction frames seen: {session.gameActionFramesSeen}</Text>
          {session.gameActionDiagnostics.length === 0 && (
            <Text>No schema-valid gameAction details.</Text>
          )}
          {session.gameActionDiagnostics.map((diagnostic, index) => (
            <Text key={`${index}-${diagnostic.tableID}-${diagnostic.actionType}`} selectable>
              tableID {diagnostic.tableID}
              {' | '}action.type {diagnostic.actionType}
              {' | '}accepted {diagnostic.accepted ? 'YES' : 'NO'}
              {' | '}rejection reason {diagnostic.rejectionReason ?? 'NONE'}
            </Text>
          ))}
          <Text style={styles.subheading}>Recent inbound diagnostics</Text>
          {session.inboundDiagnostics.length === 0 && <Text>None</Text>}
          {session.inboundDiagnostics.map((diagnostic, index) => (
            <Text key={`${index}-${diagnostic.command}`} selectable>
              {diagnostic.command}: {diagnostic.classification}
              {diagnostic.gameAction === undefined
                ? ''
                : ` · tableID ${diagnostic.gameAction.tableID}`
                  + ` · ${diagnostic.gameAction.actionType}`
                  + ` · accepted ${diagnostic.gameAction.accepted ? 'YES' : 'NO'}`
                  + (diagnostic.gameAction.rejectionReason === null
                    ? ''
                    : ` · ${diagnostic.gameAction.rejectionReason}`)}
            </Text>
          ))}
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
                  || roomState.pendingRecovery !== null
                  || roomState.pendingJoin !== null
                  || roomState.room.kind !== 'none'}
                title={roomState.pendingSpectateTableID === table.id
                  ? 'Awaiting tableStart'
                  : 'Spectate'}
                onPress={() => lobbyRuntime.spectate(table.id)}
              />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Joinable pregame tables</Text>
          {joinTables.length === 0 && <Text>No eligible unprotected pregame tables.</Text>}
          {joinTables.map((table) => (
            <View style={styles.tableRow} key={table.id}>
              <Text style={styles.tableName}>{table.name}</Text>
              <Text>{table.variant} · {table.numPlayers}/{table.maxPlayers}</Text>
              <Button
                disabled={session.phase !== 'ready'
                  || roomState.pendingSpectateTableID !== null
                  || roomState.pendingRecovery !== null
                  || roomState.pendingJoin !== null
                  || roomState.room.kind !== 'none'}
                title={roomState.pendingJoin?.tableID === table.id
                  ? 'Awaiting authoritative join'
                  : 'Join'}
                onPress={() => lobbyRuntime.join(table.id)}
              />
            </View>
          ))}
        </View>

        {pregameRoom !== null && (
          <View style={styles.section}>
            <Text style={styles.heading}>Authoritative pregame room</Text>
            <Text>tableID: {pregameRoom.tableID}</Text>
            <Text>name: {pregameRoom.data.name}</Text>
            <Text>variant: {pregameRoom.data.options.variantName}</Text>
            <Text>
              players: {pregameRoom.data.players.length}/{pregameRoom.data.maxPlayers}
            </Text>
            {pregameRoom.data.players.map((player) => (
              <Text key={player.index}>
                {player.index + 1}. {player.name}{player.you ? ' (you)' : ''}
                {player.present ? '' : ' (away)'}
              </Text>
            ))}
            <Button
              disabled={session.phase !== 'ready'
                || roomState.pendingLeaveTableID !== null}
              title={roomState.pendingLeaveTableID === pregameRoom.tableID
                ? 'Awaiting authoritative left'
                : 'Leave'}
              onPress={() => lobbyRuntime.leave(pregameRoom.tableID)}
            />
          </View>
        )}

        {roomState.room.kind === 'awaiting_game_bootstrap' && (
          <View style={styles.section}>
            <Text style={styles.heading}>Authoritative game bootstrap</Text>
            <Text>tableID: {roomState.room.tableID}</Text>
            <Text>role: {roomState.room.role}</Text>
            <Text>
              gameLoadEpoch: {roomState.room.bootstrap === 'pending_c5'
                ? 'PENDING'
                : roomState.room.bootstrap.gameLoadEpoch}
            </Text>
            <Text>
              bootstrap phase: {roomState.room.bootstrap === 'pending_c5'
                ? 'pending'
                : roomState.room.bootstrap.phase}
            </Text>
            <Text>authoritative history actions: 0</Text>
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

        <StatusBar style="auto" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: 12, padding: 20, paddingTop: 56 },
  gameContainer: { flexGrow: 1, padding: 16, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: '700' },
  section: { borderColor: '#999', borderWidth: 1, gap: 8, padding: 12 },
  heading: { fontSize: 18, fontWeight: '600' },
  subheading: { fontSize: 16, fontWeight: '600', marginTop: 6 },
  input: { borderColor: '#777', borderWidth: 1, padding: 10 },
  tableRow: { borderColor: '#bbb', borderWidth: 1, gap: 3, padding: 10 },
  tableName: { fontWeight: '600' },
});
