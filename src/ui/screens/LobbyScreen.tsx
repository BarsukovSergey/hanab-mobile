import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MobileTableOptions } from '../../protocol/lobbyProtocol';
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
import { TableOptionsEditor } from '../TableOptionsEditor';

const DEFAULT_OPTIONS: MobileTableOptions = {
  variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
  cardCycle: false, emptyClues: false,
  oneExtraCard: false, oneLessCard: false, allOrNothing: false,
};

export function LobbyScreen({ onOpenHistory }: { onOpenHistory: () => void }) {
  const { theme } = useHanabTheme();
  const { wide } = useResponsiveLayout();
  const [tableName, setTableName] = useState('');
  const [tablePassword, setTablePassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [createOptions, setCreateOptions] = useState<MobileTableOptions>(DEFAULT_OPTIONS);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinPasswordTableID, setJoinPasswordTableID] = useState<number | null>(null);
  const tables = useAppSelector(tableSelectors.selectAll);
  const roomState = useAppSelector((state) => state.room);
  const {
    yourRunningGames,
    pregameTables,
    runningTables,
    sharedReplays,
    showCreateTable,
  } = getLobbySections(tables);
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
        <ActionButton compact title="Game history" onPress={onOpenHistory} />
      </Panel>

      {yourRunningGames.length > 0 && (
        <TableSection
          empty="No game to resume."
          title="Your running game"
          tables={yourRunningGames}
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
            {pregameTables.map((table) => (
              <View key={table.id} style={[styles.tableCard, { borderColor: theme.colors.border }]}>
                <View style={styles.tableHeader}>
                  <View style={styles.tableCopy}>
                    <Text style={[styles.tableName, { color: theme.colors.text }]}>{table.name}</Text>
                    <Text style={[styles.tableMeta, { color: theme.colors.textMuted }]}>
                      {table.variant} · {table.numPlayers}/{table.maxPlayers}
                    </Text>
                  </View>
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
            ))}
          </Panel>

          {showCreateTable && (
            <Panel>
              <SectionHeading title="Create table" detail="Start a new room with hanab.live-compatible options." />
              <Field maxLength={45} onChangeText={setTableName} placeholder="Table name" value={tableName} />
              <Field
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setTablePassword}
                placeholder="Table password (optional)"
                secureTextEntry
                value={tablePassword}
              />
              <View style={styles.stepperRow}>
                <View style={styles.stepperCopy}>
                  <Text style={[styles.label, { color: theme.colors.textMuted }]}>Max players</Text>
                  <Text style={[styles.stepperValue, { color: theme.colors.text }]}>{maxPlayers}</Text>
                </View>
                <View style={styles.actionsRow}>
                  <ActionButton compact disabled={maxPlayers <= 2} title="−" onPress={() => setMaxPlayers((n) => n - 1)} />
                  <ActionButton compact disabled={maxPlayers >= 6} title="+" onPress={() => setMaxPlayers((n) => n + 1)} />
                </View>
              </View>
              <TableOptionsEditor options={createOptions} onChange={setCreateOptions} />
              <ActionButton
                disabled={attendancePending || tableName.trim().length === 0}
                title={roomState.pendingCreate === null ? 'Create table' : 'Creating…'}
                tone="primary"
                onPress={() => {
                  if (lobbyRuntime.createTable(tableName, maxPlayers, createOptions, tablePassword)) {
                    setTablePassword('');
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
            action={(table) => (
              <ActionButton compact disabled={attendancePending} title="Spectate" onPress={() => lobbyRuntime.spectate(table.id)} />
            )}
          />
          <TableSection
            empty="No shared replays."
            title="Shared replays"
            tables={sharedReplays}
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
  action,
}: {
  title: string;
  empty: string;
  tables: LobbyTable[];
  action: (table: LobbyTable) => ReactNode;
}) {
  const { theme } = useHanabTheme();
  return (
    <Panel>
      <SectionHeading title={title} />
      {tables.length === 0 && <EmptyState>{empty}</EmptyState>}
      {tables.map((table) => (
        <View key={table.id} style={[styles.tableCard, { borderColor: theme.colors.border }]}>
          <View style={styles.tableHeader}>
            <View style={styles.tableCopy}>
              <Text style={[styles.tableName, { color: theme.colors.text }]}>{table.name}</Text>
              <Text style={[styles.tableMeta, { color: theme.colors.textMuted }]}>
                {table.variant} · {table.numPlayers}/{table.maxPlayers}
              </Text>
            </View>
            {action(table)}
          </View>
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  hero: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroCopy: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { fontSize: 28, fontWeight: '900' },
  heroDetail: { fontSize: 14 },
  columns: { gap: 16 },
  columnsWide: { alignItems: 'flex-start', flexDirection: 'row' },
  column: { flex: 1, gap: 16, minWidth: 0 },
  discoveryColumn: { flex: 0.92 },
  listColumn: { flex: 1.08 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  stepperRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  stepperCopy: { gap: 2 },
  stepperValue: { fontSize: 24, fontWeight: '800' },
  actionsRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tableCard: { borderTopWidth: 1, gap: 10, paddingTop: 12 },
  tableHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  tableCopy: { flex: 1, gap: 2, minWidth: 0 },
  tableName: { fontSize: 15, fontWeight: '800' },
  tableMeta: { fontSize: 13, lineHeight: 18 },
});
