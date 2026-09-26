import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MobileTableOptions } from '../../protocol/lobbyProtocol';
import { pruneBotSelection } from '../../config/knownBots';
import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { tableSelectors, userSelectors } from '../../store/store';
import { BotPicker } from '../BotPicker';
import { ChatPanel } from '../ChatPanel';
import {
  ActionButton,
  EmptyState,
  Field,
  Panel,
  Pill,
  SectionHeading,
  useHanabTheme,
  useResponsiveLayout,
} from '../designSystem';
import { getLobbySections } from '../lobbySections';
import { getLobbyFriendContext } from '../lobbyTablePresentation';
import { TableOptionsEditor } from '../TableOptionsEditor';

const DEFAULT_OPTIONS: MobileTableOptions = {
  variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
  cardCycle: false, emptyClues: false,
  oneExtraCard: false, oneLessCard: false, allOrNothing: false,
};

const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6] as const;

export function LobbyScreen({
  onOpenHistory,
  onOpenPeople,
}: {
  onOpenHistory: () => void;
  onOpenPeople: () => void;
}) {
  const { theme } = useHanabTheme();
  const { wide } = useResponsiveLayout();
  const [tableName, setTableName] = useState('');
  const [tablePassword, setTablePassword] = useState('');
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [showBotPicker, setShowBotPicker] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [createOptions, setCreateOptions] = useState<MobileTableOptions>(DEFAULT_OPTIONS);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinPasswordTableID, setJoinPasswordTableID] = useState<number | null>(null);
  const tables = useAppSelector(tableSelectors.selectAll);
  const users = useAppSelector(userSelectors.selectAll);
  const roomState = useAppSelector((state) => state.room);
  const randomTableName = useAppSelector((state) => state.session.randomTableName);
  const friends = useAppSelector((state) => state.session.friends);
  useEffect(() => {
    setSelectedBots((current) => {
      const next = pruneBotSelection(current, users, [], tablePassword.length > 0, maxPlayers - 1);
      return next.length === current.length && next.every((name, index) => name === current[index]) ? current : next;
    });
  }, [users, tablePassword, maxPlayers]);
  const effectiveName = tableName.trim() || randomTableName?.trim() || '';
  const {
    yourRunningGames,
    pregameTables,
    runningTables,
    sharedReplays,
    showCreateTable,
  } = getLobbySections(tables, friends);
  const attendancePending = roomState.pendingSpectateTableID !== null
    || roomState.pendingRecovery !== null
    || roomState.pendingJoin !== null
    || roomState.pendingCreate !== null;

  return (
    <View style={styles.root}>
      <Panel style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>HANAB</Text>
          <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Lobby</Text>
          <Text style={[styles.heroDetail, { color: theme.colors.textMuted }]}>
            {tables.length} {tables.length === 1 ? 'table' : 'tables'} available
          </Text>
        </View>
        <View style={styles.heroActions}>
          <ActionButton compact title="People" onPress={onOpenPeople} />
          <ActionButton compact title="Game history" onPress={onOpenHistory} />
        </View>
      </Panel>

      {yourRunningGames.length > 0 && (
        <TableSection
          empty="No game to resume."
          title="Your running game"
          tables={yourRunningGames}
          friends={friends}
          action={(table) => (
            <ActionButton
              compact
              disabled={attendancePending}
              title="Return to game"
              tone="primary"
              onPress={() => lobbyRuntime.reattend(table.id)}
            />
          )}
        />
      )}

      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={[styles.column, wide && styles.discoveryColumn]}>
          <Panel>
            <SectionHeading title="Pregame tables" detail="Join as a player or watch the room before it starts." />
            {pregameTables.length === 0 && <EmptyState>No pregame tables.</EmptyState>}
            {pregameTables.map((table) => {
              const friendContext = getLobbyFriendContext(table, friends);
              return (
              <View key={table.id} style={[
                styles.tableCard,
                { borderColor: friendContext.hasFriends ? theme.colors.accent : theme.colors.border },
                friendContext.hasFriends && styles.friendTableCard,
              ]}>
                <View style={styles.tableHeader}>
                  <View style={styles.tableCopy}>
                    <Text style={[styles.tableName, { color: theme.colors.text }]}>{table.name}</Text>
                    <Text style={[styles.tableMeta, { color: theme.colors.textMuted }]}>
                      {table.variant} · {table.numPlayers}/{table.maxPlayers}
                    </Text>
                    <LobbyRoster table={table} friends={friends} />
                    <TableFriendContext table={table} friends={friends} />
                  </View>
                  {friendContext.hasFriends && <Pill active>{new Set([...friendContext.playing, ...friendContext.watching].map((name) => name.toLowerCase())).size > 1 ? 'Friends here' : 'Friend here'}</Pill>}
                  {table.passwordProtected && <Pill>Private</Pill>}
                </View>
                {table.passwordProtected && (
                  <Field
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(value) => { setJoinPasswordTableID(table.id); setJoinPassword(value); }}
                    placeholder="Table password"
                    secureTextEntry
                    value={joinPasswordTableID === table.id ? joinPassword : ''}
                  />
                )}
                <View style={styles.actionsRow}>
                  {table.numPlayers < table.maxPlayers && (
                    <ActionButton compact disabled={attendancePending} title="Join" tone="primary" onPress={() => {
                      const secret = joinPasswordTableID === table.id ? joinPassword : undefined;
                      if (lobbyRuntime.join(table.id, secret)) {
                        setJoinPassword('');
                        setJoinPasswordTableID(null);
                      }
                    }} />
                  )}
                  <ActionButton
                    compact
                    disabled={attendancePending}
                    title="Spectate pregame"
                    onPress={() => lobbyRuntime.spectate(table.id)}
                  />
                </View>
              </View>
              );
            })}
          </Panel>

          {showCreateTable && (
            <Panel>
              <SectionHeading title="Create table" detail="Start a new room with hanab.live-compatible options." />
              <Field maxLength={45} onChangeText={setTableName} placeholder={randomTableName ?? 'Table name'} value={tableName} />
              <Field
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setTablePassword}
                placeholder="Table password (optional)"
                secureTextEntry
                value={tablePassword}
              />
              <View style={styles.playerSelector}>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Max players</Text>
                <View style={styles.playerOptions}>
                  {MAX_PLAYER_OPTIONS.map((value) => {
                    const selected = maxPlayers === value;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        hitSlop={6}
                        onPress={() => { setMaxPlayers(value); setSelectedBots((names) => names.slice(0, value - 1)); }}
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
              <ActionButton title={showBotPicker ? 'Hide bots' : 'Choose bots'}
                onPress={() => setShowBotPicker(!showBotPicker)} />
              {showBotPicker && <BotPicker selected={selectedBots} onChange={setSelectedBots}
                limit={maxPlayers - 1} users={users} protectedTable={tablePassword.length > 0} />}
              <TableOptionsEditor options={createOptions} onChange={setCreateOptions} />
              <ActionButton
                disabled={attendancePending || effectiveName.length < 1 || effectiveName.length > 45}
                title={roomState.pendingCreate === null ? 'Create table' : 'Creating…'}
                tone="primary"
                onPress={() => {
                  if (lobbyRuntime.createTable(tableName, maxPlayers, createOptions, tablePassword, selectedBots)) {
                    setTablePassword('');
                    setSelectedBots([]);
                  }
                }}
              />
            </Panel>
          )}
        </View>

        <View style={[styles.column, styles.listColumn]}>
          <TableSection
            empty="No running tables."
            title="Running tables"
            tables={runningTables}
            friends={friends}
            action={(table) => (
              <ActionButton compact disabled={attendancePending} title="Spectate" onPress={() => lobbyRuntime.spectate(table.id)} />
            )}
          />
          <TableSection
            empty="No shared replays."
            title="Shared replays"
            tables={sharedReplays}
            friends={friends}
            action={(table) => (
              <ActionButton compact disabled={attendancePending} title="Open review" onPress={() => lobbyRuntime.spectate(table.id)} />
            )}
          />
        </View>
      </View>
      <ChatPanel room="lobby" title="Lobby chat" />
    </View>
  );
}

