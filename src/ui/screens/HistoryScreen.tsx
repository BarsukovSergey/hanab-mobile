import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { areTableOptionsSupported, getSupportedVariantMaxScore } from '../../game/client/supportedVariants';
import { parseReplayInput, type ReplayInputResult } from '../../game/client/replayInput';
import { replayInputActions, type ReplayInputActions } from '../../platform/replayInputActions';
import { copyHistorySeed } from '../historySeedCopy';
import { extractCanonicalHistorySeedSuffix } from '../specificSeedName';
import type { MobileTableOptions } from '../../protocol/lobbyProtocol';
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
  roomOccupied,
  onBack,
  showEmbeddedBack = true,
  onWatchReplay,
  onWatchJSONReplay,
  onWatchReplayInput,
  onPlaySeed,
  clipboardActions = replayInputActions,
}: {
  roomOccupied: boolean;
  onBack: () => void;
  showEmbeddedBack?: boolean;
  onWatchReplay: (databaseID: number, visibility: 'solo' | 'shared') => void;
  onWatchJSONReplay: (gameJSON: Record<string, unknown>, visibility: 'solo' | 'shared') => void;
  onWatchReplayInput: (request: Exclude<ReplayInputResult, { kind: 'invalid' }>) => void;
  onPlaySeed: (prefill: { seedSuffix: string; maxPlayers: number; createOptions: MobileTableOptions; numPlayers: number }) => void;
  clipboardActions?: ReplayInputActions;
}) {
  const { theme } = useHanabTheme();
  const { wide } = useResponsiveLayout();
  const history = useAppSelector((state) => state.history);
  const session = useAppSelector((state) => state.session);
  const [selection, setSelection] = useState<{ epoch: number; mode: 'mine' | 'friends' | 'tagged' }>({
    epoch: session.connectionEpoch, mode: 'mine',
  });
  const [tagInput, setTagInput] = useState('');
  const [replayJSONText, setReplayJSONText] = useState('');
  const [replayVisibility, setReplayVisibility] = useState<'solo' | 'shared'>('solo');
  const [replayJSONError, setReplayJSONError] = useState<string | null>(null);
  const [seedCopyFeedback, setSeedCopyFeedback] = useState<{ itemID: number; message: string } | null>(null);
  const seedCopyGeneration = useRef(0);
  const invalidateSeedCopy = useCallback(() => {
    seedCopyGeneration.current += 1;
    setSeedCopyFeedback(null);
  }, []);
  useEffect(() => {
    if (
      session.friends.length === 0
      && (selection.epoch !== session.connectionEpoch || selection.mode === 'friends')
    ) {
      invalidateSeedCopy();
      setSelection({ epoch: session.connectionEpoch, mode: 'mine' });
    }
  }, [invalidateSeedCopy, selection, session.connectionEpoch, session.friends.length]);
  const mode = selection.epoch === session.connectionEpoch ? selection.mode : 'mine';
  const showingFriends = mode === 'friends' && session.friends.length > 0;
  const showingTagged = mode === 'tagged';
  const tagItems = history.tagSearchActive
    ? history.tagSearchItems ?? [] : history.taggedItems;
  const items = showingTagged ? tagItems : showingFriends ? history.friendItems : history.items;
  const initialPageReceived = showingTagged ? history.tagSearchActive
    ? history.tagSearchItems !== null : history.taggedLoaded
    : showingFriends ? history.friendInitialPageReceived : history.initialPageReceived;
  const hasMore = !showingTagged && (showingFriends ? history.friendHasMore : history.hasMore);
  const pendingRequest = showingTagged ? null : showingFriends ? history.friendPendingRequest : history.pendingRequest;
  const replayPending = history.pendingReplayCreate !== null;
  const comparing = history.pendingOtherScores !== null || history.otherScores !== null;
  const returnFromComparison = () => {
    invalidateSeedCopy();
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
        {showEmbeddedBack && <ActionButton compact title="Back to lobby" onPress={() => {
          invalidateSeedCopy();
          if (comparing) lobbyRuntime.dismissOtherScores();
          onBack();
        }} />}
      </Panel>
      {roomOccupied && <Notice>You're already in a room. History stays available for browsing, but return to the current room before opening another replay or starting this seed.</Notice>}

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
            onPress={() => { setSelection({ epoch: session.connectionEpoch, mode: 'mine' }); invalidateSeedCopy(); }} />
          {session.friends.length > 0 && <ActionButton compact title="Friends history" tone={showingFriends ? 'primary' : 'secondary'}
            onPress={() => {
              setSelection({ epoch: session.connectionEpoch, mode: 'friends' });
              invalidateSeedCopy();
              lobbyRuntime.ensureFriendsHistory();
            }} />}
          <ActionButton compact title="Tagged games" tone={showingTagged ? 'primary' : 'secondary'}
            onPress={() => { setSelection({ epoch: session.connectionEpoch, mode: 'tagged' }); invalidateSeedCopy(); lobbyRuntime.ensureTaggedGames(); }} />
        </View>
      )}

      {!comparing && showingTagged && <Panel style={styles.search}>
        <Field autoCapitalize="none" autoCorrect={false} onChangeText={setTagInput} placeholder="Exact tag" value={tagInput} />
        <ActionButton compact title="Search" disabled={history.tagSearchPending || tagInput.trim() === ''}
          onPress={() => { invalidateSeedCopy(); lobbyRuntime.searchTag(tagInput); }} />
        <ActionButton compact title="Clear search" tone="secondary" disabled={!history.tagSearchActive}
          onPress={() => { invalidateSeedCopy(); lobbyRuntime.clearTagSearch(); }} />
      </Panel>}

      {!comparing && <Panel style={styles.importPanel}>
        <SectionHeading title="Open replay" detail="Paste replay JSON or a hanab.live replay link." />
        <TextInput multiline value={replayJSONText} onChangeText={setReplayJSONText}
          placeholder="Replay JSON or https://hanab.live/replay/…" autoCapitalize="none" autoCorrect={false}
          style={[styles.jsonInput, { color: theme.colors.text, borderColor: theme.colors.border }]} />
        <View style={styles.search}>
          <ActionButton compact title="Paste from clipboard" tone="secondary" onPress={() => {
            void clipboardActions.readClipboard().then((text) => {
              if (text.trim() === '') setReplayJSONError('Clipboard is empty.');
              else { setReplayJSONText(text); setReplayJSONError(null); }
            }).catch(() => setReplayJSONError('Could not read the clipboard.'));
          }} />
          <ActionButton compact title="Solo" tone={replayVisibility === 'solo' ? 'primary' : 'secondary'}
            onPress={() => setReplayVisibility('solo')} />
          <ActionButton compact title="Shared" tone={replayVisibility === 'shared' ? 'primary' : 'secondary'}
            onPress={() => setReplayVisibility('shared')} />
          <ActionButton compact title="Open replay" disabled={roomOccupied || replayPending || replayJSONText.trim() === ''}
            onPress={() => {
              if (roomOccupied) return;
              const parsed = parseReplayInput(replayJSONText, replayVisibility);
              if (parsed.kind === 'invalid') { setReplayJSONError(parsed.reason); return; }
              setReplayJSONError(null);
              if (parsed.kind === 'id') onWatchReplayInput(parsed);
              else onWatchJSONReplay(parsed.gameJSON, parsed.visibility);
            }} />
        </View>
        {replayJSONError !== null && <Notice tone="error">{replayJSONError}</Notice>}
      </Panel>}

      {!comparing && showingTagged && history.taggedPending && !history.tagSearchActive && <Notice>Loading tagged games…</Notice>}
      {!comparing && showingTagged && !history.taggedLoaded && !history.taggedPending
        && !history.tagSearchActive && history.taggedError === null
        && <Notice>Select Tagged games to load.</Notice>}
      {!comparing && showingTagged && history.tagSearchPending && <Notice>Searching for tag…</Notice>}
      {!comparing && showingTagged && !history.tagSearchActive && history.taggedError !== null && <Notice tone="error">{history.taggedError}</Notice>}
      {!comparing && showingTagged && history.tagSearchActive && history.tagSearchError !== null
        && <Notice tone="error">{history.tagSearchError}</Notice>}
      {!comparing && !showingTagged && !initialPageReceived && <Notice>{showingFriends ? 'Loading friends history…' : 'Loading game history…'}</Notice>}
      {!comparing && !showingTagged && history.error !== null && <Notice tone="error">{history.error}</Notice>}
      {!comparing && !showingTagged && initialPageReceived && items.length === 0 && (
        <Panel><EmptyState>{showingFriends
          ? 'None of your friends have played any games yet.' : 'No finished games yet.'}</EmptyState></Panel>
      )}
      {!comparing && showingTagged && history.tagSearchActive && !history.tagSearchPending
        && history.tagSearchError === null && history.tagSearchItems !== null
        && history.tagSearchItems.length === 0
        && <Panel><EmptyState>No games found for this tag.</EmptyState></Panel>}
      {!comparing && showingTagged && !history.tagSearchActive && history.taggedLoaded
        && history.taggedItems.length === 0
        && <Panel><EmptyState>No tagged games found.</EmptyState></Panel>}

      <View style={[styles.grid, wide && styles.gridWide]}>
        {(comparing ? history.otherScores?.games ?? [] : items).map((item) => {
          const supported = areTableOptionsSupported(item.options);
          const seedSuffix = supported
            ? extractCanonicalHistorySeedSuffix(item.seed, item.options.numPlayers, item.options.variantID)
            : null;
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
              <View style={styles.seedMetadata}>
                <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                  {item.seed !== '' ? `Seed ${item.seed}` : 'Seed unavailable'} · {item.numTurns} turns
                </Text>
                {item.seed !== '' && <ActionButton compact title="Copy seed" tone="secondary" onPress={() => {
                  const requestID = ++seedCopyGeneration.current;
                  setSeedCopyFeedback(null);
                  void copyHistorySeed(item.seed, clipboardActions).then((copied) => {
                    if (requestID !== seedCopyGeneration.current) return;
                    setSeedCopyFeedback({
                      itemID: item.id,
                      message: copied ? 'Seed copied.' : 'Could not copy seed.',
                    });
                  });
                }} />}
                {supported && seedSuffix !== null && <ActionButton compact title="Play this seed" tone="secondary" disabled={roomOccupied} onPress={() => {
                  if (roomOccupied) return;
                  onPlaySeed({
                    seedSuffix,
                    maxPlayers: item.options.numPlayers,
                    numPlayers: item.options.numPlayers,
                    createOptions: {
                      variantName: item.options.variantName,
                      timed: item.options.timed,
                      timeBase: item.options.timeBase,
                      timePerTurn: item.options.timePerTurn,
                      cardCycle: item.options.cardCycle,
                      emptyClues: item.options.emptyClues,
                      oneExtraCard: item.options.oneExtraCard,
                      oneLessCard: item.options.oneLessCard,
                      allOrNothing: item.options.allOrNothing,
                    },
                  });
                }} />}
              </View>
              {seedCopyFeedback?.itemID === item.id
                && <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{seedCopyFeedback.message}</Text>}
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{END_CONDITIONS[item.endCondition]}</Text>
              {item.tags !== '' && <Text style={[styles.tags, { color: theme.colors.textMuted }]}>{item.tags}</Text>}
              {!supported && <Notice tone="error">This game uses unsupported options.</Notice>}
              <ActionButton
                disabled={roomOccupied || !supported || replayPending}
                title={replayPending ? 'Opening replay…' : 'Watch replay'}
                tone={supported ? 'primary' : 'secondary'}
                onPress={() => { if (roomOccupied) return; onWatchReplay(item.id, 'solo'); }}
              />
              <ActionButton
                compact
                disabled={roomOccupied || !supported || replayPending}
                title="Share replay"
                tone="secondary"
                onPress={() => { if (roomOccupied) return; onWatchReplay(item.id, 'shared'); }}
              />
              {!comparing && !showingTagged && <ActionButton
                compact
                disabled={otherCount === 0 || history.pendingOtherScores !== null}
                title={`Other scores · ${otherCount}`}
                tone="secondary"
                onPress={() => { invalidateSeedCopy(); lobbyRuntime.loadOtherScores(item.id, showingFriends); }}
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
  importPanel: { gap: 10 },
  jsonInput: { minHeight: 110, borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: 'top' },
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
  seedMetadata: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tags: { fontSize: 12, lineHeight: 16 },
});
