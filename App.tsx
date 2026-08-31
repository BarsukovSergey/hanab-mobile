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

import { isJoinEligible, isSpectateEligible } from './src/runtime/LobbyRuntime';
import {
  getGameplayClueChoices,
  getVisibleCardIdentityLabel,
} from './src/game/selectors/gameplay';
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
  const liveRoom = roomState.room.kind === 'live_game' ? roomState.room : null;
  const playerLiveRoom = liveRoom?.role === 'player' ? liveRoom : null;
  const isOurTurn = playerLiveRoom !== null
    && playerLiveRoom.game.turn.currentPlayerIndex === playerLiveRoom.metadata.ourPlayerIndex;
  const gameplayControlsEnabled = session.phase === 'ready'
    && isOurTurn
    && roomState.pendingGameplayAction === null;
  const clueChoices = playerLiveRoom === null
    ? null
    : getGameplayClueChoices(playerLiveRoom.metadata.options.variantName);

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
        <Text style={styles.title}>Hanab C7 Proof</Text>

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

        {roomState.room.kind === 'live_game' && (
          <View style={styles.section}>
            <Text style={styles.heading}>Authoritative LIVE game</Text>
            <Text>tableID: {roomState.room.tableID}</Text>
            <Text>role: {roomState.room.role}</Text>
            <Text>gameLoadEpoch: {roomState.room.gameLoadEpoch}</Text>
            <Text>bootstrap phase: LIVE</Text>
            <Text>authoritative history actions: {roomState.room.historyActionCount}</Text>
            <Text>live actions: {roomState.room.liveActionCount}</Text>
            <Text>turn number: {roomState.room.game.turn.turnNum}</Text>
            <Text>
              current player: {roomState.room.game.turn.currentPlayerIndex === null
                ? 'none'
                : `${roomState.room.game.turn.currentPlayerIndex}: ${
                  roomState.room.metadata.playerNames[
                    roomState.room.game.turn.currentPlayerIndex
                  ]
                }`}
            </Text>
            <Text>score: {roomState.room.game.score}</Text>
            <Text>clue tokens: {roomState.room.game.clueTokens}</Text>
            <Text>strikes: {roomState.room.game.strikes.length}</Text>
            <Text>cards remaining: {roomState.room.game.cardsRemainingInTheDeck}</Text>

            {playerLiveRoom !== null && (
              <>
                <Text>our turn: {isOurTurn ? 'YES' : 'NO'}</Text>
                <Text>
                  pending action: {roomState.pendingGameplayAction === null
                    ? 'NONE'
                    : ['PLAY', 'DISCARD', 'COLOR CLUE', 'RANK CLUE'][
                      roomState.pendingGameplayAction.action.type
                    ]}
                </Text>
                <Text style={styles.subheading}>Our hand (authoritative card orders)</Text>
                {playerLiveRoom.game.hands[playerLiveRoom.metadata.ourPlayerIndex]?.map(
                  (order) => (
                    <View style={styles.actionRow} key={order}>
                      <Text style={styles.actionLabel}>card order {order}</Text>
                      <Button disabled={!gameplayControlsEnabled} title="Play"
                        onPress={() => lobbyRuntime.play(order)} />
                      <Button disabled={!gameplayControlsEnabled} title="Discard"
                        onPress={() => lobbyRuntime.discard(order)} />
                    </View>
                  ),
                )}

                <Text style={styles.subheading}>Other players and visible cards</Text>
                {playerLiveRoom.metadata.playerNames.map((name, playerIndex) => {
                  if (playerIndex === playerLiveRoom.metadata.ourPlayerIndex) return null;
                  return (
                    <View style={styles.playerRow} key={playerIndex}>
                      <Text style={styles.tableName}>{playerIndex}: {name}</Text>
                      {playerLiveRoom.game.hands[playerIndex]?.map((order) => {
                        const card = playerLiveRoom.game.deck[order];
                        return (
                          <Text key={order}>
                            order {order}: {card === undefined
                              ? 'unknown'
                              : getVisibleCardIdentityLabel(
                                playerLiveRoom.metadata.options.variantName,
                                card.suitIndex,
                                card.rank,
                              )}
                          </Text>
                        );
                      })}
                      <Text>Color clues:</Text>
                      <View style={styles.buttonWrap}>
                        {clueChoices?.colors.map((choice) => (
                          <Button disabled={!gameplayControlsEnabled} key={choice.value}
                            title={choice.label}
                            onPress={() => lobbyRuntime.colorClue(playerIndex, choice.value)} />
                        ))}
                      </View>
                      <Text>Rank clues:</Text>
                      <View style={styles.buttonWrap}>
                        {clueChoices?.ranks.map((choice) => (
                          <Button disabled={!gameplayControlsEnabled} key={choice.value}
                            title={choice.label}
                            onPress={() => lobbyRuntime.rankClue(playerIndex, choice.value)} />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
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
  title: { fontSize: 24, fontWeight: '700' },
  section: { borderColor: '#999', borderWidth: 1, gap: 8, padding: 12 },
  heading: { fontSize: 18, fontWeight: '600' },
  subheading: { fontSize: 16, fontWeight: '600', marginTop: 6 },
  input: { borderColor: '#777', borderWidth: 1, padding: 10 },
  tableRow: { borderColor: '#bbb', borderWidth: 1, gap: 3, padding: 10 },
  tableName: { fontWeight: '600' },
  actionRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  actionLabel: { flex: 1 },
  playerRow: { borderColor: '#bbb', borderWidth: 1, gap: 5, padding: 8 },
  buttonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