type LobbyTable = ReturnType<typeof tableSelectors.selectAll>[number];

function TableSection({
  title,
  empty,
  tables,
  friends,
  action,
}: {
  title: string;
  empty: string;
  tables: LobbyTable[];
  friends: readonly string[];
  action: (table: LobbyTable) => ReactNode;
}) {
  const { theme } = useHanabTheme();
  return (
    <Panel>
      <SectionHeading title={title} />
      {tables.length === 0 && <EmptyState>{empty}</EmptyState>}
      {tables.map((table) => {
        const friendContext = getLobbyFriendContext(table, friends);
        return (
        <View key={table.id} style={[
          styles.tableCard,
          { borderColor: friendContext.hasFriends ? theme.colors.accent : theme.colors.border },
          friendContext.hasFriends && styles.friendTableCard,
        ]}>
          <View style={styles.tableHeader}>
            <View style={styles.tableCopy}>
              <Text style={[styles.tableName, { color: theme.colors.text }]}>{table.name}</Text>
              <Text style={[styles.tableMeta, { color: theme.colors.textMuted }]}>
                {table.variant} · {table.numPlayers}/{table.maxPlayers}
              </Text>
              <LobbyRoster table={table} friends={friends} />
              <TableFriendContext table={table} friends={friends} />
            </View>
            {friendContext.hasFriends && <Pill active>{new Set([...friendContext.playing, ...friendContext.watching].map((name) => name.toLowerCase())).size > 1 ? 'Friends here' : 'Friend here'}</Pill>}
            {action(table)}
          </View>
        </View>
        );
      })}
    </Panel>
  );
}

