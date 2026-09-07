import { useEffect, useMemo, useReducer, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { CardIdentity, CardNote, GameState } from '../../game/bootstrap/types';
import { getCardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import { getCluePreview } from '../../game/selectors/cluePreview';
import {
  getDisplayedClueTokens,
  getDisplayedClockString,
  getDisplayedLiveFutureEfficiency,
  getGameplayCardsPerHand,
  getGameTableSuits,
  getGameplayClueChoicesForPlayer,
  hasClueTokenForVariant,
  type LiveClock,
} from '../../game/selectors/gameplay';
import { getLastCluePresentation } from '../../game/selectors/lastClue';
import { isQuickRematchEligible, isRestartToPregameEligible } from '../../runtime/LobbyRuntime';
import { lobbyRuntime } from '../../runtime/application';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { roomActions } from '../../store/roomSlice';
import { ActionButton, Notice, Panel, Pill, SectionHeading, useHanabTheme, useResponsiveLayout } from '../designSystem';
import { C17RewindScrubber } from './C17RewindScrubber';
import { ClueComposer } from './ClueComposer';
import { CompactTable } from './CompactTable';
import { DiscardViewer } from './DiscardViewer';
import { CardKnowledgeDetails, GameCard, VisibleHanabiCard } from './GameCard';
import { NoteEditor } from './NoteEditor';
import { getCommittedClueMarkerForMetadata } from './clueIndication';
import {
  gameplayInteractionReducer,
  initialGameplayInteractionState,
} from './gameplayInteraction';
import { getGameplayLayout } from './gameplayLayout';
import { getC17DenseLayout, getRelativeOpponentIndices } from './c17DenseLayout';
import {
  countC17TemporalStatesAfter,
  getC17TemporalContext,
  getHumanTurnNumber,
  type C17TemporalEntry,
} from './c17Temporal';
import { isC17WorkspaceEligible } from './c17Workspace';
import { getDisplayedHandOrders } from './gamePresentation';
import { getLiveNoteOrders } from './liveNoteOrders';

const END: Record<number, string> = {
  0: 'In progress', 1: 'Normal completion', 2: 'Strikeout', 3: 'Timeout',
  4: 'Terminated by player', 5: 'Speedrun failed', 6: 'Idle timeout',
  7: 'Character softlock', 8: 'All or Nothing failed',
  9: 'All or Nothing softlock', 10: 'Terminated by vote',
};

type NoteEntry = { name: string; text: string; isSpectator: boolean };
type C17ReviewSelection = {
  actionSegment: number;
  liveSegmentAtEntry: number;
};

export function GameScreen() {
  const { theme } = useHanabTheme();
  const { wide, width, height } = useResponsiveLayout();
  const dispatch = useAppDispatch();
  const sessionPhase = useAppSelector((state) => state.session.phase);
  const roomState = useAppSelector((state) => state.room);
  const lobbyUsers = useAppSelector((state) => state.lobby.users.entities);
  const liveRoom = roomState.room.kind === 'live_game' ? roomState.room : null;
  const clientState = liveRoom?.clientState ?? null;
  const game = clientState?.visibleState ?? null;
  const playerRoom = liveRoom?.role === 'player' && clientState?.playing ? liveRoom : null;
  const ourIndex = playerRoom?.clientState.metadata.ourPlayerIndex ?? null;
  const ourHand = useMemo(() => ourIndex === null ? [] : game?.hands[ourIndex] ?? [], [game, ourIndex]);
  const displayedOurHand = useMemo(() => getDisplayedHandOrders(ourHand), [ourHand]);
  const clueTargets = useMemo(() => playerRoom?.clientState.metadata.playerNames
    .map((_, i) => i).filter((i) => i !== ourIndex) ?? [], [ourIndex, playerRoom]);
  const [interaction, interactionDispatch] = useReducer(gameplayInteractionReducer, initialGameplayInteractionState);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [discardViewerOpen, setDiscardViewerOpen] = useState(false);
  const [note, setNote] = useState('');
  const [c17Review, setC17Review] = useState<C17ReviewSelection | null>(null);
  const selectedCard = interaction.selectedCard;
  const selectedTarget = interaction.clueTarget;
  const noteCard = interaction.noteCard;
  const replayActive = clientState?.replay.active ?? false;

  const liveNoteOrders = useMemo(() => getLiveNoteOrders(game), [game]);
  useEffect(() => {
    interactionDispatch({
      type: 'sync-hands',
      ownOrders: ourHand,
      clueTargets,
      visibleOrders: liveNoteOrders,
    });
  }, [clueTargets, liveNoteOrders, ourHand]);
  useEffect(() => {
    if (noteCard === null) setNoteEditorOpen(false);
  }, [noteCard]);
  useEffect(() => {
    interactionDispatch({ type: 'disarm-gameplay' });
    if (!replayActive) setC17Review(null);
  }, [replayActive]);

  const gameplayLayout = useMemo(() => getGameplayLayout({
    viewportWidth: width,
    viewportHeight: height,
    handSizes: game?.hands.map((hand) => hand.length) ?? [],
    ourPlayerIndex: ourIndex,
  }), [game, height, ourIndex, width]);

  useEffect(() => {
    interactionDispatch({ type: 'reset-lifecycle-transients' });
    setDiscardViewerOpen(false);
  }, [gameplayLayout.orientation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      interactionDispatch({ type: 'reset-lifecycle-transients' });
      setDiscardViewerOpen(false);
    });
    return () => subscription.remove();
  }, []);

  const authoritativeNote = noteCard === null ? '' : clientState?.notes.ourNotes[noteCard]?.text ?? '';
  useEffect(() => {
    if (!noteEditorOpen) setNote(authoritativeNote);
  }, [authoritativeNote, noteCard, noteEditorOpen]);

  if (liveRoom === null || clientState === null || game === null) return null;
  const { metadata, replay, ongoingGame } = clientState;
  const timed = metadata.options.timed === true && !clientState.finished
    && !replay.active && ongoingGame.turn.currentPlayerIndex !== null && !liveRoom.sharedReplay;
  const latest = ongoingGame.turn.segment ?? 0;
  const segment = replay.active ? replay.segment : latest;
  const segments = replay.states.flatMap((state, i) => state === undefined ? [] : [i]);
  const shared = replay.shared;
  const disarmGameplay = () => interactionDispatch({ type: 'disarm-gameplay' });
  const hasCardNote = (order: number) => {
    if (clientState.finished || liveRoom.role === 'spectator') {
      return clientState.notes.allNotes[order]?.some((entry) => entry.text.trim().length > 0) ?? false;
    }
    return (clientState.notes.ourNotes[order]?.text.trim().length ?? 0) > 0;
  };
  const review = <Panel>
    <View style={styles.between}>
      <SectionHeading title={`${replay.active ? 'Review' : 'Live'} · ${segment}/${latest}`} detail={`Turn ${getHumanTurnNumber(game.turn.turnNum)}`} />
      {replay.active && <Pill active>Review</Pill>}
    </View>
    <View style={styles.buttons}>
      <ActionButton compact disabled={segments.length === 0 || segment === 0} title="First" onPress={() => lobbyRuntime.navigateReplaySegment(segments[0] ?? 0)} />
      <ActionButton compact disabled={segments.length === 0 || segment <= 0} title="Previous" onPress={() => {
        const prev = [...segments].reverse().find((value) => value < segment);
        if (prev !== undefined) lobbyRuntime.navigateReplaySegment(prev);
      }} />
      <ActionButton compact disabled={!replay.active || segment >= latest} title="Next" onPress={() => {
        const next = segments.find((value) => value > segment);
        if (next !== undefined) lobbyRuntime.navigateReplaySegment(next);
      }} />
      <ActionButton compact disabled={!replay.active || (shared !== null && segment >= latest)} title={shared === null ? 'Latest live' : 'Last'} onPress={() => {
        disarmGameplay();
        if (shared !== null) lobbyRuntime.navigateReplaySegment(latest);
        else dispatch(roomActions.reviewSegmentSelected({ tableID: liveRoom.tableID, gameLoadEpoch: liveRoom.gameLoadEpoch, segment: null }));
      }} />
    </View>
    {shared !== null && <View style={styles.details}>
      <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Leader: {shared.leader}</Text>
      <Text style={[styles.muted, { color: theme.colors.textMuted }]}>{shared.amLeader ? 'You control the shared segment.' : shared.useSharedSegments
        ? `Following shared segment ${shared.segment}.` : `Viewing locally; shared segment is ${shared.segment}.`}</Text>
      {!shared.amLeader && !shared.useSharedSegments && <ActionButton compact title="Follow leader" onPress={() => lobbyRuntime.followReplayLeader()} />}
    </View>}
  </Panel>;

  if (clientState.finished) {
    const history = liveRoom.gameHistory;
    const gameOver = [...replay.actions].reverse().find((action) => action.type === 'gameOver');
    const times = [...replay.actions].reverse().find((action) => action.type === 'playerTimes');
    const end = history?.endCondition ?? (gameOver?.type === 'gameOver' ? gameOver.endCondition : 0);
    const duration = durationBetween(clientState.datetimeStarted ?? '', clientState.datetimeFinished ?? '');
    const canQuick = sessionPhase === 'ready' && isQuickRematchEligible(clientState, roomState.pendingRestartTableID);
    const canRemake = sessionPhase === 'ready' && isRestartToPregameEligible(clientState, roomState.pendingRestartTableID);
    const selectedReplayNotes = noteCard === null ? [] : clientState.notes.allNotes[noteCard]?.filter((entry) => entry.text.trim().length > 0) ?? [];
    const openReplayNote = (order: number) => {
      interactionDispatch({ type: 'open-note', order });
      setNoteEditorOpen(true);
    };
    const selectedReplayLabel = noteCard === null
      ? 'Card notes'
      : getCardLocationLabel(game, metadata.playerNames, metadata.options.variantName, noteCard);
    return <>
      <View style={[styles.finishedScreen, wide && styles.wide]}>
        <View style={styles.column}>
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
              {times.playerTimes.map((time, i) => <Text key={metadata.playerNames[i] ?? i} style={[styles.muted, { color: theme.colors.textMuted }]}>{metadata.playerNames[i] ?? `Player ${i + 1}`}: {formatMs(time)}</Text>)}
            </View> : duration !== null && <Text style={[styles.body, { color: theme.colors.textMuted }]}>Duration: {formatMs(duration)}</Text>}
          </Panel>
          {shared !== null && <Panel><SectionHeading title="Shared replay" detail={`${clientState.spectators.length} active spectators`} />
            {shared.amLeader && <View style={styles.buttons}>
              <ActionButton compact disabled={!canQuick} title={roomState.pendingRestartTableID === null ? 'Quick rematch' : 'Starting…'} tone="primary" onPress={() => lobbyRuntime.quickRematch()} />
              <ActionButton compact disabled={!canRemake} title={roomState.pendingRestartTableID === null ? 'Remake table' : 'Remaking…'} onPress={() => lobbyRuntime.restartToPregame()} />
            </View>}
          </Panel>}
        </View>
        <View style={styles.column}>{review}
          <ReplayTable game={game} variantName={metadata.options.variantName} />
          <ReplayHands game={game} notes={clientState.notes.allNotes} onOpenNote={openReplayNote} playerNames={metadata.playerNames} variantName={metadata.options.variantName} />
          <GameLog entries={ongoingGame.log} title="Full game log" />
        </View>
      </View>
      <NoteEditor
        editable={false}
        onChange={setNote}
        onClear={() => undefined}
        onClose={() => setNoteEditorOpen(false)}
        onSave={() => undefined}
        title={selectedReplayLabel}
        value={selectedReplayNotes.map((entry) => `${entry.name}: ${entry.text}`).join('\n')}
        visible={noteEditorOpen}
      />
    </>;
  }

  const isOurTurn = playerRoom !== null && game.turn.currentPlayerIndex === ourIndex;
  const enabled = sessionPhase === 'ready' && isOurTurn && !replay.active && !clientState.pause.active && roomState.pendingGameplayAction === null;
  const clueChoices = playerRoom === null ? null : getGameplayClueChoicesForPlayer(playerRoom.clientState.metadata);
  const lastClue = getLastCluePresentation(replay.actions);
  const currentIndex = game.turn.currentPlayerIndex;
  const currentName = currentIndex === null ? 'No current player' : metadata.playerNames[currentIndex] ?? `Player ${currentIndex + 1}`;
  const pending = roomState.pendingGameplayAction?.action ?? null;
  const pendingText = pending === null ? null : ['Playing card', 'Discarding card', 'Giving color clue', 'Giving rank clue'][pending.type];
  const visiblePlayers = metadata.playerNames.map((_, i) => i).filter((i) => playerRoom === null || i !== ourIndex);
  const cardEnabled = enabled && selectedCard !== null && ourHand.some((order) => order === selectedCard);
  const clueEnabled = enabled && hasClueTokenForVariant(game.clueTokens, metadata.options.variantName) && selectedTarget !== null;
  const notesEditable = sessionPhase === 'ready' && !replay.active && !liveRoom.sharedReplay
    && noteCard !== null && liveNoteOrders.includes(noteCard);
  const noteCardLabel = noteCard === null ? 'Select a card first.' : getCardLocationLabel(game, metadata.playerNames, metadata.options.variantName, noteCard);
  const pauseLabel = clientState.pause.active ? 'Unpause' : isOurTurn ? 'Pause' : clientState.pause.queued ? 'Cancel queued pause' : 'Queue pause';
  const openNote = (order: number) => {
    setNote(clientState.notes.ourNotes[order]?.text ?? '');
    interactionDispatch({ type: 'open-note', order });
    setNoteEditorOpen(true);
  };
  const persistNote = (value: string) => noteCard !== null && lobbyRuntime.editNote(noteCard, value);
  const saveNote = (value: string) => {
    if (persistNote(value)) {
      setNote(value);
      setNoteEditorOpen(false);
    }
  };
  const clearNote = () => {
    if (persistNote('')) {
      setNote('');
      setNoteEditorOpen(false);
    }
  };
  const cluePreview = interaction.cluePreview === null || selectedTarget === null
    ? null
    : getCluePreview(
      game,
      metadata.options.variantName,
      selectedTarget,
      interaction.cluePreview.type,
      interaction.cluePreview.value,
    );
  const previewTouched = new Set(cluePreview?.touchedOrders ?? []);
  const targetName = selectedTarget === null ? null : metadata.playerNames[selectedTarget] ?? `Player ${selectedTarget + 1}`;
  const confirmClue = () => {
    if (selectedTarget === null || interaction.cluePreview === null) return;
    const sent = interaction.cluePreview.type === 'color'
      ? lobbyRuntime.colorClue(selectedTarget, interaction.cluePreview.value)
      : lobbyRuntime.rankClue(selectedTarget, interaction.cluePreview.value);
    if (sent) interactionDispatch({ type: 'select-clue-target', playerIndex: null });
  };

  const landscape = gameplayLayout.orientation === 'landscape';
  const c17DensePortrait = isC17WorkspaceEligible({
    isPlayer: playerRoom !== null,
    playerCount: metadata.playerNames.length,
    portrait: gameplayLayout.orientation === 'portrait',
    finished: clientState.finished,
    replayActive: replay.active,
  });

  if (c17DensePortrait && ourIndex !== null) {
    const futureEfficiency = getDisplayedLiveFutureEfficiency(game, clientState.notes.efficiencyModifier);
    const liveTemporal = getC17TemporalContext({
      states: replay.states,
      selectedSegment: latest,
      variantName: metadata.options.variantName,
    });
    const reviewTemporal = replay.active && c17Review !== null
      ? getC17TemporalContext({
        states: replay.states,
        selectedSegment: c17Review.actionSegment,
        variantName: metadata.options.variantName,
      })
      : liveTemporal;
    const newerActionCount = replay.active && c17Review !== null
      ? countC17TemporalStatesAfter(replay.states, c17Review.liveSegmentAtEntry)
      : 0;
    const recentTemporal = replay.active && c17Review !== null ? reviewTemporal : liveTemporal;
    const recentActions = [...recentTemporal.recent, recentTemporal.last]
      .filter((entry, index, entries) => entry.segment > 0
        && entries.findIndex((candidate) => candidate.segment === entry.segment) === index)
      .slice(-Math.max(5, metadata.playerNames.length));
    const actionSegments = replay.states
      .flatMap((state, stateSegment) => state === undefined ? [] : [stateSegment]);
    const firstActionSegment = actionSegments[0] ?? null;
    const lastActionSegment = actionSegments.at(-1) ?? null;
    const commitSelectedCard = (action: 'play' | 'discard') => {
      if (!cardEnabled || selectedCard === null) return;
      if (action === 'play') lobbyRuntime.play(selectedCard);
      else lobbyRuntime.discard(selectedCard);
    };
    const jumpToAction = (actionSegment: number) => {
      const temporal = getC17TemporalContext({
        states: replay.states,
        selectedSegment: actionSegment,
        variantName: metadata.options.variantName,
      });
      disarmGameplay();
      setC17Review({
        actionSegment: temporal.selectedSegment,
        liveSegmentAtEntry: c17Review?.liveSegmentAtEntry ?? latest,
      });
      lobbyRuntime.navigateReplaySegment(temporal.afterSegment);
    };
    const enterRewind = () => {
      const target = recentActions.at(-1)?.segment ?? lastActionSegment;
      if (target !== null) jumpToAction(target);
    };
    const navigateReviewAction = (direction: 'back' | 'forward') => {
      const target = direction === 'back'
        ? reviewTemporal.previousActionSegment
        : reviewTemporal.nextActionSegment;
      if (target !== null) jumpToAction(target);
    };
    const jumpReviewEdge = (edge: 'start' | 'end') => {
      const target = edge === 'start' ? firstActionSegment : lastActionSegment;
      if (target !== null) jumpToAction(target);
    };
    const returnLive = () => {
      if (!replay.active) return;
      disarmGameplay();
      setC17Review(null);
      if (shared !== null) lobbyRuntime.navigateReplaySegment(latest);
      else dispatch(roomActions.reviewSegmentSelected({
        tableID: liveRoom.tableID,
        gameLoadEpoch: liveRoom.gameLoadEpoch,
        segment: null,
      }));
    };
    return <>
      <C17DenseWorkspace
        actionSegments={actionSegments}
        canReviewForward={reviewTemporal.nextActionSegment !== null}
        canReviewBack={reviewTemporal.previousActionSegment !== null}
        cardIdentities={clientState.cardIdentities}
        cardsPerHand={getGameplayCardsPerHand(metadata)}
        canCommitCard={cardEnabled}
        empathyPlayer={interaction.empathyPlayer}
        futureEfficiency={futureEfficiency}
        game={game}
        globalEmpathy={interaction.globalEmpathy}
        historyAvailable={recentActions.length > 0}
        lastAction={reviewTemporal.last.summary}
        liveTurn={liveTemporal.liveTurn}
        metadata={metadata}
        newerActionCount={newerActionCount}
        notes={clientState.notes.ourNotes}
        onDiscard={() => commitSelectedCard('discard')}
        onEnterRewind={enterRewind}
        onOpenDiscards={() => setDiscardViewerOpen(true)}
        onOpenNote={openNote}
        onPlay={() => commitSelectedCard('play')}
        onReviewBack={() => navigateReviewAction('back')}
        onReviewEnd={() => jumpReviewEdge('end')}
        onReviewForward={() => navigateReviewAction('forward')}
        onReviewStart={() => jumpReviewEdge('start')}
        onReturnLive={returnLive}
        onScrubAction={jumpToAction}
        onSelectCard={(order) => {
          if (!replay.active) interactionDispatch({ type: 'select-card', order });
        }}
        onSelectRecentAction={jumpToAction}
        onToggleEmpathyPlayer={(playerIndex) => interactionDispatch({ type: 'toggle-empathy-player', playerIndex })}
        onToggleGlobalEmpathy={() => interactionDispatch({ type: 'toggle-global-empathy' })}
        ourIndex={ourIndex}
        pendingText={pendingText ?? null}
        recentActions={recentActions}
        reviewActive={replay.active}
        selectedActionSegment={reviewTemporal.selectedSegment}
        selectedCard={selectedCard}
        selectedTurn={reviewTemporal.selectedTurn}
        variantName={metadata.options.variantName}
      />
      <DiscardViewer game={game} onClose={() => setDiscardViewerOpen(false)} variantName={metadata.options.variantName} visible={discardViewerOpen} />
      <NoteEditor
        editable={notesEditable}
        onChange={setNote}
        onClear={clearNote}
        onClose={() => setNoteEditorOpen(false)}
        onSave={saveNote}
        title={noteCardLabel}
        value={note}
        visible={noteEditorOpen}
      />
    </>;
  }

  return <>
    <View style={[styles.liveScreen, landscape && styles.liveLandscape]}>
      <View style={[styles.mainLane, landscape && styles.mainLaneLandscape]}>
        <View style={[styles.hud, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.hudTurn}>
            <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>TURN {getHumanTurnNumber(game.turn.turnNum)}</Text>
            <Text numberOfLines={1} style={[styles.hudCurrent, { color: theme.colors.text }]}>{currentName}</Text>
          </View>
          <HudStat label="Score" value={game.score} />
          <HudStat label="Clues" value={getDisplayedClueTokens(game.clueTokens, metadata.options.variantName)} />
          <HudStat label="Strikes" value={game.strikes.length} />
          <HudStat label="Deck" value={game.cardsRemainingInTheDeck} />
          {timed && playerRoom !== null && <ActionButton compact title={pauseLabel} onPress={() => lobbyRuntime.pauseGame()} />}
        </View>
        {clientState.pause.active && <Notice tone="error">Game paused</Notice>}
        {pendingText !== null && <Notice>{pendingText}… awaiting server</Notice>}
        <CompactTable game={game} onOpenDiscards={() => setDiscardViewerOpen(true)} variantName={metadata.options.variantName} />
        {playerRoom !== null && <View style={[styles.handSurface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.handHeader}>
            <Text style={[styles.handTitle, { color: theme.colors.text }]}>Your hand</Text>
            <View style={styles.buttons}>
              {timed && liveRoom.clock !== null && <LiveClockText clock={liveRoom.clock} paused={clientState.pause.active} playerIndex={metadata.ourPlayerIndex} />}
              <Pill>{presence(liveRoom.connected?.[metadata.ourPlayerIndex], Object.values(lobbyUsers).find((user) => user?.name === metadata.playerNames[metadata.ourPlayerIndex])?.inactive ?? false)}</Pill>
            </View>
          </View>
          <View style={[styles.hand, { gap: gameplayLayout.cardGap }]}>
            {displayedOurHand.map((order, position) => {
              const card = game.deck[order];
              if (card === undefined) return null;
              return <GameCard
                clueMarker={getCommittedClueMarkerForMetadata(lastClue, order, card.numPositiveClues, metadata)}
                hasNote={hasCardNote(order)}
                height={gameplayLayout.ownCardHeight}
                key={order}
                knowledge={getCardKnowledgeViewModel(metadata.options.variantName, card, clientState.notes.ourNotes[order], false)}
                onLongPress={() => openNote(order)}
                onSelect={() => interactionDispatch({ type: 'select-card', order })}
                position={position}
                selected={selectedCard === order}
                variantName={metadata.options.variantName}
              />;
            })}
          </View>
          {selectedCard === null
            ? <Text style={[styles.selectHint, { color: theme.colors.textMuted }]}>Tap a card to play, discard, or note it.</Text>
            : <View style={[styles.actionBar, { backgroundColor: theme.colors.surfaceMuted }]}>
              <Text numberOfLines={1} style={[styles.actionLabel, { color: theme.colors.text }]}>Card {displayedOurHand.findIndex((order) => order === selectedCard) + 1}</Text>
              <View style={styles.actionButtons}>
                <ActionButton compact disabled={!cardEnabled} title="Play" tone="primary" onPress={() => lobbyRuntime.play(selectedCard)} />
                <ActionButton compact disabled={!cardEnabled} title="Discard" onPress={() => lobbyRuntime.discard(selectedCard)} />
                <ActionButton compact title="Note" onPress={() => openNote(selectedCard)} />
              </View>
            </View>}
        </View>}
      </View>

      <View style={[styles.opponentLane, landscape && styles.opponentLaneLandscape]}>
        <View style={[styles.players, gameplayLayout.opponentColumns === 2 && styles.playersLandscape]}>
          {visiblePlayers.map((i) => {
            const target = selectedTarget === i;
            const empathizing = interaction.empathyPlayer === i;
            const displayedHand = getDisplayedHandOrders(game.hands[i]);
            return <View key={i} style={[
              styles.player,
              gameplayLayout.opponentColumns === 2 && styles.playerLandscape,
              { backgroundColor: theme.colors.surface, borderColor: target ? theme.colors.accent : theme.colors.border },
              target && styles.target,
            ]}>
              <Pressable
                accessibilityLabel={playerRoom === null ? undefined : `Clue ${metadata.playerNames[i] ?? `Player ${i + 1}`}`}
                accessibilityRole={playerRoom === null ? undefined : 'button'}
                accessibilityState={playerRoom === null ? undefined : { selected: target }}
                disabled={playerRoom === null}
                onPress={() => interactionDispatch({ type: 'select-clue-target', playerIndex: i })}
                style={styles.playerHeader}
              >
                <View style={styles.grow}>
                  <Text numberOfLines={1} style={[styles.playerName, { color: theme.colors.text }]}>{metadata.playerNames[i]}</Text>
                  <Text style={[styles.presence, { color: theme.colors.textMuted }]}>{presence(liveRoom.connected?.[i], Object.values(lobbyUsers).find((user) => user?.name === metadata.playerNames[i])?.inactive ?? false)}</Text>
                </View>
                <View style={styles.buttons}>
                  {timed && liveRoom.clock !== null && <LiveClockText clock={liveRoom.clock} paused={clientState.pause.active} playerIndex={i} />}
                  {empathizing && <Pill active>Empathy</Pill>}
                  {target && !empathizing && <Pill active>Clue</Pill>}
                </View>
              </Pressable>
              <View style={[styles.hand, { gap: gameplayLayout.cardGap }]}>
                {displayedHand.map((order, position) => {
                  const card = game.deck[order];
                  if (card === undefined) return null;
                  const cardNote = clientState.notes.ourNotes[order];
                  const presentation = getCardKnowledgeViewModel(metadata.options.variantName, card, cardNote, false);
                  const empathyKnowledge = empathizing
                    ? getCardKnowledgeViewModel(metadata.options.variantName, card, cardNote, false, true)
                    : null;
                  return <VisibleHanabiCard
                    clueMarker={getCommittedClueMarkerForMetadata(lastClue, order, card.numPositiveClues, metadata)}
                    empathyKnowledge={empathyKnowledge}
                    hasNote={hasCardNote(order)}
                    height={gameplayLayout.opponentCardHeight}
                    highlighted={previewTouched.has(order)}
                    key={order}
                    onLongPress={() => interactionDispatch({ type: 'hold-empathy', playerIndex: i })}
                    onPress={() => openNote(order)}
                    onPressOut={() => interactionDispatch({ type: 'hold-empathy', playerIndex: null })}
                    position={position}
                    rank={card.rank}
                    semanticBorder={presentation.borderColor}
                    suitIndex={card.suitIndex}
                    variantName={metadata.options.variantName}
                  />;
                })}
              </View>
            </View>;
          })}
        </View>
        {playerRoom !== null && <ClueComposer
          choices={clueChoices}
          enabled={clueEnabled}
          onClear={() => interactionDispatch({ type: 'clear-clue-preview' })}
          onConfirm={confirmClue}
          onPreview={(clueType, value) => interactionDispatch({ type: 'preview-clue', clueType, value })}
          preview={cluePreview}
          previewState={interaction.cluePreview}
          targetName={targetName}
        />}
        {replay.active && review}
        {gameplayLayout.needsSharedVerticalScroll && <Text style={[styles.denseHint, { color: theme.colors.textMuted }]}>Dense table: one shared vertical scroll may be needed; individual hands never scroll sideways.</Text>}
      </View>
    </View>
    <DiscardViewer game={game} onClose={() => setDiscardViewerOpen(false)} variantName={metadata.options.variantName} visible={discardViewerOpen} />
    <NoteEditor
      editable={notesEditable}
      onChange={setNote}
      onClear={clearNote}
      onClose={() => setNoteEditorOpen(false)}
      onSave={saveNote}
      title={noteCardLabel}
      value={note}
      visible={noteEditorOpen}
    />
  </>;
}

function C17DenseWorkspace({
  actionSegments,
  canReviewForward,
  canReviewBack,
  cardIdentities,
  cardsPerHand,
  canCommitCard,
  empathyPlayer,
  game,
  globalEmpathy,
  historyAvailable,
  metadata,
  notes,
  ourIndex,
  selectedCard,
  lastAction,
  futureEfficiency,
  liveTurn,
  newerActionCount,
  onDiscard,
  onEnterRewind,
  onOpenDiscards,
  onOpenNote,
  onPlay,
  onReviewBack,
  onReviewEnd,
  onReviewForward,
  onReviewStart,
  onReturnLive,
  onScrubAction,
  onSelectCard,
  onSelectRecentAction,
  onToggleEmpathyPlayer,
  onToggleGlobalEmpathy,
  pendingText,
  recentActions,
  reviewActive,
  selectedActionSegment,
  selectedTurn,
  variantName,
}: {
  actionSegments: readonly number[];
  canReviewForward: boolean;
  canReviewBack: boolean;
  cardIdentities: readonly CardIdentity[];
  cardsPerHand: number;
  canCommitCard: boolean;
  empathyPlayer: number | null;
  game: GameState;
  globalEmpathy: boolean;
  historyAvailable: boolean;
  metadata: { playerNames: readonly string[] };
  notes: readonly CardNote[];
  ourIndex: number;
  selectedCard: number | null;
  lastAction: string;
  futureEfficiency: number | null;
  liveTurn: number;
  newerActionCount: number;
  onDiscard: () => void;
  onEnterRewind: () => void;
  onOpenDiscards: () => void;
  onOpenNote: (order: number) => void;
  onPlay: () => void;
  onReviewBack: () => void;
  onReviewEnd: () => void;
  onReviewForward: () => void;
  onReviewStart: () => void;
  onReturnLive: () => void;
  onScrubAction: (segment: number) => void;
  onSelectCard: (order: number) => void;
  onSelectRecentAction: (segment: number) => void;
  onToggleEmpathyPlayer: (playerIndex: number) => void;
  onToggleGlobalEmpathy: () => void;
  pendingText: string | null;
  recentActions: readonly C17TemporalEntry[];
  reviewActive: boolean;
  selectedActionSegment: number;
  selectedTurn: number;
  variantName: string;
}) {
  const { theme } = useHanabTheme();
  const [recentOpen, setRecentOpen] = useState(false);
  const [layoutMetrics, setLayoutMetrics] = useState({
    opponentCardLaneWidth: 0,
    handsRegionHeight: 0,
    ownCardLaneWidth: 0,
  });
  useEffect(() => {
    if (reviewActive) setRecentOpen(false);
  }, [reviewActive]);
  const opponents = getRelativeOpponentIndices(metadata.playerNames.length, ourIndex);
  const layout = getC17DenseLayout({
    ...layoutMetrics,
    opponentCount: opponents.length,
    cardsPerHand,
  });
  const onHandsRegionLayout = ({ nativeEvent: { layout: next } }: LayoutChangeEvent) => {
    setLayoutMetrics((current) => current.handsRegionHeight === next.height
      ? current : { ...current, handsRegionHeight: next.height });
  };
  const onOpponentCardLaneLayout = ({ nativeEvent: { layout: next } }: LayoutChangeEvent) => {
    setLayoutMetrics((current) => current.opponentCardLaneWidth === next.width
      ? current : { ...current, opponentCardLaneWidth: next.width });
  };
  const onOwnCardLaneLayout = ({ nativeEvent: { layout: next } }: LayoutChangeEvent) => {
    setLayoutMetrics((current) => current.ownCardLaneWidth === next.width
      ? current : { ...current, ownCardLaneWidth: next.width });
  };
  const current = game.turn.currentPlayerIndex;
  const currentName = current === null ? 'No current player' : metadata.playerNames[current] ?? `Player ${current + 1}`;
  const ownHand = getDisplayedHandOrders(game.hands[ourIndex]);
  const selectedOwnCard = selectedCard !== null && ownHand.some((order) => order === selectedCard) ? selectedCard : null;
  const selectedNote = selectedOwnCard === null ? '' : notes[selectedOwnCard]?.text ?? '';

  return <>
    <View style={styles.c17Workspace}>
      <View style={[styles.c17Hud, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.grow}>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>{reviewActive ? `REWIND T${selectedTurn}` : `LIVE T${liveTurn}`}</Text>
          <Text numberOfLines={1} style={[styles.c17Turn, { color: theme.colors.text }]}>{current === ourIndex ? 'YOUR TURN' : currentName}</Text>
        </View>
        <HudStat label="Score" value={game.score} />
        <HudStat label="Max" value={game.stats.maxScore} />
        <HudStat label="Clues" value={getDisplayedClueTokens(game.clueTokens, variantName)} />
        <HudStat label="Strikes" value={game.strikes.length} />
        <HudStat label="Deck" value={game.cardsRemainingInTheDeck} />
        {game.stats.pace !== null && <HudStat label="Pace" value={game.stats.pace} />}
        {futureEfficiency !== null && <HudStat label="FRE" value={futureEfficiency.toFixed(2)} />}
      </View>
      <CompactTable dense game={game} onOpenDiscards={onOpenDiscards} variantName={variantName} />
      <View style={[styles.c17LastAction, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
        <View style={styles.c17LastActionHeader}>
          <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>{reviewActive ? `LAST ACTION · T${selectedTurn}` : 'LAST ACTION'}</Text>
          {!reviewActive && <ActionButton compact disabled={!historyAvailable} title="Rewind" onPress={onEnterRewind} />}
        </View>
        <Pressable
          accessibilityLabel="Open recent actions"
          accessibilityRole="button"
          disabled={!historyAvailable}
          onPress={() => setRecentOpen(true)}
          style={({ pressed }) => [styles.c17LastActionPressable, pressed && { backgroundColor: theme.colors.overlay }]}
        >
          <Text numberOfLines={1} style={[styles.c17LastActionText, { color: theme.colors.text }]}>{lastAction}</Text>
          <Text style={[styles.c17RecentLink, { color: historyAvailable ? theme.colors.accent : theme.colors.textMuted }]}>RECENT ›</Text>
        </Pressable>
      </View>
      <View onLayout={onHandsRegionLayout} style={styles.c17Hands}>
        <View style={styles.c17Opponents}>
          {opponents.map((index) => {
            const currentActor = current === index;
            const compact = layout.mode === 'compact-overview';
            const empathizing = globalEmpathy || empathyPlayer === index;
            return <View key={index} style={[styles.c17OpponentRow, { height: layout.opponentRowHeight }, currentActor && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.accent }]}>
              <View style={styles.c17OpponentMeta}>
                <Text numberOfLines={1} style={[styles.c17OpponentName, { color: currentActor ? theme.colors.accent : theme.colors.text }]}>{metadata.playerNames[index]}{currentActor ? ' · TURN' : ''}</Text>
                <Pressable
                  accessibilityLabel={`Knowledge for ${metadata.playerNames[index] ?? `Player ${index + 1}`}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: empathizing }}
                  disabled={reviewActive || globalEmpathy}
                  onPress={() => onToggleEmpathyPlayer(index)}
                >
                  <Text style={[styles.c17KnowledgeLink, { color: empathizing ? theme.colors.accent : theme.colors.textMuted }]}>{empathizing ? 'KNOW ✓' : 'KNOW'}</Text>
                </Pressable>
              </View>
              <View onLayout={index === opponents[0] ? onOpponentCardLaneLayout : undefined} style={styles.c17OpponentCards}>{getDisplayedHandOrders(game.hands[index]).map((order, position) => {
                const card = game.deck[order];
                if (card === undefined) return null;
                const cardNote = notes[order];
                const empathyKnowledge = empathizing
                  ? getCardKnowledgeViewModel(variantName, card, cardNote, false, true, cardIdentities[order])
                  : null;
                return <VisibleHanabiCard
                  empathyKnowledge={empathyKnowledge}
                  hasNote={(cardNote?.text.trim().length ?? 0) > 0}
                  height={layout.opponentCardHeight}
                  key={order}
                  onPress={() => onOpenNote(order)}
                  position={position}
                  rank={card.rank}
                  size={compact ? 'mini' : 'hand'}
                  suitIndex={card.suitIndex}
                  variantName={variantName}
                />;
              })}</View>
            </View>;
          })}
        </View>
        <View style={[styles.c17OwnHand, { height: layout.ownRowHeight, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.c17OwnTitle, { color: theme.colors.text }]}>YOUR HAND</Text>
          <View onLayout={onOwnCardLaneLayout} style={styles.c17OwnCards}>{ownHand.map((order, position) => {
            const card = game.deck[order];
            if (card === undefined) return null;
            return <GameCard height={layout.ownCardHeight} hasNote={(notes[order]?.text.trim().length ?? 0) > 0} key={order}
              knowledge={getCardKnowledgeViewModel(
                variantName,
                card,
                notes[order],
                false,
                globalEmpathy,
                cardIdentities[order],
              )} onSelect={() => onSelectCard(order)}
              position={position} selected={selectedOwnCard === order} variantName={variantName} />;
          })}</View>
        </View>
      </View>
      <View style={[styles.c17Workbench, { minHeight: layout.workbenchHeight, backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}>
        {reviewActive
          ? <>
            <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>Rewind T{selectedTurn} · Live T{liveTurn}{newerActionCount > 0 ? ` · ${newerActionCount} NEW` : ''}</Text>
            <C17RewindScrubber actionSegments={actionSegments} onSelectSegment={onScrubAction} selectedSegment={selectedActionSegment} />
            <View style={styles.c17ActionRow}>
              <View style={styles.actionButtons}>
                <ActionButton compact disabled={!canReviewBack} title="← Back" onLongPress={onReviewStart} onPress={onReviewBack} />
                <ActionButton compact disabled={!canReviewForward} title="Forward →" onLongPress={onReviewEnd} onPress={onReviewForward} />
              </View>
              <ActionButton compact title={`Exit · Live T${liveTurn}`} tone="primary" onPress={onReturnLive} />
            </View>
            <Text style={[styles.c17RewindHint, { color: theme.colors.textMuted }]}>Hold Back for start · Hold Forward for end</Text>
          </>
          : <>
            <View style={styles.c17ActionRow}>
              <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>DECISION WORKBENCH</Text>
              <ActionButton compact title={globalEmpathy ? 'Open identities' : 'All knowledge'} tone={globalEmpathy ? 'primary' : 'ghost'} onPress={onToggleGlobalEmpathy} />
            </View>
            {selectedOwnCard === null
              ? <Text style={[styles.c17WorkbenchText, { color: theme.colors.textMuted }]}>Select a card</Text>
              : <>
                <View style={styles.c17ActionRow}>
                  <Text style={[styles.c17WorkbenchText, { color: theme.colors.text }]}>Card {ownHand.findIndex((order) => order === selectedOwnCard) + 1}</Text>
                  <View style={styles.actionButtons}>
                    <ActionButton compact disabled={!canCommitCard} title="Play" tone="primary" onPress={onPlay} />
                    <ActionButton compact disabled={!canCommitCard} title="Discard" onPress={onDiscard} />
                    <ActionButton compact title="Note" onPress={() => onOpenNote(selectedOwnCard)} />
                  </View>
                </View>
                <Text numberOfLines={2} style={[styles.c17NotePreview, { color: selectedNote.trim().length > 0 ? theme.colors.text : theme.colors.textMuted }]}>
                  {selectedNote.trim().length > 0 ? selectedNote : 'No saved note'}
                </Text>
              </>}
            {pendingText !== null && <Text style={[styles.c17PendingText, { color: theme.colors.textMuted }]}>{pendingText}… awaiting server</Text>}
          </>}
      </View>
    </View>
    <Modal animationType="fade" onRequestClose={() => setRecentOpen(false)} statusBarTranslucent transparent visible={recentOpen}>
      <View style={[styles.c17RecentBackdrop, { backgroundColor: theme.colors.overlay }]}>
        <View style={[styles.c17RecentPopup, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
          <View style={styles.between}>
            <View>
              <Text style={[styles.c17RecentTitle, { color: theme.colors.text }]}>Recent actions</Text>
              <Text style={[styles.c17RecentHint, { color: theme.colors.textMuted }]}>Tap an action to jump there in rewind.</Text>
            </View>
            <ActionButton compact title="Close" onPress={() => setRecentOpen(false)} />
          </View>
          <View style={styles.c17RecentList}>
            {[...recentActions].reverse().map((entry) => <Pressable
              accessibilityRole="button"
              key={entry.segment}
              onPress={() => {
                setRecentOpen(false);
                onSelectRecentAction(entry.segment);
              }}
              style={({ pressed }) => [
                styles.c17RecentItem,
                { borderColor: theme.colors.border, backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface },
              ]}
            >
              <Text style={[styles.c17RecentTurn, { color: theme.colors.accent }]}>T{entry.turn}</Text>
              <Text numberOfLines={2} style={[styles.c17RecentSummary, { color: theme.colors.text }]}>{entry.summary}</Text>
              <Text style={[styles.c17RecentJump, { color: theme.colors.accent }]}>JUMP ›</Text>
            </Pressable>)}
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

function ReplayTable({ game, variantName }: { game: GameState; variantName: string }) {
  return <CompactTable game={game} variantName={variantName} />;
}

function ReplayHands({ game, playerNames, variantName, notes, onOpenNote }: {
  game: GameState;
  playerNames: readonly string[];
  variantName: string;
  notes: ReadonlyArray<readonly NoteEntry[]>;
  onOpenNote: (order: number) => void;
}) {
  const { theme } = useHanabTheme();
  return <Panel><SectionHeading title="Replay hands" detail="Desktop left-to-right order; tap a noted card to read it." /><View style={styles.players}>{playerNames.map((name, i) => <View key={name}
    style={[styles.player, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}><Text style={[styles.playerName, { color: theme.colors.text }]}>{name}</Text>
    <View style={styles.replayHand}>{getDisplayedHandOrders(game.hands[i]).map((order, position) => {
      const card = game.deck[order];
      const knowledge = card === undefined ? null : getCardKnowledgeViewModel(variantName, card, undefined, true);
      const hasNote = notes[order]?.some((entry) => entry.text.trim().length > 0) ?? false;
      return <View key={order} style={styles.replayCard}><VisibleHanabiCard hasNote={hasNote}
        onLongPress={hasNote ? () => onOpenNote(order) : undefined} onPress={hasNote ? () => onOpenNote(order) : undefined}
        position={position} rank={card?.rank ?? null} semanticBorder={knowledge?.borderColor ?? null}
        suitIndex={card?.suitIndex ?? null} variantName={variantName} />
        {knowledge !== null && <CardKnowledgeDetails knowledge={knowledge} variantName={variantName} />}</View>;
    })}</View>
  </View>)}</View></Panel>;
}

function getCardLocationLabel(game: GameState, playerNames: readonly string[], variantName: string, order: number) {
  for (const [playerIndex, hand] of game.hands.entries()) {
    const displayed = getDisplayedHandOrders(hand);
    const position = displayed.findIndex((cardOrder) => cardOrder === order);
    if (position >= 0) return `${playerNames[playerIndex] ?? `Player ${playerIndex + 1}`} · card ${position + 1}`;
  }
  const suits = getGameTableSuits(variantName, game);
  for (const suit of suits) {
    if ((game.playStacks[suit.suitIndex] ?? []).some((cardOrder) => cardOrder === order)) return `${suit.suitName} firework`;
    if ((game.discardStacks[suit.suitIndex] ?? []).some((cardOrder) => cardOrder === order)) return `${suit.suitName} discard`;
  }
  if (game.hole.some((cardOrder) => cardOrder === order)) return 'Hole';
  return `Card ${order}`;
}

function GameLog({ entries, title }: { entries: readonly { turn: number; text: string }[]; title: string }) {
  const { theme } = useHanabTheme();
  return <Panel><SectionHeading title={title} /><View style={styles.log}>{entries.map((entry, i) => <Text key={`${entry.turn}-${i}`} style={[styles.muted, { color: theme.colors.textMuted }]}>{entry.text}</Text>)}</View></Panel>;
}

function HudStat({ label, value }: { label: string; value: number | string }) {
  const { theme } = useHanabTheme();
  return <View style={styles.hudStat}><Text style={[styles.hudValue, { color: theme.colors.text }]}>{value}</Text><Text style={[styles.hudLabel, { color: theme.colors.textMuted }]}>{label}</Text></View>;
}

function LiveClockText({ clock, playerIndex, paused }: { clock: LiveClock; playerIndex: number; paused: boolean }) {
  const { theme } = useHanabTheme();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (paused) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [clock.receivedAtMs, paused, playerIndex]);
  const display = getDisplayedClockString(clock, playerIndex, paused, now);
  if (display === null) return null;
  return <Text style={[styles.clock, { color: theme.colors.text }]}>{display}</Text>;
}

function presence(connected: boolean | undefined, inactive: boolean) { return connected === false ? 'disconnected' : inactive ? 'away' : 'online'; }
function formatMs(value: number) { const seconds = Math.max(0, Math.round(value / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function durationBetween(started: string, finished: string) { const start = Date.parse(started); const end = Date.parse(finished); return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null; }
function Stat({ label, value }: { label: string; value: number }) { const { theme } = useHanabTheme(); return <View style={[styles.stat, { backgroundColor: theme.colors.surfaceMuted }]}><Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text><Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text></View>; }

const styles = StyleSheet.create({
  liveScreen: { gap: 10, paddingBottom: 8 },
  liveLandscape: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  mainLane: { flex: 1, gap: 9, minWidth: 0 },
  mainLaneLandscape: { flex: 1.35 },
  opponentLane: { flex: 1, gap: 9, minWidth: 0 },
  opponentLaneLandscape: { flex: 1 },
  finishedScreen: { gap: 14, paddingBottom: 10 },
  wide: { alignItems: 'flex-start', flexDirection: 'row' },
  column: { flex: 1, gap: 14, minWidth: 0 },
  grow: { flex: 1, minWidth: 0 },
  between: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  buttons: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  details: { gap: 4 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  muted: { fontSize: 12, lineHeight: 17 },
  body: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  hud: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 9, paddingVertical: 7 },
  hudTurn: { flex: 1, minWidth: 70 },
  hudCurrent: { fontSize: 14, fontWeight: '900' },
  hudStat: { alignItems: 'center', minWidth: 34 },
  hudValue: { fontSize: 15, fontWeight: '900', lineHeight: 17 },
  hudLabel: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  handSurface: { borderRadius: 14, borderWidth: 1, gap: 8, padding: 9 },
  handHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  handTitle: { fontSize: 14, fontWeight: '900' },
  hand: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'center', minWidth: 0, width: '100%' },
  selectHint: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
  actionBar: { alignItems: 'center', borderRadius: 10, flexDirection: 'row', gap: 8, justifyContent: 'space-between', padding: 7 },
  actionLabel: { flex: 1, fontSize: 12, fontWeight: '800', minWidth: 0 },
  actionButtons: { flexDirection: 'row', gap: 5 },
  players: { gap: 7 },
  playersLandscape: { flexDirection: 'row', flexWrap: 'wrap' },
  player: { borderRadius: 12, borderWidth: 1, gap: 6, minWidth: 0, padding: 7 },
  playerLandscape: { flexBasis: '48%', flexGrow: 1 },
  target: { borderWidth: 2, padding: 6 },
  playerHeader: { alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'space-between' },
  playerName: { fontSize: 13, fontWeight: '900' },
  presence: { fontSize: 9, lineHeight: 12 },
  clock: { fontVariant: ['tabular-nums'], fontSize: 12, fontWeight: '900' },
  denseHint: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
  c17Workspace: { flex: 1, gap: 5, minHeight: 0, paddingBottom: 4 },
  c17Hud: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 4, paddingHorizontal: 7, paddingVertical: 5 },
  c17Turn: { fontSize: 13, fontWeight: '900' },
  c17LastAction: { borderRadius: 8, borderWidth: 1, gap: 3, minHeight: 37, paddingHorizontal: 7, paddingVertical: 4 },
  c17LastActionHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  c17LastActionPressable: { alignItems: 'center', borderRadius: 5, flexDirection: 'row', gap: 7, minHeight: 24, paddingHorizontal: 2 },
  c17LastActionText: { flex: 1, fontSize: 10, fontWeight: '700', minWidth: 0 },
  c17RecentLink: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  c17Hands: { flex: 1, gap: 5, minHeight: 0 },
  c17Opponents: { gap: 2 },
  c17OpponentRow: { alignItems: 'center', borderColor: 'transparent', borderRadius: 7, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 4 },
  c17OpponentMeta: { justifyContent: 'center', width: 64 },
  c17OpponentName: { fontSize: 10, fontWeight: '900' },
  c17KnowledgeLink: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  c17OpponentCards: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 3, minWidth: 0 },
  c17OwnHand: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 6, padding: 5 },
  c17OwnTitle: { fontSize: 10, fontWeight: '900', width: 64 },
  c17OwnCards: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 4, minWidth: 0 },
  c17Workbench: { borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, gap: 4, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 7 },
  c17ActionRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  c17WorkbenchText: { fontSize: 12, lineHeight: 16 },
  c17NotePreview: { fontSize: 10, lineHeight: 14 },
  c17PendingText: { fontSize: 10, lineHeight: 14 },
  c17RewindHint: { fontSize: 9, lineHeight: 12 },
  c17RecentBackdrop: { flex: 1, justifyContent: 'center', padding: 18 },
  c17RecentPopup: { borderRadius: 14, borderWidth: 1, gap: 10, maxHeight: '78%', padding: 12 },
  c17RecentTitle: { fontSize: 16, fontWeight: '900' },
  c17RecentHint: { fontSize: 11, lineHeight: 15 },
  c17RecentList: { gap: 6 },
  c17RecentItem: { alignItems: 'center', borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 48, paddingHorizontal: 9, paddingVertical: 7 },
  c17RecentTurn: { fontSize: 11, fontWeight: '900', width: 30 },
  c17RecentSummary: { flex: 1, fontSize: 11, lineHeight: 15, minWidth: 0 },
  c17RecentJump: { fontSize: 9, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 8, width: '100%' },
  stat: { alignItems: 'center', borderRadius: 10, flex: 1, padding: 9 },
  statValue: { fontSize: 20, fontWeight: '900' },
  gameOver: { alignItems: 'center' },
  gameOverText: { fontSize: 24, fontWeight: '900', letterSpacing: 1.2 },
  finalScore: { fontSize: 48, fontWeight: '900', lineHeight: 52 },
  log: { gap: 6 },
  replayHand: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center', width: '100%' },
  replayCard: { gap: 5, width: 92 },
});