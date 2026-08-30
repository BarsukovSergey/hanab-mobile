import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RawInboundCapture } from './src/diagnostics/rawCapture';
import {
  countArrayPayload,
  observeWireMessage,
} from './src/diagnostics/wireObservation';
import { HanabNetworkSession } from './src/network/NetworkSession';
import type { NetworkSocket } from './src/network/types';

type ProbeStatus = 'UNKNOWN' | 'VALID' | 'MISSING' | 'INDETERMINATE';
type LoginStatus = 'NOT_ATTEMPTED' | 'SUCCESS' | 'FAILED';
type SocketStatus = 'IDLE' | 'CONNECTING' | 'OPEN' | 'CLOSED' | 'ERROR';

const session = new HanabNetworkSession();

function timestamp(): string {
  return new Date().toISOString();
}

function readyStateLabel(socket: NetworkSocket | null): string {
  if (socket === null) return 'NONE';
  return ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][socket.readyState] ?? 'UNKNOWN';
}

export default function App() {
  const [probe, setProbe] = useState<ProbeStatus>('UNKNOWN');
  const [probeNote, setProbeNote] = useState('');
  const [login, setLogin] = useState<LoginStatus>('NOT_ATTEMPTED');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('IDLE');
  const [welcome, setWelcome] = useState(false);
  const [users, setUsers] = useState<number | null>(null);
  const [tables, setTables] = useState<number | null>(null);
  const [lastCommand, setLastCommand] = useState('none');
  const [lastPayloadBytes, setLastPayloadBytes] = useState(0);
  const [observations, setObservations] = useState<string[]>([]);
  const [captureStarted, setCaptureStarted] = useState(false);
  const [captureFrameCount, setCaptureFrameCount] = useState(0);
  const [captureComplete, setCaptureComplete] = useState(false);
  const socketRef = useRef<NetworkSocket | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundAtRef = useRef<string | null>(null);
  const captureRef = useRef(new RawInboundCapture());

  const addObservation = useCallback((message: string) => {
    setObservations((current) => [`${timestamp()} ${message}`, ...current].slice(0, 20));
  }, []);

  const runProbe = useCallback(async () => {
    setProbe('UNKNOWN');
    setProbeNote('Checking...');
    const result = await session.checkSession();
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const socket = socketRef.current;
      if (nextState === 'background') {
        backgroundAtRef.current = timestamp();
        addObservation(`BACKGROUND; socket=${readyStateLabel(socket)}`);
      } else if (
        nextState === 'active' &&
        appStateRef.current !== 'active'
      ) {
        addObservation(
          `FOREGROUND; backgroundAt=${backgroundAtRef.current ?? 'unknown'}; socket=${readyStateLabel(socket)}`,
        );
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [addObservation]);

  useEffect(
    () => () => {
      socketRef.current?.close(1000, 'C1 app unmounted');
      socketRef.current = null;
    },
    [],
  );

  const submitLogin = async () => {
    setLogin('NOT_ATTEMPTED');
    try {
      await session.submitLogin(username, password);
      setPassword('');
      const result = await session.checkSession();
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

  const openSocket = async () => {
    setSocketStatus('CONNECTING');
    setWelcome(false);
    setUsers(null);
    setTables(null);
    try {
      const socket = await session.openSocket();
      socketRef.current = socket;
      socket.addEventListener('open', () => {
        if (socketRef.current !== socket) return;
        setSocketStatus('OPEN');
        addObservation('WebSocket OPEN');
      });
      socket.addEventListener('message', (event) => {
        if (socketRef.current !== socket || typeof event.data !== 'string') return;
        const observed = observeWireMessage(event.data);
        if (observed === null) return;
        setLastCommand(observed.command);
        setLastPayloadBytes(observed.payloadByteCount);
        captureRef.current.append(observed.command, event.data);
        setCaptureComplete(captureRef.current.isComplete);
        setCaptureFrameCount(captureRef.current.frameCount);
        if (appStateRef.current !== 'active') {
          addObservation(`MESSAGE while ${appStateRef.current}: ${observed.command} (${observed.payloadByteCount} bytes)`);
        }
        if (observed.command === 'welcome' && observed.parsedPayload !== undefined) {
          setWelcome(true);
        } else if (observed.command === 'userList') {
          setUsers(countArrayPayload(observed.parsedPayload));
        } else if (observed.command === 'tableList') {
          setTables(countArrayPayload(observed.parsedPayload));
        }
      });
      socket.addEventListener('error', () => {
        if (socketRef.current !== socket) return;
        setSocketStatus('ERROR');
        addObservation('WebSocket ERROR');
      });
      socket.addEventListener('close', (event) => {
        if (socketRef.current !== socket) return;
        setSocketStatus('CLOSED');
        addObservation(`WebSocket CLOSED code=${event.code}`);
      });
    } catch (error) {
      setSocketStatus('ERROR');
      addObservation(error instanceof Error ? error.message : 'WebSocket creation failed');
    }
  };

  const closeSocket = () => {
    socketRef.current?.close(1000, 'C1 manual close');
  };

  const startCapture = () => {
    captureRef.current.start();
    setCaptureStarted(true);
    setCaptureFrameCount(0);
    setCaptureComplete(false);
  };

  const socketCanOpen = socketStatus === 'IDLE' || socketStatus === 'CLOSED' || socketStatus === 'ERROR';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Hanab C1 Network Proof</Text>

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
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setUsername}
              placeholder="username"
              style={styles.input}
              value={username}
            />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPassword}
              placeholder="password"
              secureTextEntry
              style={styles.input}
              value={password}
            />
            <Button
              disabled={username.length === 0 || password.length === 0}
              title="Login and verify"
              onPress={() => void submitLogin()}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.heading}>WebSocket</Text>
          <Text>Socket: {socketStatus}</Text>
          <Text>Welcome: {welcome ? 'YES' : 'NO'}</Text>
          <Text>Users: {users ?? 'unknown'}</Text>
          <Text>Tables: {tables ?? 'unknown'}</Text>
          <Text>Last command: {lastCommand}</Text>
          <Text>Last payload bytes: {lastPayloadBytes}</Text>
          <Button disabled={!socketCanOpen || probe !== 'VALID'} title="Open socket" onPress={() => void openSocket()} />
          <Button disabled={socketStatus !== 'OPEN'} title="Close socket" onPress={closeSocket} />
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Raw in-memory capture</Text>
          <Text style={styles.warning}>Sensitive and process-local. It is never displayed or logged, and a process restart clears it.</Text>
          <Button title="Start new capture" onPress={startCapture} />
          <Text>Capture: {captureStarted ? 'ACTIVE' : 'NOT STARTED'}</Text>
          <Text>Required frames held: {captureFrameCount}</Text>
          <Text>Contains welcome + userList + tableList: {captureComplete ? 'YES' : 'NO'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Lifecycle observations</Text>
          {observations.length === 0 ? <Text>none</Text> : observations.map((item) => <Text key={item}>{item}</Text>)}
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
  warning: { color: '#9a3412', fontWeight: '600' },
});
