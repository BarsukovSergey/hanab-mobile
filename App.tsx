import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AppState, Button, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';

import { SUPPORTED_VARIANT_NAMES } from './src/game/client/supportedVariants';
import type { MobileTableOptions } from './src/protocol/lobbyProtocol';
import {
  isJoinEligible,
  isPregameSpectateEligible,
  isReattendEligible,
  isSpectateEligible,
} from './src/runtime/LobbyRuntime';
import { lobbyRuntime, networkSession } from './src/runtime/application';
import { useAppSelector } from './src/store/hooks';
import { selectLobbyHydrated, tableSelectors } from './src/store/store';
import { GameScreen } from './src/ui/game/GameScreen';
import { ChatPanel } from './src/ui/ChatPanel';

type ProbeStatus = 'checking' | 'valid' | 'missing' | 'indeterminate';

const defaultMobileOptions: MobileTableOptions = {
  variantName: 'No Variant', cardCycle: false, emptyClues: false,
  oneExtraCard: false, oneLessCard: false, allOrNothing: false,
};

export default function App() {
  const [probe, setProbe] = useState<ProbeStatus>('checking');
  const [statusMessage, setStatusMessage] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tableName, setTableName] = useState('');
  const [tablePassword, setTablePassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [createOptions, setCreateOptions] = useState<MobileTableOptions>(defaultMobileOptions);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinPasswordTableID, setJoinPasswordTableID] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editMaxPlayers, setEditMaxPlayers] = useState(5);
  const [editOptions, setEditOptions] = useState<MobileTableOptions>(defaultMobileOptions);
  const session = useAppSelector((state) => state.session);
  const hydrated = useAppSelector(selectLobbyHydrated);
  const tables = useAppSelector(tableSelectors.selectAll);
  const lobbyNotice = useAppSelector((state) => state.lobby.notice);
  const roomState = useAppSelector((state) => state.room);
  const spectateTables = tables.filter(isSpectateEligible);
  const joinTables = tables.filter((table) => (
    isJoinEligible(table) || isPregameSpectateEligible(table)
  ));
  const reattendTables = tables.filter(isReattendEligible);
  const pregameRoom = roomState.room.kind === 'pregame' ? roomState.room : null;
  const attendancePending = roomState.pendingSpectateTableID !== null
    || roomState.pendingRecovery !== null
    || roomState.pendingJoin !== null
    || roomState.pendingCreate !== null;

  useEffect(() => {
    if (pregameRoom === null) return;
    setEditName(pregameRoom.data.name);
    setEditMaxPlayers(pregameRoom.data.maxPlayers);
    setEditOptions({
      variantName: pregameRoom.data.options.variantName,
      cardCycle: pregameRoom.data.options.cardCycle,
      emptyClues: pregameRoom.data.options.emptyClues,
      oneExtraCard: pregameRoom.data.options.oneExtraCard,
      oneLessCard: pregameRoom.data.options.oneLessCard,
      allOrNothing: pregameRoom.data.options.allOrNothing,
    });
  }, [pregameRoom?.data]);

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
    const liveTableID = roomState.room.tableID;
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.authBar}>
          <Text style={styles.authName}>{session.authenticatedUser?.username ?? 'Hanab'}</Text>
          <View style={styles.authActions}>
            <Button
              disabled={roomState.pendingUnattendTableID !== null}
              title={roomState.pendingUnattendTableID === null ? 'Lobby' : 'Leaving...'}
              onPress={() => lobbyRuntime.unattendLiveGame(liveTableID)}
            />
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
        <Button title="Retry" onPress={() => void lobbyRuntime.connect()} />
      </View>
    );
  } else if (session.phase !== 'ready' || !hydrated) {
    content = <Text>Connecting to lobby...</Text>;
  } else if (roomState.room.kind === 'awaiting_game_bootstrap') {
    content = <Text style={styles.heading}>Loading game...</Text>;
  } else if (roomState.rematchTransition !== null) {
    content = <Text style={styles.heading}>Starting rematch...</Text>;
  } else if (pregameRoom !== null) {
    const isOwner = pregameRoom.role === 'player'
      && session.authenticatedUser?.userID === pregameRoom.data.owner;
    content = (
      <View style={styles.section}>
        <Text style={styles.heading}>{pregameRoom.data.name}</Text>
        <Text>{pregameRoom.data.options.variantName}</Text>
        <Text>{pregameRoom.role === 'spectator' ? 'Spectating pregame' : 'Joined as player'}</Text>
        <Text>{pregameRoom.data.players.length}/{pregameRoom.data.maxPlayers} players</Text>
        {pregameRoom.data.players.map((player) => (
          <Text key={player.index}>
            {player.name}{player.you ? ' (you)' : ''}{player.present ? '' : ' (away)'}
          </Text>
        ))}
        {isOwner && (<>
          <View style={styles.subsection}>
            <Text style={styles.heading}>Edit table</Text>
            <TextInput maxLength={45} onChangeText={setEditName} placeholder="Table name"
              style={styles.input} value={editName} />
            <Text>Max players: {editMaxPlayers}</Text>
            <View style={styles.buttonRow}>
              <Button disabled={editMaxPlayers <= 2} title="−"
                onPress={() => setEditMaxPlayers((count) => count - 1)} />
              <Button disabled={editMaxPlayers >= 6} title="+"
                onPress={() => setEditMaxPlayers((count) => count + 1)} />
            </View>
            <TableOptionsEditor options={editOptions} onChange={setEditOptions} />
            <Button disabled={roomState.pendingUpdate !== null
                || editName.trim().length === 0}
              title={roomState.pendingUpdate === null ? 'Apply changes' : 'Applying...'}
              onPress={() => lobbyRuntime.updateTable(editName, editMaxPlayers, editOptions)} />
          </View>
          <Text style={styles.heading}>Transfer leader</Text>
          {pregameRoom.data.players.filter((player) => !player.you).map((player) => (
            <Button key={`leader-${player.name}`} disabled={roomState.pendingLeaderName !== null}
              title={roomState.pendingLeaderName === player.name
                ? `Transferring to ${player.name}...` : `Make ${player.name} leader`}
              onPress={() => lobbyRuntime.setTableLeader(player.name)} />
          ))}
          <Button disabled={pregameRoom.data.players.length < 2
              || roomState.pendingStart !== null || roomState.pendingLeaveTableID !== null}
            title={roomState.pendingStart === null ? 'Start' : 'Starting...'}
            onPress={() => lobbyRuntime.startGame()} />
        </>)}
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
          <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setTablePassword}
            placeholder="Table password (optional)" secureTextEntry style={styles.input}
            value={tablePassword} />
          <Text>Max players: {maxPlayers}</Text>
          <View style={styles.buttonRow}>
            <Button disabled={maxPlayers <= 2} title="−"
              onPress={() => setMaxPlayers((count) => count - 1)} />
            <Button disabled={maxPlayers >= 6} title="+"
              onPress={() => setMaxPlayers((count) => count + 1)} />
          </View>
          <TableOptionsEditor options={createOptions} onChange={setCreateOptions} />
          <Button disabled={attendancePending || tableName.trim().length === 0}
            title={roomState.pendingCreate === null ? 'Create' : 'Creating...'}
            onPress={() => {
              if (lobbyRuntime.createTable(tableName, maxPlayers, createOptions, tablePassword)) {
                setTablePassword('');
              }
            }} />
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Your running game</Text>
          {reattendTables.length === 0 && <Text>No game to resume.</Text>}
          {reattendTables.map((table) => (
            <View style={styles.tableRow} key={table.id}>
              <Text style={styles.tableName}>{table.name}</Text>
              <Text>{table.variant} · {table.numPlayers}/{table.maxPlayers}</Text>
              <Button disabled={attendancePending} title="Return to game"
                onPress={() => lobbyRuntime.reattend(table.id)} />
            </View>
          ))}
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
          <Text style={styles.heading}>Pregame tables</Text>
          {joinTables.length === 0 && <Text>No pregame tables.</Text>}
          {joinTables.map((table) => (
            <View style={styles.tableRow} key={table.id}>
              <Text style={styles.tableName}>{table.name}</Text>
              <Text>{table.variant} · {table.numPlayers}/{table.maxPlayers}</Text>
              {table.passwordProtected && (
                <TextInput autoCapitalize="none" autoCorrect={false}
                  onChangeText={(value) => {
                    setJoinPasswordTableID(table.id);
                    setJoinPassword(value);
                  }} placeholder="Table password" secureTextEntry style={styles.input}
                  value={joinPasswordTableID === table.id ? joinPassword : ''} />
              )}
              {isJoinEligible(table) && (
                <Button disabled={attendancePending} title="Join"
                  onPress={() => {
                    const tableSecret = joinPasswordTableID === table.id
                      ? joinPassword : undefined;
                    if (lobbyRuntime.join(table.id, tableSecret)) {
                      setJoinPassword('');
                      setJoinPasswordTableID(null);
                    }
                  }} />
              )}
              {isPregameSpectateEligible(table) && (
                <Button disabled={attendancePending} title="Spectate pregame"
                  onPress={() => lobbyRuntime.spectate(table.id)} />
              )}
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

function TableOptionsEditor({
  options,
  onChange,
}: {
  options: MobileTableOptions;
  onChange: (options: MobileTableOptions) => void;
}) {
  const [variantSearch, setVariantSearch] = useState('');
  const matchingVariants = SUPPORTED_VARIANT_NAMES.filter((name) => (
    name.toLocaleLowerCase().includes(variantSearch.trim().toLocaleLowerCase())
  )).slice(0, 20);
  const toggle = (key: Exclude<keyof MobileTableOptions, 'variantName'>) => {
    const value = !options[key];
    onChange({
      ...options,
      [key]: value,
      ...(key === 'oneExtraCard' && value ? { oneLessCard: false } : {}),
      ...(key === 'oneLessCard' && value ? { oneExtraCard: false } : {}),
    });
  };
  return (
    <View style={styles.subsection}>
      <Text>Variant</Text>
      <TextInput
        autoCapitalize="none"
        onChangeText={setVariantSearch}
        placeholder="Search variants"
        value={variantSearch}
      />
      {matchingVariants.map((name) => (
        <Button key={name} title={`${options.variantName === name ? '✓ ' : ''}${name}`}
          onPress={() => onChange({ ...options, variantName: name })} />
      ))}
      {([
        ['cardCycle', 'Card Cycle'],
        ['emptyClues', 'Empty Clues'],
        ['oneExtraCard', 'One Extra Card'],
        ['oneLessCard', 'One Less Card'],
        ['allOrNothing', 'All or Nothing'],
      ] as const).map(([key, label]) => (
        <Button key={key} title={`${options[key] ? '✓ ' : ''}${label}`}
          onPress={() => toggle(key)} />
      ))}
    </View>
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
  authActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '700' },
  section: { borderColor: '#999', borderWidth: 1, gap: 10, padding: 14 },
  subsection: { gap: 8 },
  heading: { fontSize: 19, fontWeight: '600' },
  input: { borderColor: '#777', borderWidth: 1, padding: 10 },
  tableRow: { borderColor: '#bbb', borderWidth: 1, gap: 5, padding: 10 },
  tableName: { fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  error: { color: '#a00' },
});
