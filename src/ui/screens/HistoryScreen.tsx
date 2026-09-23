import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { areTableOptionsSupported, getSupportedVariantMaxScore } from '../../game/client/supportedVariants';
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
  const session = useAppSelector((state) => state.session);
  const [selection, setSelection] = useState<{ epoch: number; friends: boolean }>({
    epoch: session.connectionEpoch, friends: false,
  });
  useEffect(() => {
    if (
      session.friends.length === 0
      && (selection.epoch !== session.connectionEpoch || selection.friends)
    ) setSelection({ epoch: session.connectionEpoch, friends: false });
  }, [selection, session.connectionEpoch, session.friends.length]);
  const showingFriends = selection.epoch === session.connectionEpoch
    && selection.friends && session.friends.length > 0;
  const items = showingFriends ? history.friendItems : history.items;
  const initialPageReceived = showingFriends
    ? history.friendInitialPageReceived : history.initialPageReceived;
  const hasMore = showingFriends ? history.friendHasMore : history.hasMore;
  const pendingRequest = showingFriends ? history.friendPendingRequest : history.pendingRequest;
  const replayPending = history.pendingReplayCreate !== null;
  const comparing = history.pendingOtherScores !== null || history.otherScores !== null;
  const returnFromComparison = () => {
    const friends = history.otherScores?.friends ?? history.pendingOtherScores?.friends ?? false;
    setSelection({ epoch: session.connectionEpoch, friends: friends && session.friends.length > 0 });
    lobbyRuntime.dismissOtherScores();
  };
  return (
    <View style={styles.root}>
      <Panel style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>REPLAYS</Text>
          <SectionHeading title={comparing ? 'Other Scores' : 'Game history'} detail={comparing
            ? 'Games played on this seed.'
            : 'Open a finished game using the same authoritative replay path.'} />
        </View>
        <ActionButton compact title="Back to lobby" onPress={() => {
          if (comparing) lobbyRuntime.dismissOtherScores();
          onBack();
        }} />
      </Panel>

      {comparing && (
        <Panel style={styles.gameCard}>
          <Text style={[styles.gameTitle, { color: theme.colors.text }]}>Seed {history.otherScores?.seed ?? history.pendingOtherScores?.seed}</Text>
          {history.otherScores && <Text style={{ color: theme.colors.textMuted }}>{history.otherScores.variantName}</Text>}
          {history.pendingOtherScores && <Notice>Loading other scores…</Notice>}
          <ActionButton compact title="Return to history" onPress={returnFromComparison} />
        </Panel>
      )}

      {!comparing && session.friends.length > 0 && (
        <View style={styles.switcher}>
          <ActionButton compact title="My history" tone={showingFriends ? 'secondary' : 'primary'}
            onPress={() => setSelection({ epoch: session.connectionEpoch, friends: false })} />
          <ActionButton compact title="Friends history" tone={showingFriends ? 'primary' : 'secondary'}
            onPress={() => {
              setSelection({ epoch: session.connectionEpoch, friends: true });
              lobbyRuntime.ensureFriendsHistory();
            }} />
        </View>
      )}

      {!comparing && !initialPageReceived && <Notice>{showingFriends ? 'Loading friends history…' : 'Loading game history…'}</Notice>}
      {history.error !== null && <Notice tone="error">{history.error}</Notice>}
      {!comparing && initialPageReceived && items.length === 0 && (
        <Panel><EmptyState>{showingFriends
          ? 'None of your friends have played any games yet.' : 'No finished games yet.'}</EmptyState></Panel>
      )}

      <View style={[styles.grid, wide && styles.gridWide]}>
        {(comparing ? history.otherScores?.games ?? [] : items).map((item) => {
          const supported = areTableOptionsSupported(item.options);
          const maxScore = comparing && supported ? getSupportedVariantMaxScore(item.options.variantName) : null;
          const otherCount = Math.max(0, item.numGamesOnThisSeed - 1);
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
                <Pill active={supported}>Score {item.score}{maxScore !== null ? ` / ${maxScore}` : ''}</Pill>
              </View>
              {comparing && item.playerNames.includes(session.authenticatedUser?.username ?? '')
                && <Pill active>Your game</Pill>}
              <Text style={[styles.players, { color: theme.colors.text }]}>{item.playerNames.join(', ')}</Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{finishedLabel}</Text>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{END_CONDITIONS[item.endCondition]}</Text>
              {item.tags !== '' && <Text style={[styles.tags, { color: theme.colors.textMuted }]}>{item.tags}</Text>}
              {!supported && <Notice tone="error">This game uses unsupported options.</Notice>}
              <ActionButton
                disabled={!supported || replayPending}
                title={replayPending ? 'Opening replay…' : 'Watch replay'}
                tone={supported ? 'primary' : 'secondary'}
                onPress={() => onWatchReplay(item.id)}
              />
              {!comparing && <ActionButton
                compact
                disabled={otherCount === 0 || history.pendingOtherScores !== null}
                title={`Other scores · ${otherCount}`}
                tone="secondary"
                onPress={() => lobbyRuntime.loadOtherScores(item.id, showingFriends)}
              />}
            </Panel>
          );
        })}
      </View>

      {!comparing && hasMore && (
        <ActionButton
          disabled={pendingRequest !== null}
          title={pendingRequest === null ? 'Load more' : 'Loading more…'}
          onPress={() => showingFriends
            ? lobbyRuntime.loadMoreFriendsHistory() : lobbyRuntime.loadMoreHistory()}
        />
      )}
      {!comparing && pendingRequest !== null && <Text style={{ color: theme.colors.textMuted }}>Loading another page…</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  tags: { fontSize: 12, lineHeight: 16 },
});
