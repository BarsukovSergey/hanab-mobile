import { StyleSheet, Text, View } from 'react-native';

import { areTableOptionsSupported } from '../../game/client/supportedVariants';
import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import {
  ActionButton,
  EmptyState,
  Notice,
  Panel,
  Pill,
  SectionHeading,
  useHanabTheme,
  useResponsiveLayout,
} from '../designSystem';

const END_CONDITIONS = [
  'In progress', 'Normal', 'Strikeout', 'Timeout', 'Terminated by player',
  'Speedrun failed', 'Idle timeout', 'Character softlock',
  'All or Nothing failed', 'All or Nothing softlock', 'Terminated by vote',
] as const;

export function HistoryScreen({
  onBack,
  onWatchReplay,
}: {
  onBack: () => void;
  onWatchReplay: (databaseID: number) => void;
}) {
  const { theme } = useHanabTheme();
  const { wide } = useResponsiveLayout();
  const history = useAppSelector((state) => state.history);
  const replayPending = history.pendingReplayCreate !== null;
  return (
    <View style={styles.root}>
      <Panel style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>REPLAYS</Text>
          <SectionHeading title="Game history" detail="Open a finished game using the same authoritative replay path." />
        </View>
        <ActionButton compact title="Back to lobby" onPress={onBack} />
      </Panel>

      {!history.initialPageReceived && <Notice>Loading game history…</Notice>}
      {history.error !== null && <Notice tone="error">{history.error}</Notice>}
      {history.initialPageReceived && history.items.length === 0 && (
        <Panel><EmptyState>No finished games yet.</EmptyState></Panel>
      )}

      <View style={[styles.grid, wide && styles.gridWide]}>
        {history.items.map((item) => {
          const supported = areTableOptionsSupported(item.options);
          const finished = new Date(item.datetimeFinished);
          const finishedLabel = Number.isNaN(finished.getTime())
            ? item.datetimeFinished
            : finished.toLocaleString();
          return (
            <Panel key={item.id} style={[styles.gameCard, wide && styles.gameCardWide]}>
              <View style={styles.gameHeader}>
                <View style={styles.gameCopy}>
                  <Text style={[styles.gameTitle, { color: theme.colors.text }]}>Game #{item.id}</Text>
                  <Text style={[styles.variant, { color: theme.colors.textMuted }]}>{item.options.variantName}</Text>
                </View>
                <Pill active={supported}>Score {item.score}</Pill>
              </View>
              <Text style={[styles.players, { color: theme.colors.text }]}>{item.playerNames.join(', ')}</Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{finishedLabel}</Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{END_CONDITIONS[item.endCondition]}</Text>
              {!supported && <Notice tone="error">This game uses unsupported options.</Notice>}
              <ActionButton
                disabled={!supported || replayPending}
                title={replayPending ? 'Opening replay…' : 'Watch replay'}
                tone={supported ? 'primary' : 'secondary'}
                onPress={() => onWatchReplay(item.id)}
              />
            </Panel>
          );
        })}
      </View>

      {history.hasMore && (
        <ActionButton
          disabled={history.pendingRequest !== null}
          title={history.pendingRequest === null ? 'Load more' : 'Loading more…'}
          onPress={() => lobbyRuntime.loadMoreHistory()}
        />
      )}
      {history.pendingRequest !== null && <Text style={{ color: theme.colors.textMuted }}>Loading another page…</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  grid: { gap: 12 },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  gameCard: { gap: 10 },
  gameCardWide: { flexBasis: '48%', flexGrow: 1, minWidth: 320 },
  gameHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  gameCopy: { flex: 1, gap: 2 },
  gameTitle: { fontSize: 18, fontWeight: '900' },
  variant: { fontSize: 13 },
  players: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  meta: { fontSize: 12, lineHeight: 17 },
});
