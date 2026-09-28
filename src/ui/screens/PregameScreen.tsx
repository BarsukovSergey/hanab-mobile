import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MobileTableOptions } from '../../protocol/lobbyProtocol';
import { freeBotSlots, pruneBotSelection } from '../../config/knownBots';
import { chatRuntime, lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { userSelectors } from '../../store/store';
import { BotPicker } from '../BotPicker';
import { ChatPanel } from '../ChatPanel';
import { UserContextActions } from '../UserContextActions';
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
import { formatPregamePlayerStats } from './pregamePlayerStats';

const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6] as const;

export function PregameScreen() {
  const { theme } = useHanabTheme();
  const { wide } = useResponsiveLayout();
  const session = useAppSelector((state) => state.session);
  const roomState = useAppSelector((state) => state.room);
  const room = roomState.room.kind === 'pregame' ? roomState.room : null;
  const users = useAppSelector(userSelectors.selectAll);
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [showBotPicker, setShowBotPicker] = useState(false);
  const [botInvitePassword, setBotInvitePassword] = useState('');
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

  useEffect(() => {
    setSelectedBots([]);
    setShowBotPicker(false);
    setBotInvitePassword('');
  }, [room?.tableID]);

  useEffect(() => {
    setSelectedBots((current) => {
      const next = pruneBotSelection(current, users, room?.data.players ?? [],
        room?.data.passwordProtected ?? false,
        room === null ? 0 : freeBotSlots(room.data.maxPlayers, room.data.players.length));
      return next.length === current.length && next.every((name, index) => name === current[index]) ? current : next;
    });
  }, [users, room?.data]);

  useEffect(() => {
    if (room === null || freeBotSlots(room.data.maxPlayers, room.data.players.length) === 0) {
      setBotInvitePassword('');
      setShowBotPicker(false);
    }
  }, [room?.tableID, room?.data.maxPlayers, room?.data.players.length]);

  if (room === null) return null;
  const isOwner = room.role === 'player' && session.authenticatedUser?.userID === room.data.owner;
  const canTakeLeadership = room.role === 'player' && !isOwner;
  const roleSwitchPending = roomState.pendingRoleSwitch !== null;
  const roomTransitionPending = roleSwitchPending
    || roomState.pendingLeaveTableID !== null
    || roomState.pendingStart !== null;
  const canSwitchToSpectator = room.role === 'player' && room.data.players.length >= 2;
  const canJoinAsPlayer = room.role === 'spectator' && room.data.players.length < room.data.maxPlayers;
  const spectators = roomState.pregameSpectators?.tableID === room.tableID
    ? roomState.pregameSpectators.spectators : [];
  const freeSlots = Math.max(0, room.data.maxPlayers - room.data.players.length);

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
                    <Text style={[styles.playerStats, { color: theme.colors.textMuted }]}>
                      {formatPregamePlayerStats(player, room.data.players.length)}
                    </Text>
                  </View>
                  {((isOwner && !player.you) || (canTakeLeadership && player.you)) && (
                    <ActionButton
                      compact
                      disabled={roleSwitchPending || roomState.pendingLeaderName !== null}
                      title={roomState.pendingLeaderName === player.name
                        ? 'Transferring…'
                        : player.you ? 'Take leadership' : 'Make leader'}
                      onPress={() => lobbyRuntime.setTableLeader(player.name)}
                    />
                  )}
                  {!player.you && (
                    <UserContextActions
                      username={player.name}
                      isFriend={session.friends.some((friend) => friend.toLowerCase() === player.name.toLowerCase())}
                      room={`table${room.tableID}`}
                    >
                      {isOwner && (
                        <ActionButton
                          compact
                          disabled={roomTransitionPending}
                          title="Kick"
                          tone="danger"
                          onPress={() => Alert.alert(
                            `Kick ${player.name}?`,
                            'They will be removed from this pregame and cannot rejoin this table.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Kick',
                                style: 'destructive',
                                onPress: () => { chatRuntime.submit(`/kick ${player.name}`); },
                              },
                            ],
                            { cancelable: false },
                          )}
                        />
                      )}
                    </UserContextActions>
                  )}
                </View>
              ))}
            </View>
            {freeSlots > 0 && (
              <View style={styles.teamTools}>
                <ActionButton title="Add bot" onPress={() => {
                  setSelectedBots([]);
                  setBotInvitePassword('');
                  setShowBotPicker(!showBotPicker);
                }} />
                {showBotPicker && (
                  <>
                    <BotPicker selected={selectedBots} onChange={setSelectedBots} limit={freeSlots}
                      users={users} players={room.data.players} protectedTable={room.data.passwordProtected} />
                    {room.data.passwordProtected && (
                      <Field autoCapitalize="none" autoCorrect={false} secureTextEntry
                        placeholder="Table password" value={botInvitePassword} onChangeText={setBotInvitePassword} />
                    )}
                    <ActionButton title="Invite selected bots"
                      disabled={selectedBots.length === 0 || (room.data.passwordProtected && botInvitePassword.length === 0)}
                      onPress={() => {
                        lobbyRuntime.inviteBots(room.tableID, selectedBots, botInvitePassword);
                        setBotInvitePassword('');
                        setSelectedBots([]);
                        setShowBotPicker(false);
                      }} />
                  </>
                )}
              </View>
            )}
            <View style={styles.teamTools}>
              <SectionHeading
                title="Team tools"
                detail="Server-backed helpers. Results appear in pre-game chat."
              />
              <View style={styles.actionsRow}>
                <ActionButton
                  compact
                  disabled={room.data.players.length < 2 || roomTransitionPending}
                  title="Find variant"
                  onPress={() => chatRuntime.submit('/findvariant')}
                />
                <ActionButton
                  compact
                  disabled={room.data.players.length < 2 || roomTransitionPending}
                  title="Missing scores"
                  onPress={() => chatRuntime.submit('/missing')}
                />
              </View>
            </View>
            <View style={styles.spectators}>
              <SectionHeading title="Spectators" detail={`${spectators.length}`} />
              {spectators.length === 0 ? (
                <Text style={[styles.playerStats, { color: theme.colors.textMuted }]}>No spectators</Text>
              ) : spectators.map((spectator) => (
                <View key={spectator.name} style={styles.spectatorRow}>
                  <Text style={[styles.playerName, { color: theme.colors.text }]}>{spectator.name}</Text>
                  {spectator.shadowingPlayerIndex !== -1 && spectator.shadowingPlayerUsername !== '' && (
                    <Text style={[styles.playerStats, { color: theme.colors.textMuted }]}>
                      Watching {spectator.shadowingPlayerUsername}
                    </Text>
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

        <Panel style={styles.column}>
            <SectionHeading
              title="Table settings"
              detail={isOwner
                ? 'Changes are applied authoritatively to the room.'
                : 'Changes are sent to the table owner as a proposal.'}
            />
            <Field maxLength={45} onChangeText={setEditName} placeholder="Table name" value={editName} />
            <View style={styles.playerSelector}>
              <Text style={[styles.label, { color: theme.colors.textMuted }]}>Max players</Text>
              <View style={styles.playerOptions}>
                {MAX_PLAYER_OPTIONS.map((value) => {
                  const selected = editMaxPlayers === value;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      hitSlop={6}
                      onPress={() => setEditMaxPlayers(value)}
                      style={[
                        styles.playerOption,
                        {
                          backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceRaised,
                          borderColor: selected ? theme.colors.accent : theme.colors.borderStrong,
                        },
                      ]}
                    >
                      <Text style={[styles.playerOptionText, { color: selected ? theme.colors.accentText : theme.colors.text }]}>
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <TableOptionsEditor options={editOptions} onChange={setEditOptions} />
            <ActionButton
              disabled={roleSwitchPending || (isOwner && roomState.pendingUpdate !== null) || editName.trim().length === 0}
              title={isOwner
                ? (roomState.pendingUpdate === null ? 'Apply changes' : 'Applying…')
                : 'Propose changes'}
              tone="primary"
              onPress={() => lobbyRuntime.updateTable(editName, editMaxPlayers, editOptions)}
            />
        </Panel>
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
  teamTools: { gap: 8, marginTop: 12 },
  spectators: { gap: 8, marginTop: 12 },
  spectatorRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 },
  roleSwitch: { gap: 10 },
  playerRow: { borderTopWidth: 1, gap: 8, paddingTop: 9 },
  playerCopy: { flex: 1, gap: 2 },
  playerName: { fontSize: 15, fontWeight: '800' },
  playerState: { fontSize: 12, fontWeight: '700' },
  playerStats: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  playerSelector: { gap: 8 },
  playerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playerOption: { alignItems: 'center', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 44, paddingHorizontal: 12 },
  playerOptionText: { fontSize: 15, fontWeight: '800' },
  actionsRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
});
