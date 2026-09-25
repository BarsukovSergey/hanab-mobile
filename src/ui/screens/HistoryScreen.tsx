import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { areTableOptionsSupported, getSupportedVariantMaxScore } from '../../game/client/supportedVariants';
import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import {
  ActionButton,
  Field,
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
  onWatchReplay: (databaseID: number, visibility: 'solo' | 'shared') => void;
}) {
  const { theme } = useHanabTheme();
  const { wide } = useResponsiveLayout();
  const history = useAppSelector((state) => state.history);
  const session = useAppSelector((state) => state.session);
  const [selection, setSelection] = useState<{ epoch: number; mode: 'mine' | 'friends' | 'tagged' }>({
    epoch: session.connectionEpoch, mode: 'mine',
  });
  const [tagInput, setTagInput] = useState('');
  useEffect(() => {
    if (
      session.friends.length === 0
      && (selection.epoch !== session.connectionEpoch || selection.mode === 'friends')
    ) setSelection({ epoch: session.connectionEpoch, mode: 'mine' });
  }, [selection, session.connectionEpoch, session.friends.length]);
  const mode = selection.epoch === session.connectionEpoch ? selection.mode : 'mine';
  const showingFriends = mode === 'friends' && session.friends.length > 0;
  const showingTagged = mode === 'tagged';
  const tagItems = history.tagSearchItems ?? history.taggedItems;
  const items = showingTagged ? tagItems : showingFriends ? history.friendItems : history.items;
  const initialPageReceived = showingTagged ? history.tagSearchItems !== null || history.taggedLoaded
    : showingFriends ? history.friendInitialPageReceived : history.initialPageReceived;
  const hasMore = !showingTagged && (showingFriends ? history.friendHasMore : history.hasMore);
  const pendingRequest = showingTagged ? null : showingFriends ? history.friendPendingRequest : history.pendingRequest;
  const replayPending = history.pendingReplayCreate !== null;
  const comparing = history.pendingOtherScores !== null || history.otherScores !== null;
  const returnFromComparison = () => {
    const friends = history.otherScores?.friends ?? history.pendingOtherScores?.friends ?? false;
    setSelection({ epoch: session.connectionEpoch, mode: friends && session.friends.length > 0 ? 'friends' : 'mine' });
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

      {!comparing && (
        <View style={styles.switcher}>
          <ActionButton compact title="My history" tone={mode === 'mine' ? 'primary' : 'secondary'}
            onPress={() => setSelection({ epoch: session.connectionEpoch, mode: 'mine' })} />
          {session.friends.length > 0 && <ActionButton compact title="Friends history" tone={showingFriends ? 'primary' : 'secondary'}
            onPress={() => {
              setSelection({ epoch: session.connectionEpoch, mode: 'friends' });
              lobbyRuntime.ensureFriendsHistory();
            }} />}
          <ActionButton compact title="Tagged games" tone={showingTagged ? 'primary' : 'secondary'}
            onPress={() => { setSelection({ epoch: session.connectionEpoch, mode: 'tagged' }); lobbyRuntime.ensureTaggedGames(); }} />
        </View>
      )}

      {!comparing && showingTagged && <Panel style={styles.search}>
        <Field autoCapitalize="none" autoCorrect={false} onChangeText={setTagInput} placeholder="Exact tag" value={tagInput} />
        <ActionButton compact title="Search" disabled={history.tagSearchPending || tagInput.trim() === ''}
          onPress={() => lobbyRuntime.searchTag(tagInput)} />
        <ActionButton compact title="Clear search" tone="secondary" disabled={history.tagSearchItems === null && !history.tagSearchPending}
          onPress={() => lobbyRuntime.clearTagSearch()} />
      </Panel>}

      {!comparing && !initialPageReceived && <Notice>{showingTagged ? (history.taggedPending || history.tagSearchPending ? 'Loading tagged games…' : 'Select Tagged games to load.') : showingFriends ? 'Loading friends history…' : 'Loading game history…'}</Notice>}
      {!comparing && history.tagError !== null && showingTagged && <Notice tone="error">{history.tagError}</Notice>}
      {!comparing && !showingTagged && history.error !== null && <Notice tone="error">{history.error}</Notice>}
      {!comparing && initialPageReceived && items.length === 0 && (
        <Panel><EmptyState>{showingFriends
          ? 'None of your friends have played any games yet.' : showingTagged ? 'No tagged games found.' : 'No finished games yet.'}</EmptyState></Panel>
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
                onPress={() => onWatchReplay(item.id, 'solo')}
              />
              <ActionButton
                compact
                disabled={!supported || replayPending}
                title="Share replay"
                tone="secondary"
                onPress={() => onWatchReplay(item.id, 'shared')}
              />
              {!comparing && !showingTagged && <ActionButton
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
  search: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
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
