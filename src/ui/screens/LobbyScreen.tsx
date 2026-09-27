import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
import { parseLiveGameInput } from '../../game/client/liveGameInput';
import { clipboardActions, type ClipboardActions } from '../../platform/replayInputActions';
import { createSpecificSeedTableName } from '../specificSeedName';

const DEFAULT_OPTIONS: MobileTableOptions = {
  variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
  cardCycle: false, emptyClues: false,
  oneExtraCard: false, oneLessCard: false, allOrNothing: false,
};

const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6] as const;

export function LobbyScreen({
  onOpenHistory,
  onOpenPeople,
  specificSeedCreatePrefill = null,
  onSpecificSeedCreatePrefillConsumed = () => {},
  clipboard = clipboardActions,
}: {
  onOpenHistory: () => void;
  onOpenPeople: () => void;
  specificSeedCreatePrefill?: {
    seedSuffix: string;
    maxPlayers: number;
    numPlayers: number;
    createOptions: MobileTableOptions;
  } | null;
  onSpecificSeedCreatePrefillConsumed?: () => void;
  clipboard?: ClipboardActions;
}) {
  const { theme } = useHanabTheme();
  const { wide } = useResponsiveLayout();
  const [tableName, setTableName] = useState('');
  const [useSpecificSeed, setUseSpecificSeed] = useState(false);
  const [seedSuffix, setSeedSuffix] = useState('');
  const [tablePassword, setTablePassword] = useState('');
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [showBotPicker, setShowBotPicker] = useState(false);
  const [showLiveGameLink, setShowLiveGameLink] = useState(false);
  const [liveGameLink, setLiveGameLink] = useState('');
  const [liveGameLinkError, setLiveGameLinkError] = useState<string | null>(null);
  const [liveGameLinkPassword, setLiveGameLinkPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [createOptions, setCreateOptions] = useState<MobileTableOptions>(DEFAULT_OPTIONS);
  const [reproductionPlayerCount, setReproductionPlayerCount] = useState<number | null>(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinPasswordTableID, setJoinPasswordTableID] = useState<number | null>(null);
  const tables = useAppSelector(tableSelectors.selectAll);
  const users = useAppSelector(userSelectors.selectAll);
  const roomState = useAppSelector((state) => state.room);
  const randomTableName = useAppSelector((state) => state.session.randomTableName);
  const friends = useAppSelector((state) => state.session.friends);
  useEffect(() => {
    if (specificSeedCreatePrefill === null) return;
    setUseSpecificSeed(true);
    setSeedSuffix(specificSeedCreatePrefill.seedSuffix);
    setMaxPlayers(specificSeedCreatePrefill.maxPlayers);
    setCreateOptions(specificSeedCreatePrefill.createOptions);
    setReproductionPlayerCount(specificSeedCreatePrefill.numPlayers);
    onSpecificSeedCreatePrefillConsumed();
  }, [specificSeedCreatePrefill, onSpecificSeedCreatePrefillConsumed]);
  useEffect(() => {
    setSelectedBots((current) => {
      const next = pruneBotSelection(current, users, [], tablePassword.length > 0, maxPlayers - 1);
      return next.length === current.length && next.every((name, index) => name === current[index]) ? current : next;
    });
  }, [users, tablePassword, maxPlayers]);
  const effectiveName = tableName.trim() || randomTableName?.trim() || '';
  const specificSeedTableName = createSpecificSeedTableName(seedSuffix);
  const submittedName = useSpecificSeed ? specificSeedTableName ?? '' : tableName;
  const createNameIsValid = useSpecificSeed
    ? specificSeedTableName !== null
    : effectiveName.length >= 1 && effectiveName.length <= 45;
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
          <ActionButton compact title="Open game link" onPress={() => { setShowLiveGameLink(true); setLiveGameLinkError(null); }} />
        </View>
      </Panel>

      {showLiveGameLink && <Panel style={styles.linkPanel}>
        <SectionHeading title="Open game link" detail="Open a game or join a pregame table available in the Lobby." />
        <TextInput value={liveGameLink} onChangeText={(value) => { setLiveGameLink(value); setLiveGameLinkError(null); setLiveGameLinkPassword(''); }}
          placeholder="https://hanab.live/game/123" autoCapitalize="none" autoCorrect={false}
          style={[styles.linkInput, { color: theme.colors.text, borderColor: theme.colors.border }]} />
        {(() => {
          const parsed = parseLiveGameInput(liveGameLink);
          const target = parsed.kind === 'pregame' ? tables.find((table) => table.id === parsed.tableID) : undefined;
          return parsed.kind === 'pregame' && target?.passwordProtected === true ? (
            <TextInput value={liveGameLinkPassword} onChangeText={setLiveGameLinkPassword}
              placeholder="Table password" secureTextEntry autoCapitalize="none" autoCorrect={false}
              style={[styles.linkInput, { color: theme.colors.text, borderColor: theme.colors.border }]} />
          ) : null;
        })()}
        {liveGameLinkError !== null && <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{liveGameLinkError}</Text>}
        <View style={styles.heroActions}>
          <ActionButton compact title="Paste from clipboard" tone="secondary" onPress={() => {
            void clipboard.readClipboard().then((text) => {
              if (text.trim() === '') setLiveGameLinkError('Clipboard is empty.');
              else { setLiveGameLink(text); setLiveGameLinkError(null); setLiveGameLinkPassword(''); }
            }).catch(() => setLiveGameLinkError('Could not read the clipboard.'));
          }} />
          <ActionButton compact title="Open game" tone="primary" onPress={() => {
            const parsed = parseLiveGameInput(liveGameLink);
            if (parsed.kind === 'invalid') { setLiveGameLinkError(parsed.reason); return; }
            if (parsed.kind === 'liveGame' && !lobbyRuntime.openLiveGameByID(parsed.tableID)) {
              setLiveGameLinkError('That running table is not currently available to open.');
              return;
            }
            if (parsed.kind === 'pregame') {
              const table = tables.find((candidate) => candidate.id === parsed.tableID);
              if (table?.passwordProtected && liveGameLinkPassword.length === 0) {
                setLiveGameLinkError('Enter the table password.');
                return;
              }
              if (!lobbyRuntime.openPregameByID(parsed.tableID, liveGameLinkPassword || undefined)) {
                setLiveGameLinkError('That pregame table is not currently available to join.');
                return;
              }
            }
            setLiveGameLinkError(null);
            setLiveGameLinkPassword('');
            setShowLiveGameLink(false);
            setLiveGameLink('');
          }} />
          <ActionButton compact title="Cancel" tone="secondary" onPress={() => {
            setShowLiveGameLink(false); setLiveGameLink(''); setLiveGameLinkError(null); setLiveGameLinkPassword('');
          }} />
        </View>
      </Panel>}

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
              <ActionButton
                title={useSpecificSeed ? 'Use specific seed: On' : 'Use specific seed'}
                onPress={() => setUseSpecificSeed((enabled) => {
                  if (enabled) setReproductionPlayerCount(null);
                  return !enabled;
                })}
              />
              {useSpecificSeed ? (
                <>
                  <Field
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(value) => {
                      setSeedSuffix(value);
                      setReproductionPlayerCount(null);
                    }}
                    placeholder="Seed suffix"
                    spellCheck={false}
                    value={seedSuffix}
                  />
                  <Text style={{ color: theme.colors.textMuted }}>
                    hanab.live combines this suffix with the actual player count and variant when the game starts.
                  </Text>
                  {reproductionPlayerCount !== null && <Text style={{ color: theme.colors.textMuted }}>
                    To reproduce this deal, start with exactly {reproductionPlayerCount} players and keep this variant.
                  </Text>}
                </>
              ) : (
                <Field maxLength={45} onChangeText={setTableName} placeholder={randomTableName ?? 'Table name'} value={tableName} />
              )}
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
                        onPress={() => {
                          setMaxPlayers(value);
                          setReproductionPlayerCount(null);
                          setSelectedBots((names) => names.slice(0, value - 1));
                        }}
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
              <TableOptionsEditor options={createOptions} onChange={(options) => {
                setCreateOptions(options);
                setReproductionPlayerCount(null);
              }} />
              <ActionButton
                disabled={attendancePending || !createNameIsValid}
                title={roomState.pendingCreate === null ? 'Create table' : 'Creating…'}
                tone="primary"
                onPress={() => {
                  if (lobbyRuntime.createTable(submittedName, maxPlayers, createOptions, tablePassword, selectedBots)) {
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
  linkPanel: { gap: 10 },
  linkInput: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
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
