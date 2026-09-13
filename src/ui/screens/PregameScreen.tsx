import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MobileTableOptions } from '../../protocol/lobbyProtocol';
import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { ChatPanel } from '../ChatPanel';
import {
  ActionButton,
  Field,
  Panel,
  Pill,
  SectionHeading,
  useHanabTheme,
  useResponsiveLayout,
} from '../designSystem';
import { TableOptionsEditor } from '../TableOptionsEditor';

export function PregameScreen() {
  const { theme } = useHanabTheme();
  const { wide } = useResponsiveLayout();
  const session = useAppSelector((state) => state.session);
  const roomState = useAppSelector((state) => state.room);
  const room = roomState.room.kind === 'pregame' ? roomState.room : null;
  const [editName, setEditName] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [editMaxPlayers, setEditMaxPlayers] = useState(5);
  const [editOptions, setEditOptions] = useState<MobileTableOptions>({
    variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
    cardCycle: false, emptyClues: false, oneExtraCard: false, oneLessCard: false,
    allOrNothing: false,
  });

  useEffect(() => {
    if (room === null) return;
    setEditName(room.data.name);
    setEditMaxPlayers(room.data.maxPlayers);
    setEditOptions({
      variantName: room.data.options.variantName,
      timed: room.data.options.timed,
      timeBase: room.data.options.timeBase,
      timePerTurn: room.data.options.timePerTurn,
      cardCycle: room.data.options.cardCycle,
      emptyClues: room.data.options.emptyClues,
      oneExtraCard: room.data.options.oneExtraCard,
      oneLessCard: room.data.options.oneLessCard,
      allOrNothing: room.data.options.allOrNothing,
    });
  }, [room?.data]);

  if (room === null) return null;
  const isOwner = room.role === 'player' && session.authenticatedUser?.userID === room.data.owner;
  const roleSwitchPending = roomState.pendingRoleSwitch !== null;
  const canSwitchToSpectator = room.role === 'player' && room.data.players.length >= 2;
  const canJoinAsPlayer = room.role === 'spectator' && room.data.players.length < room.data.maxPlayers;

  return (
    <View style={styles.root}>
      <Panel style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>PREGAME</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>{room.data.name}</Text>
          <View style={styles.pills}>
            <Pill active>{room.data.options.variantName}</Pill>
            <Pill>{room.role === 'spectator' ? 'Spectator' : 'Player'}</Pill>
            {isOwner && <Pill>Leader</Pill>}
          </View>
        </View>
        <ActionButton
          compact
          disabled={roleSwitchPending || roomState.pendingLeaveTableID !== null || roomState.pendingStart !== null}
          title={roomState.pendingLeaveTableID === null ? 'Leave' : 'Leaving…'}
          onPress={() => lobbyRuntime.leave(room.tableID)}
        />
      </Panel>

      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={styles.column}>
          <Panel>
            <SectionHeading
              title="Players"
              detail={`${room.data.players.length}/${room.data.maxPlayers} seats filled`}
            />
            <View style={styles.players}>
              {room.data.players.map((player) => (
                <View key={player.index} style={[styles.playerRow, { borderColor: theme.colors.border }]}>
                  <View style={styles.playerCopy}>
                    <Text style={[styles.playerName, { color: theme.colors.text }]}>
                      {player.name}{player.you ? ' (you)' : ''}
                    </Text>
                    <Text style={[styles.playerState, { color: player.present ? theme.colors.success : theme.colors.warning }]}>
                      {player.present ? 'Present' : 'Away'}
                    </Text>
                  </View>
                  {isOwner && !player.you && (
                    <ActionButton
                      compact
                      disabled={roleSwitchPending || roomState.pendingLeaderName !== null}
                      title={roomState.pendingLeaderName === player.name ? 'Transferring…' : 'Make leader'}
                      onPress={() => lobbyRuntime.setTableLeader(player.name)}
                    />
                  )}
                </View>
              ))}
            </View>
            {isOwner && (
              <ActionButton
                disabled={room.data.players.length < 2
                  || roleSwitchPending || roomState.pendingStart !== null || roomState.pendingLeaveTableID !== null}
                title={roomState.pendingStart === null ? 'Start game' : 'Starting…'}
                tone="primary"
                onPress={() => lobbyRuntime.startGame()}
              />
            )}
            <View style={styles.roleSwitch}>
              {room.role === 'player' ? (
                <ActionButton
                  disabled={!canSwitchToSpectator || roleSwitchPending}
                  title={roleSwitchPending ? 'Switching…' : 'Switch to spectator'}
                  onPress={() => lobbyRuntime.switchToSpectator()}
                />
              ) : (
                <>
                  {room.data.passwordProtected && (
                    <Field
                      onChangeText={setJoinPassword}
                      placeholder="Table password"
                      secureTextEntry
                      value={joinPassword}
                    />
                  )}
                  <ActionButton
                    disabled={!canJoinAsPlayer || roleSwitchPending
                      || (room.data.passwordProtected && joinPassword.length === 0)}
                    title={roleSwitchPending ? 'Joining…' : 'Join as player'}
                    tone="primary"
                    onPress={() => {
                      if (lobbyRuntime.joinAsPlayer(joinPassword)) setJoinPassword('');
                    }}
                  />
                </>
              )}
            </View>
          </Panel>
          <ChatPanel room={`table${room.tableID}`} title="Pre-game chat" />
        </View>

        {isOwner && (
          <Panel style={styles.column}>
            <SectionHeading title="Table settings" detail="Changes are applied authoritatively to the room." />
            <Field maxLength={45} onChangeText={setEditName} placeholder="Table name" value={editName} />
            <View style={styles.stepperRow}>
              <View style={styles.stepperCopy}>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Max players</Text>
                <Text style={[styles.stepperValue, { color: theme.colors.text }]}>{editMaxPlayers}</Text>
              </View>
              <View style={styles.actionsRow}>
                <ActionButton compact disabled={editMaxPlayers <= 2} title="−"
                  onPress={() => setEditMaxPlayers((count) => count - 1)} />
                <ActionButton compact disabled={editMaxPlayers >= 6} title="+"
                  onPress={() => setEditMaxPlayers((count) => count + 1)} />
              </View>
            </View>
            <TableOptionsEditor options={editOptions} onChange={setEditOptions} />
            <ActionButton
              disabled={roleSwitchPending || roomState.pendingUpdate !== null || editName.trim().length === 0}
              title={roomState.pendingUpdate === null ? 'Apply changes' : 'Applying…'}
              tone="primary"
              onPress={() => lobbyRuntime.updateTable(editName, editMaxPlayers, editOptions)}
            />
          </Panel>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  hero: { alignItems: 'center', flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  heroCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontSize: 26, fontWeight: '900' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  columns: { gap: 16 },
  columnsWide: { alignItems: 'flex-start', flexDirection: 'row' },
  column: { flex: 1, gap: 16, minWidth: 0 },
  players: { gap: 8 },
  roleSwitch: { gap: 10 },
  playerRow: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', paddingTop: 9 },
  playerCopy: { flex: 1, gap: 2 },
  playerName: { fontSize: 15, fontWeight: '800' },
  playerState: { fontSize: 12, fontWeight: '700' },
  stepperRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  stepperCopy: { gap: 2 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  stepperValue: { fontSize: 24, fontWeight: '800' },
  actionsRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
});
