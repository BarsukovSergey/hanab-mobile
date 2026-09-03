import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GameState } from '../../game/bootstrap/types';
import { getCardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import {
  getDisplayedClueTokens, getDisplayedClockString, getGameTableSuits,
  getGameplayClueChoicesForPlayer, hasClueTokenForVariant,
} from '../../game/selectors/gameplay';
import { isQuickRematchEligible, isRestartToPregameEligible } from '../../runtime/LobbyRuntime';
import { lobbyRuntime } from '../../runtime/application';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { roomActions } from '../../store/roomSlice';
import {
  ActionButton, Field, Notice, Panel, Pill, SectionHeading,
  useHanabTheme, useResponsiveLayout,
} from '../designSystem';
import { CardKnowledgeDetails, GameCard, VisibleHanabiCard } from './GameCard';

const END: Record<number, string> = {
  0: 'In progress', 1: 'Normal completion', 2: 'Strikeout', 3: 'Timeout',
  4: 'Terminated by player', 5: 'Speedrun failed', 6: 'Idle timeout',
  7: 'Character softlock', 8: 'All or Nothing failed',
  9: 'All or Nothing softlock', 10: 'Terminated by vote',
};

export function GameScreen() {
  const { theme } = useHanabTheme();
  const { wide } = useResponsiveLayout();
  const dispatch = useAppDispatch();
  const sessionPhase = useAppSelector((state) => state.session.phase);
  const roomState = useAppSelector((state) => state.room);
  const lobbyUsers = useAppSelector((state) => state.lobby.users.entities);
  const liveRoom = roomState.room.kind === 'live_game' ? roomState.room : null;
  const clientState = liveRoom?.clientState ?? null;
  const game = clientState?.visibleState ?? null;
  const playerRoom = liveRoom?.role === 'player' && clientState?.playing ? liveRoom : null;
  const ourIndex = playerRoom?.clientState.metadata.ourPlayerIndex ?? null;
  const ourHand = ourIndex === null ? [] : game?.hands[ourIndex] ?? [];
  const selectable = clientState?.finished || liveRoom?.role === 'spectator'
    ? game?.hands.flatMap((hand) => hand) ?? [] : ourHand;
  const clueTargets = playerRoom?.clientState.metadata.playerNames
    .map((_, i) => i).filter((i) => i !== ourIndex) ?? [];
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    if (selectable.length === 0) setSelectedCard(null);
    else if (selectedCard === null || !selectable.some((order) => order === selectedCard)) setSelectedCard(selectable[0] ?? null);
  }, [selectable, selectedCard]);
  useEffect(() => {
    if (selectedTarget === null || !clueTargets.includes(selectedTarget)) setSelectedTarget(clueTargets[0] ?? null);
  }, [clueTargets, selectedTarget]);
  const authoritativeNote = selectedCard === null ? '' : clientState?.notes.ourNotes[selectedCard]?.text ?? '';
  useEffect(() => setNote(authoritativeNote), [authoritativeNote, selectedCard]);
  const timed = clientState?.metadata.options.timed === true && !clientState.finished
    && !clientState.replay.active && clientState.ongoingGame.turn.currentPlayerIndex !== null
    && !liveRoom?.sharedReplay;
  useEffect(() => {
    if (!timed || clientState?.pause.active || liveRoom?.clock === null) return undefined;
    setClockNow(Date.now());
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [timed, clientState?.pause.active, liveRoom?.clock?.receivedAtMs]);

  if (liveRoom === null || clientState === null || game === null) return null;
  const { metadata, replay, ongoingGame } = clientState;
  const latest = ongoingGame.turn.segment ?? 0;
  const segment = replay.active ? replay.segment : latest;
  const segments = replay.states.flatMap((state, i) => state === undefined ? [] : [i]);
  const shared = replay.shared;
  const review = (
    <Panel>
      <View style={styles.between}>
        <SectionHeading title={`${replay.active ? 'Review' : 'Live'} · ${segment}/${latest}`} detail={`Turn ${game.turn.turnNum}`} />
        {replay.active && <Pill active>Review</Pill>}
      </View>
      <View style={styles.buttons}>
        <ActionButton compact disabled={segments.length === 0 || segment === 0} title="First"
          onPress={() => lobbyRuntime.navigateReplaySegment(segments[0] ?? 0)} />
        <ActionButton compact disabled={segments.length === 0 || segment <= 0} title="Previous" onPress={() => {
          const prev = [...segments].reverse().find((value) => value < segment);
          if (prev !== undefined) lobbyRuntime.navigateReplaySegment(prev);
        }} />
        <ActionButton compact disabled={!replay.active || segment >= latest} title="Next" onPress={() => {
          const next = segments.find((value) => value > segment);
          if (next !== undefined) lobbyRuntime.navigateReplaySegment(next);
        }} />
        <ActionButton compact disabled={!replay.active || (shared !== null && segment >= latest)}
          title={shared === null ? 'Latest live' : 'Last'} onPress={() => {
            if (shared !== null) lobbyRuntime.navigateReplaySegment(latest);
            else dispatch(roomActions.reviewSegmentSelected({ tableID: liveRoom.tableID, gameLoadEpoch: liveRoom.gameLoadEpoch, segment: null }));
          }} />
      </View>
      {shared !== null && <View style={styles.details}>
        <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Leader: {shared.leader}</Text>
        <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
          {shared.amLeader ? 'You control the shared segment.' : shared.useSharedSegments
            ? `Following shared segment ${shared.segment}.` : `Viewing locally; shared segment is ${shared.segment}.`}
        </Text>
        {!shared.amLeader && !shared.useSharedSegments && <ActionButton compact title="Follow leader" onPress={() => lobbyRuntime.followReplayLeader()} />}
      </View>}
    </Panel>
  );

  if (clientState.finished) {
    const history = liveRoom.gameHistory;
    const gameOver = [...replay.actions].reverse().find((action) => action.type === 'gameOver');
    const times = [...replay.actions].reverse().find((action) => action.type === 'playerTimes');
    const end = history?.endCondition ?? (gameOver?.type === 'gameOver' ? gameOver.endCondition : 0);
    const duration = durationBetween(clientState.datetimeStarted ?? '', clientState.datetimeFinished ?? '');
    const canQuick = sessionPhase === 'ready' && isQuickRematchEligible(clientState, roomState.pendingRestartTableID);
    const canRemake = sessionPhase === 'ready' && isRestartToPregameEligible(clientState, roomState.pendingRestartTableID);
    const summary = <View style={styles.column}>
      <Panel style={styles.gameOver}>
        <Text style={[styles.gameOverText, { color: theme.colors.danger }]}>GAME OVER</Text>
        <Text style={[styles.finalScore, { color: theme.colors.text }]}>{ongoingGame.score}</Text>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>FINAL SCORE</Text>
        <View style={styles.stats}><Stat label="Strikes" value={ongoingGame.strikes.length} />
          <Stat label="Clues" value={getDisplayedClueTokens(ongoingGame.clueTokens, metadata.options.variantName)} />
          <Stat label="Deck" value={ongoingGame.cardsRemainingInTheDeck} /></View>
      </Panel>
      <Panel><SectionHeading title="Result" detail={END[end] ?? `End condition ${end}`} />
        <Text style={[styles.body, { color: theme.colors.text }]}>Players: {metadata.playerNames.join(', ')}</Text>
        <Text style={[styles.body, { color: theme.colors.text }]}>Turns: {history?.numTurns ?? ongoingGame.turn.turnNum}</Text>
        {replay.databaseID !== null && <Text style={[styles.body, { color: theme.colors.text }]}>Game ID: {replay.databaseID}</Text>}
        <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Seed: {metadata.seed}</Text>
        {times?.type === 'playerTimes' ? <View style={styles.details}>
          <Text style={[styles.body, { color: theme.colors.text }]}>Duration: {formatMs(times.duration)}</Text>
          {times.playerTimes.map((time, i) => <Text key={metadata.playerNames[i] ?? i} style={[styles.muted, { color: theme.colors.textMuted }]}>
            {metadata.playerNames[i] ?? `Player ${i + 1}`}: {formatMs(time)}</Text>)}
        </View> : duration !== null && <Text style={[styles.body, { color: theme.colors.text }]}>Duration: {formatMs(duration)}</Text>}
      </Panel>
      {shared !== null && <Panel><SectionHeading title="Shared replay" detail={`${clientState.spectators.length} active spectators`} />
        {clientState.spectators.map((spectator) => <Text key={spectator.name} style={[styles.muted, { color: theme.colors.textMuted }]}>
          {spectator.name}{spectator.shadowingPlayerUsername === '' ? '' : ` · viewing as ${spectator.shadowingPlayerUsername}`}</Text>)}
        {shared.amLeader && <View style={styles.buttons}>
          <ActionButton compact disabled={!canQuick} title={roomState.pendingRestartTableID === null ? 'Quick rematch' : 'Starting…'} tone="primary" onPress={() => lobbyRuntime.quickRematch()} />
          <ActionButton compact disabled={!canRemake} title={roomState.pendingRestartTableID === null ? 'Remake table' : 'Remaking…'} onPress={() => lobbyRuntime.restartToPregame()} />
        </View>}
      </Panel>}
    </View>;
    const replayView = <View style={styles.column}>{review}
      <TablePanel game={game} variantName={metadata.options.variantName} title="Replay table" />
      <ReplayHands game={game} playerNames={metadata.playerNames} variantName={metadata.options.variantName} />
      <ReadOnlyNotes notes={clientState.notes.allNotes} />
      <GameLog entries={ongoingGame.log} title="Full game log" />
    </View>;
    return <View style={[styles.screen, wide && styles.wide]}>{summary}{replayView}</View>;
  }

  const isOurTurn = playerRoom !== null && game.turn.currentPlayerIndex === ourIndex;
  const enabled = sessionPhase === 'ready' && isOurTurn && !replay.active
    && !clientState.pause.active && roomState.pendingGameplayAction === null;
  const clueChoices = playerRoom === null ? null : getGameplayClueChoicesForPlayer(playerRoom.clientState.metadata);
  const currentIndex = game.turn.currentPlayerIndex;
  const currentName = currentIndex === null ? 'No current player' : metadata.playerNames[currentIndex] ?? `Player ${currentIndex + 1}`;
  const pending = roomState.pendingGameplayAction?.action ?? null;
  const pendingText = pending === null ? null : ['Playing card', 'Discarding card', 'Giving color clue', 'Giving rank clue'][pending.type];
  const visiblePlayers = metadata.playerNames.map((_, i) => i).filter((i) => playerRoom === null || i !== ourIndex);
  const cardEnabled = enabled && selectedCard !== null;
  const clueEnabled = enabled && hasClueTokenForVariant(game.clueTokens, metadata.options.variantName) && selectedTarget !== null;
  const notesEditable = sessionPhase === 'ready' && !replay.active && !liveRoom.sharedReplay && selectedCard !== null;
  const combinedNotes = selectedCard === null ? [] : clientState.notes.allNotes[selectedCard]?.filter((n) => n.text.trim().length > 0) ?? [];
  const clock = (i: number) => liveRoom.clock === null ? null : getDisplayedClockString(liveRoom.clock, i, clientState.pause.active, clockNow);
  const pauseLabel = clientState.pause.active ? 'Unpause' : isOurTurn ? 'Pause' : clientState.pause.queued ? 'Cancel queued pause' : 'Queue pause';

  const board = <View style={styles.column}>
    <Panel><View style={styles.between}><View style={styles.grow}>
      <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>TURN {game.turn.turnNum}</Text>
      <Text style={[styles.heading, { color: theme.colors.text }]}>{currentName}</Text>
      <Text style={[styles.muted, { color: theme.colors.textMuted }]}>{replay.active ? 'Reviewing an earlier segment' : playerRoom === null ? 'Spectating' : isOurTurn ? 'Your turn' : 'Waiting for another player'}</Text>
    </View><View style={styles.score}><Text style={[styles.scoreValue, { color: theme.colors.text }]}>{game.score}</Text><Text style={[styles.label, { color: theme.colors.textMuted }]}>SCORE</Text></View></View>
      <View style={styles.stats}><Stat label="Clues" value={getDisplayedClueTokens(game.clueTokens, metadata.options.variantName)} />
        <Stat label="Strikes" value={game.strikes.length} /><Stat label="Deck" value={game.cardsRemainingInTheDeck} /></View>
      {timed && clientState.pause.active && <Notice tone="error">Game paused</Notice>}
      {timed && playerRoom !== null && sessionPhase === 'ready' && <ActionButton compact title={pauseLabel} onPress={() => lobbyRuntime.pauseGame()} />}
    </Panel>
    <TablePanel game={game} variantName={metadata.options.variantName} title="Table" />
    {pendingText !== null && <Notice>{pendingText}… awaiting server</Notice>}
    {playerRoom !== null && <Panel><View style={styles.between}><SectionHeading title="Your hand" detail="Tap a card to select it. Its identity stays hidden." />
      <View style={styles.buttons}>{timed && clock(metadata.ourPlayerIndex) !== null && <Text style={[styles.clock, { color: theme.colors.text }]}>{clock(metadata.ourPlayerIndex)}</Text>}
        <Pill>{presence(liveRoom.connected?.[metadata.ourPlayerIndex], Object.values(lobbyUsers).find((u) => u?.name === metadata.playerNames[metadata.ourPlayerIndex])?.inactive ?? false)}</Pill></View></View>
      <View style={styles.hand}>{ourHand.map((order, position) => {
        const card = game.deck[order]; if (card === undefined) return <Text key={order}>Card unavailable</Text>;
        return <GameCard key={order} knowledge={getCardKnowledgeViewModel(metadata.options.variantName, card)} position={position}
          selected={selectedCard === order} variantName={metadata.options.variantName} onSelect={() => setSelectedCard(order)} />;
      })}</View>
      <View style={[styles.action, { backgroundColor: theme.colors.surfaceMuted }]}><Text style={[styles.panelTitle, { color: theme.colors.text }]}>
        {selectedCard === null ? 'Select a card' : `Card ${ourHand.findIndex((order) => order === selectedCard) + 1} selected`}</Text>
        <Text style={[styles.muted, { color: theme.colors.textMuted }]}>{!isOurTurn ? 'Actions unlock on your turn.' : pendingText ?? 'Choose Play or Discard.'}</Text>
        <View style={styles.buttons}><ActionButton disabled={!cardEnabled} title="Play selected" tone="primary" onPress={() => { if (selectedCard !== null) lobbyRuntime.play(selectedCard); }} />
          <ActionButton disabled={!cardEnabled} title="Discard selected" onPress={() => { if (selectedCard !== null) lobbyRuntime.discard(selectedCard); }} /></View></View>
    </Panel>}
    <Panel><SectionHeading title={playerRoom === null ? 'Players' : 'Other players'} detail="Visible cards follow hanab.live suit fills and proportions." />
      <View style={styles.players}>{visiblePlayers.map((i) => {
        const target = selectedTarget === i;
        return <Pressable key={i} disabled={playerRoom === null} onPress={() => setSelectedTarget(i)}
          accessibilityRole={playerRoom === null ? undefined : 'button'} accessibilityState={playerRoom === null ? undefined : { selected: target }}
          style={[styles.player, { backgroundColor: theme.colors.surfaceMuted, borderColor: target ? theme.colors.accent : theme.colors.border }, target && styles.target]}>
          <View style={styles.between}><View style={styles.grow}><Text style={[styles.playerName, { color: theme.colors.text }]}>{metadata.playerNames[i]}</Text>
            <Text style={[styles.muted, { color: theme.colors.textMuted }]}>{presence(liveRoom.connected?.[i], Object.values(lobbyUsers).find((u) => u?.name === metadata.playerNames[i])?.inactive ?? false)}</Text></View>
            <View style={styles.buttons}>{timed && clock(i) !== null && <Text style={[styles.clock, { color: theme.colors.text }]}>{clock(i)}</Text>}{target && <Pill active>Clue target</Pill>}</View></View>
          <View style={styles.hand}>{game.hands[i]?.map((order, position) => { const card = game.deck[order]; return <VisibleHanabiCard key={order}
            onPress={liveRoom.role === 'spectator' && !replay.active ? () => setSelectedCard(order) : undefined} position={position}
            rank={card?.rank ?? null} selected={liveRoom.role === 'spectator' && selectedCard === order} suitIndex={card?.suitIndex ?? null}
            variantName={metadata.options.variantName} />; })}</View>
        </Pressable>;
      })}</View>
    </Panel>
  </View>;

  const side = <View style={[styles.column, wide && styles.side]}>{review}
    <Panel><SectionHeading title="Selected card note" detail={selectedCard === null ? 'Select a card first.' : 'Private card note synced to the server.'} />
      <Field editable={notesEditable} maxLength={300} multiline onChangeText={setNote} placeholder={selectedCard === null ? 'Select a card' : 'Add a note'} style={styles.note} value={note} />
      {liveRoom.role === 'spectator' && combinedNotes.length > 0 && <View style={styles.details}>{combinedNotes.map((n, i) => <Text key={`${n.name}-${i}`} style={[styles.muted, { color: theme.colors.textMuted }]}>{n.name}: {n.text}</Text>)}</View>}
      <View style={styles.buttons}><ActionButton compact disabled={!notesEditable || note.length > 300} title="Save" tone="primary" onPress={() => { if (selectedCard !== null) lobbyRuntime.editNote(selectedCard, note); }} />
        <ActionButton compact disabled={!notesEditable} title="Clear" onPress={() => { if (selectedCard !== null && lobbyRuntime.editNote(selectedCard, '')) setNote(''); }} /></View>
    </Panel>
    {playerRoom !== null && <Panel><SectionHeading title={`Clue${selectedTarget === null ? '' : ` to ${metadata.playerNames[selectedTarget]}`}`}
      detail={!hasClueTokenForVariant(game.clueTokens, metadata.options.variantName) ? 'No clue tokens available.' : 'Choose a color or rank.'} />
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>COLOR</Text><View style={styles.buttons}>{clueChoices?.colors.map((c) => <ActionButton compact disabled={!clueEnabled} key={c.value} title={c.label} onPress={() => { if (selectedTarget !== null) lobbyRuntime.colorClue(selectedTarget, c.value); }} />)}</View>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>RANK</Text><View style={styles.buttons}>{clueChoices?.ranks.map((c) => <ActionButton compact disabled={!clueEnabled} key={c.value} title={c.label} onPress={() => { if (selectedTarget !== null) lobbyRuntime.rankClue(selectedTarget, c.value); }} />)}</View>
    </Panel>}
    <GameLog entries={game.log} title="Game log" />
  </View>;
  return <View style={[styles.screen, wide && styles.wide]}>{board}{side}</View>;
}