function TableFriendContext({ table, friends }: { table: LobbyTable; friends: readonly string[] }) {
  const { theme } = useHanabTheme();
  const context = getLobbyFriendContext(table, friends);
  if (!context.hasFriends) return null;
  const details = [
    context.playing.length > 0 ? `Playing: ${context.playing.join(', ')}` : null,
    context.watching.length > 0 ? `Watching: ${context.watching.join(', ')}` : null,
  ].filter((detail) => detail !== null);
  return (
    <Text numberOfLines={2} style={[styles.tableFriendContext, { color: theme.colors.accent }]}>
      {details.join(' · ')}{table.running ? ` · ${table.progress}%` : ''}
    </Text>
  );
}

function LobbyRoster({ table, friends }: { table: LobbyTable; friends: readonly string[] }) {
  const { theme } = useHanabTheme();
  if (table.players.length === 0) return null;
  const friendNames = new Set(getLobbyFriendContext(table, friends).playing.map((name) => name.toLowerCase()));
  return (
    <Text numberOfLines={2} style={[styles.tableRoster, { color: theme.colors.textMuted }]}>
      {table.players.map((name, index) => (
        <Text key={`${name}-${index}`} style={friendNames.has(name.toLowerCase()) ? { color: theme.colors.accent, fontWeight: '800' } : undefined}>
          {index > 0 ? ' · ' : ''}{name}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  hero: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroCopy: { flex: 1, gap: 2 },
  heroActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { fontSize: 28, fontWeight: '900' },
  heroDetail: { fontSize: 14 },
  columns: { gap: 16 },
  columnsWide: { alignItems: 'flex-start', flexDirection: 'row' },
  column: { flex: 1, gap: 16, minWidth: 0 },
  discoveryColumn: { flex: 0.92 },
  listColumn: { flex: 1.08 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  playerSelector: { gap: 8 },
  playerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playerOption: { alignItems: 'center', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 44, paddingHorizontal: 12 },
  playerOptionText: { fontSize: 15, fontWeight: '800' },
  actionsRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tableCard: { borderTopWidth: 1, gap: 10, paddingTop: 12 },
  friendTableCard: { borderLeftWidth: 3, paddingLeft: 8 },
  tableHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  tableCopy: { flex: 1, gap: 2, minWidth: 0 },
  tableName: { fontSize: 15, fontWeight: '800' },
  tableMeta: { fontSize: 13, lineHeight: 18 },
  tableRoster: { fontSize: 12, lineHeight: 16 },
  tableFriendContext: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
});
