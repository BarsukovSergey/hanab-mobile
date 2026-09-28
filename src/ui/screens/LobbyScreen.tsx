import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { tableSelectors } from '../../store/store';
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
import { parseLiveGameInput } from '../../game/client/liveGameInput';
import { clipboardActions, type ClipboardActions } from '../../platform/replayInputActions';

export function LobbyScreen({
  onCreate,
  openGameLinkRequest = 0,
  clipboard = clipboardActions,
}: {
  onCreate: () => void;
  openGameLinkRequest?: number;
  clipboard?: ClipboardActions;
}) {
  const { theme } = useHanabTheme();
  const { wide } = useResponsiveLayout();
  const [showLiveGameLink, setShowLiveGameLink] = useState(false);
  const [liveGameLink, setLiveGameLink] = useState('');
  const [liveGameLinkError, setLiveGameLinkError] = useState<string | null>(null);
  const [liveGameLinkPassword, setLiveGameLinkPassword] = useState('');
  const handledGameLinkRequest = useRef(0);
  useEffect(() => {
    if (openGameLinkRequest <= handledGameLinkRequest.current) return;
    handledGameLinkRequest.current = openGameLinkRequest;
    setLiveGameLinkError(null);
    setShowLiveGameLink(true);
  }, [openGameLinkRequest]);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinPasswordTableID, setJoinPasswordTableID] = useState<number | null>(null);
  const tables = useAppSelector(tableSelectors.selectAll);
  const roomState = useAppSelector((state) => state.room);
  const friends = useAppSelector((state) => state.session.friends);
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
      <Panel style={[styles.hero, !wide && styles.heroNarrow]}>
        <View style={[styles.heroCopy, !wide && styles.heroCopyNarrow]}>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>HANAB</Text>
          <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Home</Text>
          <Text style={[styles.heroDetail, { color: theme.colors.textMuted }]}>
            {tables.length} {tables.length === 1 ? 'table' : 'tables'} available
          </Text>
        </View>
        <View style={[styles.heroActions, !wide && styles.heroActionsNarrow]}>
          <ActionButton compact title="Create" disabled={!showCreateTable} onPress={onCreate} />
          <ActionButton compact title="Open game link" onPress={() => { setShowLiveGameLink(true); setLiveGameLinkError(null); }} />
        </View>
      </Panel>
      {!showCreateTable && <Text style={{ color: theme.colors.textMuted }}>Create is unavailable while you have a running game to rejoin.</Text>}

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
              title="Rejoin game"
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
  heroNarrow: { alignItems: 'stretch', flexDirection: 'column', gap: 12 },
  heroCopy: { flex: 1, gap: 2, minWidth: 0 },
  heroCopyNarrow: { flex: 0 },
  heroActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  heroActionsNarrow: { alignSelf: 'stretch', justifyContent: 'flex-start' },
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