function TablePanel({ game, variantName, title }: { game: GameState; variantName: string; title: string }) {
  const { theme } = useHanabTheme();
  const suits = getGameTableSuits(variantName, game);
  return <Panel><SectionHeading title={title} detail={variantName} /><View style={styles.stacks}>{suits.map((s) => <View key={s.suitIndex}
    style={[styles.stack, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
    <Text style={[styles.label, { color: theme.colors.textMuted }]}>{s.suitName}</Text><Text style={[styles.stackTop, { color: theme.colors.text }]}>{s.topCardLabel ?? 'Empty'}</Text>
    <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Discards: {s.discardCardLabels.length === 0 ? '—' : s.discardCardLabels.join(', ')}</Text></View>)}</View></Panel>;
}

function ReplayHands({ game, playerNames, variantName }: { game: GameState; playerNames: readonly string[]; variantName: string }) {
  const { theme } = useHanabTheme();
  return <Panel><SectionHeading title="Replay hands" /><View style={styles.players}>{playerNames.map((name, i) => <View key={name}
    style={[styles.player, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}><Text style={[styles.playerName, { color: theme.colors.text }]}>{name}</Text>
    <View style={styles.hand}>{game.hands[i]?.map((order, position) => { const card = game.deck[order]; const knowledge = card === undefined ? null : getCardKnowledgeViewModel(variantName, card);
      return <View key={order} style={styles.replayCard}><VisibleHanabiCard position={position} rank={card?.rank ?? null} suitIndex={card?.suitIndex ?? null} variantName={variantName} />
        {knowledge !== null && <CardKnowledgeDetails knowledge={knowledge} variantName={variantName} />}</View>; })}</View></View>)}</View></Panel>;
}

function ReadOnlyNotes({ notes }: { notes: ReadonlyArray<readonly { name: string; text: string; isSpectator: boolean }[]> }) {
  const { theme } = useHanabTheme();
  const entries = notes.flatMap((cardNotes, order) => { const nonEmpty = cardNotes.filter((n) => n.text.trim().length > 0); return nonEmpty.length === 0 ? [] : [{ order, notes: nonEmpty }]; });
  if (entries.length === 0) return null;
  return <Panel><SectionHeading title="Card notes" />{entries.map((entry) => <View key={entry.order} style={styles.details}><Text style={[styles.label, { color: theme.colors.textMuted }]}>CARD ORDER {entry.order}</Text>
    {entry.notes.map((n, i) => <Text key={`${n.name}-${i}`} style={[styles.muted, { color: theme.colors.textMuted }]}>{n.name}: {n.text}</Text>)}</View>)}</Panel>;
}

function GameLog({ entries, title }: { entries: readonly { turn: number; text: string }[]; title: string }) {
  const { theme } = useHanabTheme();
  return <Panel><SectionHeading title={title} /><View style={styles.log}>{entries.map((entry, i) => <Text key={`${entry.turn}-${i}`} style={[styles.muted, { color: theme.colors.textMuted }]}>{entry.text}</Text>)}</View></Panel>;
}
function presence(connected: boolean | undefined, inactive: boolean) { return connected === false ? 'disconnected' : inactive ? 'away' : 'online'; }
function formatMs(value: number) { const seconds = Math.max(0, Math.round(value / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function durationBetween(started: string, finished: string) { const start = Date.parse(started); const end = Date.parse(finished); return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null; }
function Stat({ label, value }: { label: string; value: number }) { const { theme } = useHanabTheme(); return <View style={[styles.stat, { backgroundColor: theme.colors.surfaceMuted }]}><Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text><Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text></View>; }

const styles = StyleSheet.create({
  screen: { gap: 14, paddingBottom: 10 }, wide: { alignItems: 'flex-start', flexDirection: 'row' },
  column: { flex: 1, gap: 14, minWidth: 0 }, side: { flex: 0.72 }, grow: { flex: 1, minWidth: 0 },
  between: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  buttons: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, details: { gap: 4 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, heading: { fontSize: 25, fontWeight: '900' },
  muted: { fontSize: 12, lineHeight: 17 }, body: { fontSize: 14, lineHeight: 20 }, panelTitle: { fontSize: 15, fontWeight: '800' },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  score: { alignItems: 'center', minWidth: 64 }, scoreValue: { fontSize: 30, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8, width: '100%' }, stat: { alignItems: 'center', borderRadius: 10, flex: 1, padding: 9 }, statValue: { fontSize: 20, fontWeight: '900' },
  gameOver: { alignItems: 'center' }, gameOverText: { fontSize: 24, fontWeight: '900', letterSpacing: 1.2 }, finalScore: { fontSize: 48, fontWeight: '900', lineHeight: 52 },
  stacks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stack: { borderRadius: 10, borderWidth: 1, flexGrow: 1, gap: 3, minWidth: 120, padding: 10 }, stackTop: { fontSize: 16, fontWeight: '900' },
  hand: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, action: { borderRadius: 12, gap: 7, padding: 11 },
  players: { gap: 9 }, player: { borderRadius: 12, borderWidth: 1, gap: 10, padding: 10 }, target: { borderWidth: 2, padding: 9 }, playerName: { fontSize: 15, fontWeight: '900' },
  clock: { fontVariant: ['tabular-nums'], fontSize: 14, fontWeight: '900' }, note: { minHeight: 82, textAlignVertical: 'top' },
  log: { gap: 6 }, replayCard: { gap: 5, width: 92 },
});
