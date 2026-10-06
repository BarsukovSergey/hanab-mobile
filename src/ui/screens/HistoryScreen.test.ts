import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const screen = readFileSync(resolve(__dirname, 'HistoryScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('History screen source contract', () => {
  test('History root orders Open Replay, sources, exact tag and compact rows', () => {
    const root = screen.slice(screen.indexOf('\n  return ('));
    const open = root.indexOf('<ActionButton title="Open replay"');
    const sources = root.indexOf('style={styles.switcher}');
    const tag = root.indexOf('placeholder="Exact tag"');
    const rows = root.indexOf('<View style={styles.grid}>');
    expect(open).toBeGreaterThan(0);
    expect(open).toBeLessThan(sources);
    expect(sources).toBeLessThan(tag);
    expect(tag).toBeLessThan(rows);
    expect(root).toContain('!comparing && detailsID === null && showingTagged && <Panel');
    expect(root).not.toContain('<TextInput');
    expect(root).not.toContain('parseHistoryReplayInput');
    expect(root).not.toContain('styles.importPanel');
    expect(screen).toContain("const wideRows = windowClass !== 'compact'");
    expect(root).toContain('wideRows && styles.rowSummaryWide');
    expect(root).toContain("rowSummaryWide: { flexDirection: 'row', alignItems: 'center', gap: 12 }");
    expect(root).not.toMatch(/gridWide|gameCardWide|flexBasis|splitPane/);
  });

  test('Review is primary and eligible secondary actions live only in selected local details', () => {
    const row = screen.slice(screen.indexOf('<Panel key={item.id}'), screen.indexOf('\n      {!comparing && detailsID === null && hasMore'));
    const summary = row.slice(0, row.indexOf('{showingDetails && <>'));
    const details = row.slice(row.indexOf('{showingDetails && <>'));
    expect(screen).toContain('const [detailsID, setDetailsID] = useState<number | null>(null)');
    expect(screen).toContain('if (detailsID !== null && detailsID !== item.id) return null');
    expect(summary).toContain("'Review'");
    expect(summary).toContain("tone={supported ? 'primary' : 'secondary'}");
    expect(summary).toContain("onWatchReplay(item.id, 'solo')");
    expect(summary).toContain('title="Details / actions >" tone="secondary"');
    expect(summary).toContain('setDetailsID(item.id)');
    for (const action of ['Copy seed', 'Play this seed', 'Share replay', 'Other scores']) {
      expect(summary).not.toContain(action);
      expect(details).toContain(action);
    }
    expect(details).toContain('END_CONDITIONS[item.endCondition]');
    expect(summary).toContain('item.playerNames.join');
    expect(summary).toContain('{finishedLabel}');
    expect(summary).toContain('{item.options.variantName}');
    expect(summary).toContain('{item.options.numPlayers}P');
    expect(summary).toContain('{item.score}');
  });

  test('Open Replay is a separate task with link/ID first and raw JSON behind Advanced', () => {
    const task = screen.slice(screen.indexOf('if (openReplayTask) return ('), screen.indexOf('\n  return ('));
    expect(screen).toContain('const [openReplayTask, setOpenReplayTask] = useState(false)');
    expect(screen).toContain('const [advancedReplay, setAdvancedReplay] = useState(false)');
    expect(task).toContain('!advancedReplay && <Field value={replayLinkText}');
    expect(task).toContain('placeholder="Replay link or database ID"');
    expect(task).toContain("title={advancedReplay ? 'Hide Advanced' : 'Advanced'}");
    expect(task).toContain('advancedReplay && <TextInput multiline value={replayJSONText}');
    expect(task).toContain('placeholder="Raw replay JSON"');
    expect(screen).toContain('advancedReplay ? replayJSONText : replayLinkText');
    expect(task).toContain('!replayUsesLink && <>');
    expect(task).toContain('title="Solo"');
    expect(task).toContain('title="Shared"');
    expect(task).toContain('title="Open"');
    expect(task).toContain('history.error !== null && <Notice tone="error">{history.error}');
    expect(task).not.toContain('items.map');
  });

  test('App-owned Back closes tasks/details before root navigation without opening anything', () => {
    const back = screen.slice(screen.indexOf('const handleBack ='), screen.indexOf('if (backRef) backRef.current'));
    const taskBack = back.slice(back.indexOf('if (openReplayTask)'), back.indexOf('if (detailsID !== null)'));
    expect(taskBack).toContain('setOpenReplayTask(false)');
    expect(taskBack).toContain('setAdvancedReplay(false)');
    expect(taskBack).toContain('return;');
    expect(back).toContain('if (detailsID !== null) { setDetailsID(null); return; }');
    expect(back).not.toMatch(/onWatch|watchReplay|watchJSON|onPlaySeed|createTable|unattend|leave/);
    expect(back.indexOf('if (detailsID !== null)')).toBeLessThan(back.indexOf('onBack()'));
    expect(screen).toContain('onPresentationChange?.();');
    expect(screen).toContain('[onPresentationChange, openReplayTask, detailsID]');
  });

  test('both embedded and App-owned Back run local History cleanup before navigation', () => {
    const handler = screen.slice(screen.indexOf('const handleBack ='), screen.indexOf('const returnFromComparison ='));
    expect(handler).toContain('invalidateSeedCopy();');
    expect(handler).toContain('if (comparing) lobbyRuntime.dismissOtherScores();');
    expect(handler).toContain('onBack();');
    expect(handler).toContain('backRef.current = handleBack;');
    expect(handler).toContain('if (backRef) backRef.current = null;');
    expect(screen).toContain('showEmbeddedBack && <ActionButton compact title="Back to lobby" onPress={handleBack}');
  });
  test('renders authoritative tags only when non-empty', () => {
    expect(screen).toContain("item.tags !== '' && <Text");
    expect(screen).toContain('>{item.tags}</Text>');
    expect(screen).not.toMatch(/item\.tags\.split/);
  });
  test('Open Replay preserves clipboard support and rejects invalid input locally', () => {
    expect(screen).toContain('title="Open replay"');
    expect(screen).toContain('parseHistoryReplayInput(replayInputText, replayVisibility, advancedReplay)');
    expect(screen).toContain('title="Paste from clipboard"');
    expect(screen).toContain('title="Open replay"');
    expect(screen).toContain('onWatchJSONReplay(parsed.gameJSON, parsed.visibility)');
    expect(screen).toContain("else { setReplayInputText(text); setReplayJSONError(null); }");
    expect(screen).toContain("setReplayJSONError('Clipboard is empty.')");
    expect(screen).toContain("setReplayJSONError('Could not read the clipboard.')");
  });

  test('same-seed comparison keeps source context and server order', () => {
    expect(screen).toContain('Math.max(0, item.numGamesOnThisSeed - 1)');
    expect(screen).toContain('lobbyRuntime.loadOtherScores(item.id, showingFriends)');
    expect(screen).toContain('otherCount === 0');
    expect(screen).toContain('comparing ? history.otherScores?.games ?? [] : items');
    expect(screen).toContain("item.playerNames.includes(session.authenticatedUser?.username ?? '')");
    expect(screen).toContain('title="Return to history" onPress={returnFromComparison}');
    expect(screen).toContain("mode: friends && session.friends.length > 0 ? 'friends' : 'mine'");
    expect(screen).toContain('lobbyRuntime.dismissOtherScores()');
  });
  test('renders authoritative seed and turn count on every card source through one card path', () => {
    expect(screen).toContain('(comparing ? history.otherScores?.games ?? [] : items).map((item) => {');
    expect(screen).toContain('history.friendItems');
    expect(screen).toContain('history.tagSearchItems ?? [] : history.taggedItems');
    expect(screen).toContain('`Seed ${item.seed}` : \'Seed unavailable\'');
    expect(screen).toContain('{item.numTurns} turns');
    expect(screen).toContain('copyHistorySeed(item.seed, clipboardActions)');
    expect(screen).toContain('title="Copy seed"');
    expect(screen).toContain("item.seed !== '' && <ActionButton");
    expect(screen).not.toMatch(/item\.seed\.trim\(|normalizeSeed/);
    expect(screen).toContain('const seedSuffix = supported');
    expect(screen).toContain('extractCanonicalHistorySeedSuffix(item.seed, item.options.numPlayers, item.options.variantID)');
    expect(screen).toContain('supported && seedSuffix !== null && <ActionButton compact title="Play this seed"');
    expect(screen).toContain('onPlaySeed({');
    expect(screen).toContain('seedSuffix,');
    expect(screen).toContain('maxPlayers: item.options.numPlayers');
    expect(screen).toContain('variantName: item.options.variantName');
    expect(screen).toContain('timed: item.options.timed');
    expect(screen).toContain('timeBase: item.options.timeBase');
    expect(screen).toContain('timePerTurn: item.options.timePerTurn');
    expect(screen).toContain('cardCycle: item.options.cardCycle');
    expect(screen).toContain('emptyClues: item.options.emptyClues');
    expect(screen).toContain('oneExtraCard: item.options.oneExtraCard');
    expect(screen).toContain('oneLessCard: item.options.oneLessCard');
    expect(screen).toContain('allOrNothing: item.options.allOrNothing');
    expect(screen).toContain('(comparing ? history.otherScores?.games ?? [] : items).map((item) => {');
  });

  test('keeps seed copy feedback local and reports both clipboard outcomes', () => {
    expect(screen).toContain('useState<{ itemID: number; message: string } | null>(null)');
    expect(screen).toContain("copied ? 'Seed copied.' : 'Could not copy seed.'");
    expect(screen).toContain('seedCopyFeedback?.itemID === item.id');
    expect(screen).toContain('setSeedCopyFeedback(null)');
    expect(screen).not.toContain('historyActions');
    expect(screen).not.toContain('dispatch(');
  });

  test('ignores stale copy completions when a newer copy or source transition supersedes them', () => {
    expect(screen).toContain('const seedCopyGeneration = useRef(0)');
    expect(screen).toContain('const requestID = ++seedCopyGeneration.current');
    expect(screen).toContain('if (requestID !== seedCopyGeneration.current) return;');
    expect(screen).toContain('seedCopyGeneration.current += 1');
    expect(screen).toContain("mode: 'mine' }); invalidateSeedCopy();");
    expect(screen).toContain('mode: \'friends\' });\n              invalidateSeedCopy();');
    expect(screen).toContain("mode: 'tagged' }); invalidateSeedCopy(); lobbyRuntime.ensureTaggedGames();");
    expect(screen).toContain('invalidateSeedCopy(); lobbyRuntime.searchTag(tagInput);');
    expect(screen).toContain('invalidateSeedCopy(); lobbyRuntime.clearTagSearch();');
    expect(screen).toContain('const returnFromComparison = () => {\n    invalidateSeedCopy();');
    expect(screen).toContain('invalidateSeedCopy(); lobbyRuntime.loadOtherScores(item.id, showingFriends);');
    expect(screen).toContain('title="Back to lobby" onPress={handleBack}');
  });

  test('offers Friends only for authoritative friends and uses its independent pages', () => {
    expect(screen).toContain('session.friends.length > 0');
    expect(screen).toContain('title="My history"');
    expect(screen).toContain('title="Friends"');
    expect(screen).toContain('lobbyRuntime.ensureFriendsHistory()');
    expect(screen).toContain('history.friendItems');
    expect(screen).toContain('history.friendPendingRequest');
    expect(screen).toContain('history.friendHasMore');
    expect(screen).toContain('lobbyRuntime.loadMoreFriendsHistory() : lobbyRuntime.loadMoreHistory()');
    expect(screen).toContain('None of your friends have played any games yet.');
    expect(screen).toContain("onPress={() => { if (roomOccupied) return; onWatchReplay(item.id, 'solo'); }}");
    expect(screen).toContain("onPress={() => { if (roomOccupied) return; onWatchReplay(item.id, 'shared'); }}");
    expect(screen).toContain('title="Share replay"');
    expect(screen).toContain('disabled={roomOccupied || !supported || replayPending}');
    expect(screen).toContain('(comparing ? history.otherScores?.games ?? [] : items).map((item) => {');
  });

  test('offers tagged games and exact tag search without other scores', () => {
    expect(screen).toContain('title="Tagged"');
    expect(screen).toContain('lobbyRuntime.ensureTaggedGames()');
    expect(screen).toContain('placeholder="Exact tag"');
    expect(screen).toContain('title="Search"');
    expect(screen).toContain('lobbyRuntime.searchTag(tagInput)');
    expect(screen).toContain('title="Clear search"');
    expect(screen).toContain('lobbyRuntime.clearTagSearch()');
    expect(screen).toContain('!comparing && !showingTagged && <ActionButton');
  });

  test('keeps previous search results hidden while a new exact tag request loads', () => {
    expect(screen).toContain('history.tagSearchActive');
    expect(screen).toContain('? history.tagSearchItems ?? [] : history.taggedItems');
    expect(screen).toContain('history.tagSearchPending && <Notice>Searching for tag…</Notice>');
    expect(screen).toContain('history.tagSearchItems !== null');
  });

  test('shows a search-specific empty state distinct from empty Tagged Games', () => {
    expect(screen).toContain('No games found for this tag.');
    expect(screen).toContain('No tagged games found.');
    expect(screen).toContain('!history.tagSearchActive && history.taggedLoaded');
  });

  test('keeps failed searches clearable and hides Tagged Games errors until search is cleared', () => {
    expect(screen).toContain('title="Clear search" tone="secondary" disabled={!history.tagSearchActive}');
    expect(screen).toContain('showingTagged && !history.tagSearchActive && history.taggedError !== null');
    expect(screen).toContain('history.tagSearchActive && history.tagSearchError !== null');
  });

  test('resets selection to My history on an empty friends list without auto-selecting on re-add', () => {
    expect(screen).toMatch(/useEffect\(\(\) => \{[\s\S]*?session\.friends\.length === 0[\s\S]*?selection\.mode === 'friends'[\s\S]*?invalidateSeedCopy\(\);[\s\S]*?setSelection\(\{ epoch: session\.connectionEpoch, mode: 'mine' \}\);[\s\S]*?\}, \[invalidateSeedCopy, selection, session\.connectionEpoch, session\.friends\.length\]\);/);
    expect(screen).toContain("const showingFriends = mode === 'friends' && session.friends.length > 0;");
    const resetEffect = screen.slice(screen.indexOf('useEffect('), screen.indexOf('const mode'));
    expect(resetEffect).not.toContain('ensureFriendsHistory');
    expect(screen).toContain("setSelection({ epoch: session.connectionEpoch, mode: 'friends' });");
    expect(screen).toContain('lobbyRuntime.ensureFriendsHistory();');
  });

  test('blocks replay and seed actions while leaving history browsing available', () => {
    expect(screen).toContain('roomOccupied: boolean;');
    expect(screen).toContain("You're already in a room. History stays available for browsing, but return to the current room before opening another replay or starting this seed.");
    expect(screen).toMatch(/title="Open" disabled=\{roomOccupied \|\| replayPending \|\| replayInputText\.trim\(\) === ''\}[\s\S]*?onPress=\{\(\) => \{\s*if \(roomOccupied\) return;\s*const parsed/);
    expect(screen).toMatch(/title="Play this seed"[^>]*disabled=\{roomOccupied\} onPress=\{\(\) => \{\s*if \(roomOccupied\) return;\s*onPlaySeed/);
    expect(screen.match(/disabled=\{roomOccupied \|\| !supported \|\| replayPending\}/g)).toHaveLength(2);
    expect(screen).toContain("if (roomOccupied) return; onWatchReplay(item.id, 'solo');");
    expect(screen).toContain("if (roomOccupied) return; onWatchReplay(item.id, 'shared');");
    for (const action of ['My history', 'Friends', 'Tagged', 'Search', 'Clear search', 'Copy seed', 'Other scores', 'Load more']) {
      expect(screen).toContain(action);
    }
    expect(screen).toContain('title="Clear search" tone="secondary" disabled={!history.tagSearchActive}');
    expect(screen).toContain('title="Copy seed" tone="secondary" onPress={() => {');
    expect(screen).toContain('disabled={otherCount === 0 || history.pendingOtherScores !== null}');
    expect(screen).toContain('disabled={pendingRequest !== null}');
    expect(screen).toContain('lobbyRuntime.searchTag(tagInput)');
    expect(screen).toContain('lobbyRuntime.loadOtherScores(item.id, showingFriends)');
  });
});
