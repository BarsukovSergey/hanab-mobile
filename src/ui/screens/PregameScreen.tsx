import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MobileTableOptions } from '../../protocol/lobbyProtocol';
import { freeBotSlots, pruneBotSelection } from '../../config/knownBots';
import { chatRuntime, lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { userSelectors } from '../../store/store';
import { BotPicker } from '../BotPicker';
import { ChatPanel } from '../ChatPanel';
import { UserContextActions } from '../UserContextActions';
import {
  ActionButton, EmptyState, Field, Panel, Pill, SectionHeading,
  useHanabTheme, useResponsiveLayout,
} from '../designSystem';
import { TableOptionsEditor } from '../TableOptionsEditor';
import { isPregameLandscape } from '../navigationPolicy';

const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6] as const;
type PregameSurface = 'root' | 'table-settings' | 'spectators' | 'team-tools' | 'table-menu';

export function PregameScreen({ backRef }: { backRef?: { current: (() => void) | null } }) {
  const { theme } = useHanabTheme();
  const { availableWidth, availableHeight } = useResponsiveLayout();
  const landscape = isPregameLandscape(availableWidth, availableHeight);
  const session = useAppSelector((state) => state.session);
  const roomState = useAppSelector((state) => state.room);
  const room = roomState.room.kind === 'pregame' ? roomState.room : null;
  const users = useAppSelector(userSelectors.selectAll);
  const [surface, setSurface] = useState<PregameSurface>('root');
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
    setSurface('root');
    setSelectedBots([]);
    setShowBotPicker(false);
    setBotInvitePassword('');
    setJoinPassword('');
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

  const handleBack = () => setSurface('root');
  if (backRef) backRef.current = handleBack;
  useEffect(() => () => { if (backRef) backRef.current = null; }, [backRef]);
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
  const leaderName = users.find((user) => user.userID === room.data.owner)?.name
    ?? (isOwner ? session.authenticatedUser?.username : undefined);
  const tableSettingsSummary = `${room.data.options.variantName} · ${room.data.options.timed ? 'Timed' : 'Untimed'} · ${room.data.players.length}/${room.data.maxPlayers}`;
  const tableIdentity = <Panel style={styles.panel}>
    <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>PREGAME</Text>
    <Text style={[styles.title, { color: theme.colors.text }]}>{room.data.name}</Text>
    <View style={styles.pills}>
      <Pill active>{room.data.options.variantName}</Pill>
      <Pill>{room.data.options.timed ? 'Timed' : 'Untimed'}</Pill>
      <Pill>{room.data.players.length}/{room.data.maxPlayers} players</Pill>
      <Pill>{room.role === 'spectator' ? 'Spectator' : 'Player'}</Pill>
      <Pill>Leader{leaderName === undefined ? '' : ` · ${leaderName}`}</Pill>
    </View>
  </Panel>;
  const roster = <Panel style={styles.panel}>
    <SectionHeading title="Players" detail={`${room.data.players.length}/${room.data.maxPlayers} seats filled`} />
    <View style={styles.players}>
      {room.data.players.map((player) => (
        <View key={player.index} style={[styles.playerRow, { borderColor: theme.colors.border }]}>
          <View style={styles.playerCopy}>
            <Text style={[styles.playerName, { color: theme.colors.text }]}>{player.name}{player.you ? ' (you)' : ''}</Text>
            <Text style={[styles.playerState, { color: player.present ? theme.colors.success : theme.colors.warning }]}>
              {player.present ? 'Present' : 'Away'}
            </Text>
          </View>
          {((isOwner && !player.you) || (canTakeLeadership && player.you)) && <ActionButton compact
            disabled={roomTransitionPending || roomState.pendingLeaderName !== null}
            title={roomState.pendingLeaderName === player.name ? 'Transferring…' : player.you ? 'Take leadership' : 'Make leader'}
            onPress={() => lobbyRuntime.setTableLeader(player.name)} />}
          {!player.you && <UserContextActions
            username={player.name}
            isFriend={session.friends.some((friend) => friend.toLowerCase() === player.name.toLowerCase())}
            room={`table${room.tableID}`}>
            {isOwner && <ActionButton compact disabled={roomTransitionPending} title="Kick" tone="danger"
              onPress={() => Alert.alert(`Kick ${player.name}?`,
                'They will be removed from this pregame and cannot rejoin this table.',
                [{ text: 'Cancel', style: 'cancel' }, {
                  text: 'Kick', style: 'destructive', onPress: () => { chatRuntime.submit(`/kick ${player.name}`); },
                }], { cancelable: false })} />}
          </UserContextActions>}
        </View>
      ))}
    </View>
  </Panel>;
  const setupSummary = <Panel style={styles.panel}>
    <SectionHeading title="Table setup" detail={tableSettingsSummary} />
    <ActionButton title="Table settings" onPress={() => setSurface('table-settings')} />
    <ActionButton title={`Spectators · ${spectators.length}`} onPress={() => setSurface('spectators')} />
    <ActionButton title="Team tools" onPress={() => setSurface('team-tools')} />
  </Panel>;

  return <View style={styles.root}>
    <View style={styles.header}>
      {surface !== 'root' && <ActionButton compact title="Back" onPress={handleBack} />}
      <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{surface === 'root' ? 'Pregame' : surface === 'table-settings' ? 'Table settings' : surface === 'team-tools' ? 'Team tools' : surface === 'table-menu' ? 'Table menu' : 'Spectators'}</Text>
      {surface === 'root' && <ActionButton compact title="Table menu" onPress={() => setSurface('table-menu')} />}
    </View>

    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      {surface === 'root' && <>
        {landscape
          ? <View style={styles.landscapeRegions}>
            <View style={styles.region}>{tableIdentity}{roster}</View>
            <View style={styles.region}>{setupSummary}</View>
          </View>
          : <>{tableIdentity}{roster}{setupSummary}</>}
      </>}

      {surface === 'table-settings' && <Panel style={styles.panel}>
        <SectionHeading title="Table settings" detail={isOwner
          ? 'Changes are applied authoritatively to the room.'
          : 'Changes are sent to the table owner as a proposal.'} />
        <Field maxLength={45} onChangeText={setEditName} placeholder="Table name" value={editName} />
        <View style={styles.playerSelector}>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>Max players</Text>
          <View style={styles.playerOptions}>{MAX_PLAYER_OPTIONS.map((value) => {
            const selected = editMaxPlayers === value;
            return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }} hitSlop={6}
              onPress={() => setEditMaxPlayers(value)}
              style={[styles.playerOption, {
                backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceRaised,
                borderColor: selected ? theme.colors.accent : theme.colors.borderStrong,
              }]}>
              <Text style={[styles.playerOptionText, { color: selected ? theme.colors.accentText : theme.colors.text }]}>{value}</Text>
            </Pressable>;
          })}</View>
        </View>
        <TableOptionsEditor options={editOptions} onChange={setEditOptions} />
        <ActionButton disabled={roleSwitchPending || (isOwner && roomState.pendingUpdate !== null) || editName.trim().length === 0}
          title={isOwner ? (roomState.pendingUpdate === null ? 'Apply changes' : 'Applying…') : 'Propose changes'}
          tone="primary" onPress={() => lobbyRuntime.updateTable(editName, editMaxPlayers, editOptions)} />
      </Panel>}

      {surface === 'spectators' && <Panel style={styles.panel}>
        <SectionHeading title="Spectators" detail={`${spectators.length}`} />
        {spectators.length === 0 ? <EmptyState>No spectators</EmptyState> : spectators.map((spectator) => (
          <View key={spectator.name} style={styles.spectatorRow}>
            <Text style={[styles.playerName, { color: theme.colors.text }]}>{spectator.name}</Text>
            {spectator.shadowingPlayerIndex !== -1 && spectator.shadowingPlayerUsername !== '' &&
              <Text style={[styles.playerStats, { color: theme.colors.textMuted }]}>Watching {spectator.shadowingPlayerUsername}</Text>}
          </View>
        ))}
      </Panel>}

      {surface === 'team-tools' && <Panel style={styles.panel}>
        <SectionHeading title="Team tools" detail="Server-backed helpers. Results appear in pre-game chat." />
        {freeSlots > 0 && <>
          <ActionButton title={showBotPicker ? 'Hide bot picker' : 'Add bot'} onPress={() => {
            setSelectedBots([]);
            setBotInvitePassword('');
            setShowBotPicker(!showBotPicker);
          }} />
          {showBotPicker && <>
            <BotPicker selected={selectedBots} onChange={setSelectedBots} limit={freeSlots}
              users={users} players={room.data.players} protectedTable={room.data.passwordProtected} />
            {room.data.passwordProtected && <Field autoCapitalize="none" autoCorrect={false} secureTextEntry
              placeholder="Table password" value={botInvitePassword} onChangeText={setBotInvitePassword} />}
            <ActionButton title="Invite selected bots"
              disabled={selectedBots.length === 0 || (room.data.passwordProtected && botInvitePassword.length === 0)}
              onPress={() => {
                lobbyRuntime.inviteBots(room.tableID, selectedBots, botInvitePassword);
                setBotInvitePassword('');
                setSelectedBots([]);
                setShowBotPicker(false);
              }} />
          </>}
        </>}
        <View style={styles.actionsRow}>
          <ActionButton compact disabled={room.data.players.length < 2 || roomTransitionPending}
            title="Find variant" onPress={() => chatRuntime.submit('/findvariant')} />
          <ActionButton compact disabled={room.data.players.length < 2 || roomTransitionPending}
            title="Missing scores" onPress={() => chatRuntime.submit('/missing')} />
        </View>
      </Panel>}

      {surface === 'table-menu' && <Panel style={styles.panel}>
        <SectionHeading title="Table menu" detail={room.role === 'player'
          ? 'Leave this pregame table.' : 'Stop watching this pregame table.'} />
        <ActionButton disabled={roomState.pendingLeaveTableID !== null || roleSwitchPending || roomState.pendingStart !== null}
          title={roomState.pendingLeaveTableID === null
            ? room.role === 'player' ? 'Leave table' : 'Stop watching'
            : 'Leaving…'} tone="danger" onPress={() => Alert.alert(
              room.role === 'player' ? 'Leave table?' : 'Stop watching?',
              room.role === 'player'
                ? 'Leave this Pregame table?'
                : 'Stop watching this Pregame table?',
              [{ text: 'Cancel', style: 'cancel' }, {
                text: room.role === 'player' ? 'Leave table' : 'Stop watching',
                style: 'destructive', onPress: () => lobbyRuntime.leave(room.tableID),
              }], { cancelable: false },
            )} />
      </Panel>}
      <ChatPanel room={`table${room.tableID}`} title="Pre-game chat" readActive={surface === 'root'} />
    </ScrollView>

    {surface === 'root' && <View style={styles.footer}>
      {room.role === 'player' ? <>
        <ActionButton disabled={!canSwitchToSpectator || roomTransitionPending || roomState.pendingLeaderName !== null}
          title={roleSwitchPending ? 'Switching…' : 'Switch to spectator'}
          onPress={() => lobbyRuntime.switchToSpectator()} />
        {isOwner
          ? <ActionButton disabled={room.data.players.length < 2 || roleSwitchPending
            || roomState.pendingStart !== null || roomState.pendingLeaveTableID !== null}
            title={roomState.pendingStart === null ? 'Start game' : 'Starting…'} tone="primary"
            onPress={() => lobbyRuntime.startGame()} />
          : <Text style={[styles.waiting, { color: theme.colors.textMuted }]}>Waiting for leader</Text>}
      </> : <>
        {room.data.passwordProtected && <Field onChangeText={setJoinPassword} placeholder="Table password"
          secureTextEntry value={joinPassword} />}
        <ActionButton disabled={!canJoinAsPlayer || roomTransitionPending
          || (room.data.passwordProtected && joinPassword.length === 0)}
          title={roleSwitchPending ? 'Joining…' : 'Join as player'} tone="primary"
          onPress={() => { if (lobbyRuntime.joinAsPlayer(joinPassword)) setJoinPassword(''); }} />
      </>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 8, minHeight: 0 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800' },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { alignSelf: 'center', gap: 10, paddingBottom: 12, paddingHorizontal: 12, paddingTop: 4, width: '100%' },
  panel: { gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontSize: 22, fontWeight: '900' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  landscapeRegions: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  region: { flex: 1, gap: 10, minWidth: 0 },
  players: { gap: 4 },
  playerRow: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 6 },
  playerCopy: { flex: 1, gap: 2, minWidth: 90 },
  playerName: { fontSize: 14, fontWeight: '800' },
  playerState: { fontSize: 11, fontWeight: '700' },
  playerStats: { fontSize: 12, lineHeight: 17 },
  spectatorRow: { alignItems: 'baseline', columnGap: 8, flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 3 },
  playerSelector: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  playerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playerOption: { alignItems: 'center', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 44, paddingHorizontal: 12 },
  playerOptionText: { fontSize: 15, fontWeight: '800' },
  actionsRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8, paddingHorizontal: 12 },
  waiting: { alignSelf: 'center', fontSize: 14, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 10 },
});
