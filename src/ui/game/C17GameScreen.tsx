import { useEffect, useMemo, useReducer, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { CardIdentity, CardNote, GameState } from '../../game/bootstrap/types';
import { getCardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import { getCardStatePresentation } from '../../game/selectors/cardStatePresentation';
import { getCluePreview } from '../../game/selectors/cluePreview';
import {
  getDisplayedClueTokens,
  getDisplayedLiveFutureEfficiency,
  getGameplayCardsPerHand,
  getGameplayClueChoicesForPlayer,
  hasClueTokenForVariant,
} from '../../game/selectors/gameplay';
import { lobbyRuntime } from '../../runtime/application';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { roomActions } from '../../store/roomSlice';
import { ActionButton, Notice, useHanabTheme } from '../designSystem';
import { C17RewindScrubber } from './C17RewindScrubber';
import { ClueComposer } from './ClueComposer';
import { CompactTable } from './CompactTable';
import { DiscardViewer } from './DiscardViewer';
import { CardKnowledgeDetails, GameCard, VisibleHanabiCard } from './GameCard';
import { NoteEditor } from './NoteEditor';
import { getC17DenseLayout, getRelativeOpponentIndices } from './c17DenseLayout';
import {
  countC17TemporalStatesAfter,
  getC17TemporalContext,
  type C17TemporalEntry,
} from './c17Temporal';
import {
  gameplayInteractionReducer,
  initialGameplayInteractionState,
} from './gameplayInteraction';
import { getDisplayedHandOrders } from './gamePresentation';
import { getLiveNoteOrders } from './liveNoteOrders';

type C17ReviewSelection = {
  actionSegment: number;
  liveSegmentAtEntry: number;
};

const HAND_META_WIDTH = 112;
const HAND_ROW_CONTENT_GAP = 5;
const HAND_ROW_HORIZONTAL_PADDING = 4;
const HAND_CARD_GAP = 3;

export function C17GameScreen() {
  const { theme } = useHanabTheme();
  const dispatch = useAppDispatch();
  const sessionPhase = useAppSelector((state) => state.session.phase);
  const roomState = useAppSelector((state) => state.room);
  const liveRoom = roomState.room.kind === 'live_game' ? roomState.room : null;
  const clientState = liveRoom?.clientState ?? null;
  const game = clientState?.visibleState ?? null;
  const playerRoom = liveRoom?.role === 'player' && clientState?.playing ? liveRoom : null;
  const ourIndex = playerRoom?.clientState.metadata.ourPlayerIndex ?? null;
  const ourHand = useMemo(() => ourIndex === null ? [] : game?.hands[ourIndex] ?? [], [game, ourIndex]);
  const clueTargets = useMemo(() => playerRoom?.clientState.metadata.playerNames
    .map((_, index) => index)
    .filter((index) => index !== ourIndex) ?? [], [ourIndex, playerRoom]);
  const [interaction, interactionDispatch] = useReducer(gameplayInteractionReducer, initialGameplayInteractionState);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [discardViewerOpen, setDiscardViewerOpen] = useState(false);
  const [note, setNote] = useState('');
  const [c17Review, setC17Review] = useState<C17ReviewSelection | null>(null);

  const liveNoteOrders = useMemo(() => getLiveNoteOrders(game), [game]);
  useEffect(() => {
    interactionDispatch({
      type: 'sync-hands',
      ownOrders: ourHand,
      clueTargets,
      empathyPlayers: clueTargets,
      visibleOrders: liveNoteOrders,
    });
  }, [clueTargets, liveNoteOrders, ourHand]);

  const replayActive = clientState?.replay.active ?? false;
  useEffect(() => {
    interactionDispatch({ type: 'disarm-gameplay' });
    if (!replayActive) setC17Review(null);
  }, [replayActive]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      interactionDispatch({ type: 'reset-lifecycle-transients' });
      setDiscardViewerOpen(false);
    });
    return () => subscription.remove();
  }, []);

  const noteCard = interaction.noteCard;
  const authoritativeNote = noteCard === null ? '' : clientState?.notes.ourNotes[noteCard]?.text ?? '';
  useEffect(() => {
    if (!noteEditorOpen) setNote(authoritativeNote);
  }, [authoritativeNote, noteCard, noteEditorOpen]);
  useEffect(() => {
    if (noteCard === null) setNoteEditorOpen(false);
  }, [noteCard]);

  if (liveRoom === null || clientState === null || game === null || playerRoom === null || ourIndex === null) return null;

  const { metadata, replay, ongoingGame } = clientState;
  const latest = ongoingGame.turn.segment ?? 0;
  const selectedCard = interaction.selectedCard;
  const selectedTarget = interaction.clueTarget;
  const isOurTurn = game.turn.currentPlayerIndex === ourIndex;
  const enabled = sessionPhase === 'ready'
    && isOurTurn
    && !replay.active
    && !clientState.pause.active
    && roomState.pendingGameplayAction === null;
  const cardEnabled = enabled && selectedCard !== null && ourHand.some((order) => order === selectedCard);
  const clueChoices = getGameplayClueChoicesForPlayer(metadata);
  const clueEnabled = enabled
    && hasClueTokenForVariant(game.clueTokens, metadata.options.variantName)
    && selectedTarget !== null;
  const notesEditable = sessionPhase === 'ready'
    && !replay.active
    && !liveRoom.sharedReplay
    && noteCard !== null
    && liveNoteOrders.includes(noteCard);
  const pending = roomState.pendingGameplayAction?.action ?? null;
  const pendingText = pending === null
    ? null
    : ['Playing card', 'Discarding card', 'Giving color clue', 'Giving rank clue'][pending.type];

  const inspectNote = (order: number) => {
    setNote(clientState.notes.ourNotes[order]?.text ?? '');
    interactionDispatch({ type: 'open-note', order });
  };
  const editNote = (order: number) => {
    inspectNote(order);
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
  const targetName = selectedTarget === null
    ? null
    : metadata.playerNames[selectedTarget] ?? `Player ${selectedTarget + 1}`;
  const confirmClue = () => {
    if (selectedTarget === null || interaction.cluePreview === null) return;
    const sent = interaction.cluePreview.type === 'color'
      ? lobbyRuntime.colorClue(selectedTarget, interaction.cluePreview.value)
      : lobbyRuntime.rankClue(selectedTarget, interaction.cluePreview.value);
    if (sent) interactionDispatch({ type: 'select-clue-target', playerIndex: null });
  };

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
  const actionSegments = replay.states.flatMap((state, segment) => state === undefined ? [] : [segment]);
  const firstActionSegment = actionSegments[0] ?? null;
  const lastActionSegment = actionSegments.at(-1) ?? null;

  const disarmGameplay = () => interactionDispatch({ type: 'disarm-gameplay' });
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
    if (replay.shared !== null) lobbyRuntime.navigateReplaySegment(latest);
    else dispatch(roomActions.reviewSegmentSelected({
      tableID: liveRoom.tableID,
      gameLoadEpoch: liveRoom.gameLoadEpoch,
      segment: null,
    }));
  };

  return <>
    <C17DenseWorkspace
      actionSegments={actionSegments}
      canCommitCard={cardEnabled}
      canReviewBack={reviewTemporal.previousActionSegment !== null}
      canReviewForward={reviewTemporal.nextActionSegment !== null}
      cardIdentities={clientState.cardIdentities}
      cardsPerHand={getGameplayCardsPerHand(metadata)}
      clueChoices={clueChoices}
      clueEnabled={clueEnabled}
      cluePreview={cluePreview}
      cluePreviewState={interaction.cluePreview}
      empathyPlayer={interaction.empathyPlayer}
      futureEfficiency={futureEfficiency}
      game={game}
      globalEmpathy={interaction.globalEmpathy}
      historyAvailable={recentActions.length > 0}
      lastAction={reviewTemporal.last.summary}
      liveTurn={liveTemporal.liveTurn}
      metadata={metadata}
      newerActionCount={newerActionCount}
      noteCard={noteCard}
      notes={clientState.notes.ourNotes}
      onClearCluePreview={() => interactionDispatch({ type: 'clear-clue-preview' })}
      onClearEmpathy={() => interactionDispatch({ type: 'clear-empathy' })}
      onConfirmClue={confirmClue}
      onDiscard={() => {
        if (cardEnabled && selectedCard !== null) lobbyRuntime.discard(selectedCard);
      }}
      onEditNote={editNote}
      onEnterRewind={enterRewind}
      onHoldEmpathy={(playerIndex) => interactionDispatch({ type: 'hold-empathy', playerIndex })}
      onInspectNote={inspectNote}
      onOpenDiscards={() => setDiscardViewerOpen(true)}
      onPlay={() => {
        if (cardEnabled && selectedCard !== null) lobbyRuntime.play(selectedCard);
      }}
      onPreviewClue={(clueType, value) => interactionDispatch({ type: 'preview-clue', clueType, value })}
      onReviewBack={() => navigateReviewAction('back')}
      onReviewEnd={() => jumpReviewEdge('end')}
      onReviewForward={() => navigateReviewAction('forward')}
      onReviewStart={() => jumpReviewEdge('start')}
      onReturnLive={returnLive}
      onScrubAction={jumpToAction}
      onSelectCard={(order) => {
        if (!replay.active) {
          interactionDispatch({ type: 'select-card', order });
          inspectNote(order);
        }
      }}
      onSelectClueTarget={(playerIndex) => interactionDispatch({ type: 'select-clue-target', playerIndex })}
      onSelectRecentAction={jumpToAction}
      onToggleEmpathyPlayer={(playerIndex) => interactionDispatch({ type: 'toggle-empathy-player', playerIndex })}
      onToggleGlobalEmpathy={() => interactionDispatch({ type: 'toggle-global-empathy' })}
      ourIndex={ourIndex}
      pendingText={pendingText ?? null}
      persistentEmpathyPlayer={interaction.persistentEmpathyPlayer}
      recentActions={recentActions}
      reviewActive={replay.active}
      selectedActionSegment={reviewTemporal.selectedSegment}
      selectedCard={selectedCard}
      selectedTarget={selectedTarget}
      selectedTurn={reviewTemporal.selectedTurn}
      targetName={targetName}
      variantName={metadata.options.variantName}
    />
    {clientState.pause.active && <Notice tone="error">Game paused</Notice>}
    <DiscardViewer
      game={game}
      onClose={() => setDiscardViewerOpen(false)}
      variantName={metadata.options.variantName}
      visible={discardViewerOpen}
    />
    <NoteEditor
      editable={notesEditable}
      onChange={setNote}
      onClear={clearNote}
      onClose={() => setNoteEditorOpen(false)}
      onSave={saveNote}
      startEditing
      title={noteCard === null ? 'Card note' : getCardLabel(game, metadata.playerNames, noteCard)}
      value={note}
      visible={noteEditorOpen}
    />
  </>;
}

function C17DenseWorkspace({
  actionSegments,
  canCommitCard,
  canReviewBack,
  canReviewForward,
  cardIdentities,
  cardsPerHand,
  clueChoices,
  clueEnabled,
  cluePreview,
  cluePreviewState,
  empathyPlayer,
  futureEfficiency,
  game,
  globalEmpathy,
  historyAvailable,
  lastAction,
  liveTurn,
  metadata,
  newerActionCount,
  noteCard,
  notes,
  onClearCluePreview,
  onClearEmpathy,
  onConfirmClue,
  onDiscard,
  onEditNote,
  onEnterRewind,
  onHoldEmpathy,
  onInspectNote,
  onOpenDiscards,
  onPlay,
  onPreviewClue,
  onReviewBack,
  onReviewEnd,
  onReviewForward,
  onReviewStart,
  onReturnLive,
  onScrubAction,
  onSelectCard,
  onSelectClueTarget,
  onSelectRecentAction,
  onToggleEmpathyPlayer,
  onToggleGlobalEmpathy,
  ourIndex,
  pendingText,
  persistentEmpathyPlayer,
  recentActions,
  reviewActive,
  selectedActionSegment,
  selectedCard,
  selectedTarget,
  selectedTurn,
  targetName,
  variantName,
}: {
  actionSegments: readonly number[];
  canCommitCard: boolean;
  canReviewBack: boolean;
  canReviewForward: boolean;
  cardIdentities: readonly CardIdentity[];
  cardsPerHand: number;
  clueChoices: ReturnType<typeof getGameplayClueChoicesForPlayer>;
  clueEnabled: boolean;
  cluePreview: ReturnType<typeof getCluePreview> | null;
  cluePreviewState: { type: 'color' | 'rank'; value: number } | null;
  empathyPlayer: number | null;
  futureEfficiency: number | null;
  game: GameState;
  globalEmpathy: boolean;
  historyAvailable: boolean;
  lastAction: string;
  liveTurn: number;
  metadata: { playerNames: readonly string[] };
  newerActionCount: number;
  noteCard: number | null;
  notes: readonly CardNote[];
  onClearCluePreview: () => void;
  onClearEmpathy: () => void;
  onConfirmClue: () => void;
  onDiscard: () => void;
  onEditNote: (order: number) => void;
  onEnterRewind: () => void;
  onHoldEmpathy: (playerIndex: number | null) => void;
  onInspectNote: (order: number) => void;
  onOpenDiscards: () => void;
  onPlay: () => void;
  onPreviewClue: (clueType: 'color' | 'rank', value: number) => void;
  onReviewBack: () => void;
  onReviewEnd: () => void;
  onReviewForward: () => void;
  onReviewStart: () => void;
  onReturnLive: () => void;
  onScrubAction: (segment: number) => void;
  onSelectCard: (order: number) => void;
  onSelectClueTarget: (playerIndex: number | null) => void;
  onSelectRecentAction: (segment: number) => void;
  onToggleEmpathyPlayer: (playerIndex: number) => void;
  onToggleGlobalEmpathy: () => void;
  ourIndex: number;
  pendingText: string | null;
  persistentEmpathyPlayer: number | null;
  recentActions: readonly C17TemporalEntry[];
  reviewActive: boolean;
  selectedActionSegment: number;
  selectedCard: number | null;
  selectedTarget: number | null;
  selectedTurn: number;
  targetName: string | null;
  variantName: string;
}) {
  const { theme } = useHanabTheme();
  const [recentOpen, setRecentOpen] = useState(false);
  const [focusedPlayer, setFocusedPlayer] = useState<number | null>(null);
  const [layoutMetrics, setLayoutMetrics] = useState({
    opponentCardLaneWidth: 0,
    handsRegionHeight: 0,
    ownCardLaneWidth: 0,
  });
  useEffect(() => {
    if (reviewActive) {
      setRecentOpen(false);
      setFocusedPlayer(null);
    }
  }, [reviewActive]);

  const opponents = getRelativeOpponentIndices(metadata.playerNames.length, ourIndex);
  const layout = getC17DenseLayout({
    ...layoutMetrics,
    opponentCount: opponents.length,
    cardsPerHand,
  });
  const current = game.turn.currentPlayerIndex;
  const currentName = current === null ? 'No current player' : metadata.playerNames[current] ?? `Player ${current + 1}`;
  const ownHand = getDisplayedHandOrders(game.hands[ourIndex]);
  const selectedOwnCard = selectedCard !== null && ownHand.some((order) => order === selectedCard) ? selectedCard : null;
  const inspectedNote = noteCard === null ? '' : notes[noteCard]?.text ?? '';
  const inspectedCard = noteCard === null ? undefined : game.deck[noteCard];
  const inspectedKnowledge = inspectedCard === undefined
    ? null
    : getCardKnowledgeViewModel(
      variantName,
      inspectedCard,
      notes[noteCard ?? -1],
      false,
      false,
      cardIdentities[noteCard ?? -1],
    );
  const empathyActive = globalEmpathy || persistentEmpathyPlayer !== null;
  const focusedPlayerName = focusedPlayer === null
    ? null
    : metadata.playerNames[focusedPlayer] ?? `Player ${focusedPlayer + 1}`;
  const focusedPlayerPersistent = focusedPlayer !== null && persistentEmpathyPlayer === focusedPlayer;

  return <View style={styles.workspace}>
    <View style={[styles.hud, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.grow}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>{reviewActive ? `REWIND T${selectedTurn}` : `LIVE T${liveTurn}`}</Text>
        <Text numberOfLines={1} style={[styles.turn, { color: theme.colors.text }]}>{current === ourIndex ? 'YOUR TURN' : currentName}</Text>
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

    <View style={[styles.lastAction, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>{reviewActive ? `LAST ACTION · T${selectedTurn}` : 'LAST ACTION'}</Text>
        {!reviewActive && <ActionButton compact disabled={!historyAvailable} title="Rewind" onPress={onEnterRewind} />}
      </View>
      <Pressable disabled={!historyAvailable} onPress={() => setRecentOpen(true)} style={styles.lastActionPressable}>
        <Text numberOfLines={1} style={[styles.lastActionText, { color: theme.colors.text }]}>{lastAction}</Text>
        <Text style={[styles.link, { color: historyAvailable ? theme.colors.accent : theme.colors.textMuted }]}>RECENT ›</Text>
      </Pressable>
    </View>

    <View
      onLayout={({ nativeEvent: { layout: next } }: LayoutChangeEvent) => setLayoutMetrics((currentMetrics) => (
        currentMetrics.handsRegionHeight === next.height
          ? currentMetrics
          : { ...currentMetrics, handsRegionHeight: next.height }
      ))}
      style={styles.hands}
    >
      <View style={styles.opponents}>
        {opponents.map((index) => {
          const currentActor = current === index;
          const compact = layout.mode === 'compact-overview';
          const empathizing = !reviewActive && (globalEmpathy || empathyPlayer === index);
          const target = selectedTarget === index;
          const focused = focusedPlayer === index;
          const playerName = metadata.playerNames[index] ?? `Player ${index + 1}`;
          return <View
            key={index}
            style={[
              styles.opponentRow,
              { height: layout.opponentRowHeight },
              focused && { borderColor: theme.colors.borderStrong },
              currentActor && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.accent },
              target && { borderColor: theme.colors.accent },
            ]}
          >
            <View style={styles.opponentMeta}>
              <Pressable
                accessibilityLabel={`Player ${playerName}`}
                accessibilityRole="button"
                disabled={reviewActive}
                onPress={() => setFocusedPlayer(index)}
                onPressIn={() => {
                  if (!globalEmpathy) onHoldEmpathy(index);
                }}
                onPressOut={() => {
                  if (!globalEmpathy) onHoldEmpathy(null);
                }}
                style={({ pressed }) => [
                  styles.namePeekArea,
                  pressed && { backgroundColor: theme.colors.overlay },
                ]}
              >
                <Text numberOfLines={1} style={[styles.opponentName, { color: currentActor ? theme.colors.accent : theme.colors.text }]}>
                  {playerName}{currentActor ? ' · TURN' : ''}
                </Text>
              </Pressable>
              <View style={styles.metaButtons}>
                <ActionButton
                  compact
                  disabled={reviewActive}
                  title={target ? 'Clue ✓' : 'Clue'}
                  tone={target ? 'primary' : 'secondary'}
                  onPress={() => {
                    setFocusedPlayer(index);
                    onSelectClueTarget(target ? null : index);
                  }}
                />
              </View>
            </View>
            <View
              onLayout={index === opponents[0] ? ({ nativeEvent: { layout: next } }: LayoutChangeEvent) => setLayoutMetrics((currentMetrics) => (
                currentMetrics.opponentCardLaneWidth === next.width
                  ? currentMetrics
                  : { ...currentMetrics, opponentCardLaneWidth: next.width }
              )) : undefined}
              style={styles.opponentCards}
            >
              {getDisplayedHandOrders(game.hands[index]).map((order, position) => {
                const card = game.deck[order];
                if (card === undefined) return null;
                const cardNote = notes[order];
                const normalKnowledge = getCardKnowledgeViewModel(variantName, card, cardNote, false, false, cardIdentities[order]);
                const empathyKnowledge = empathizing
                  ? getCardKnowledgeViewModel(variantName, card, cardNote, false, true, cardIdentities[order])
                  : null;
                const activeKnowledge = empathyKnowledge ?? normalKnowledge;
                const statePresentation = getCardStatePresentation({
                  game,
                  state: card,
                  note: cardNote,
                  displaySuitIndex: activeKnowledge.displaySuitIndex,
                  displayRank: activeKnowledge.displayRank,
                  empathy: empathizing,
                  finished: false,
                });
                return <VisibleHanabiCard
                  empathyKnowledge={empathyKnowledge}
                  hasNote={(cardNote?.text.trim().length ?? 0) > 0}
                  height={layout.opponentCardHeight}
                  key={order}
                  onLongPress={() => onHoldEmpathy(index)}
                  onPress={() => onInspectNote(order)}
                  onPressOut={() => onHoldEmpathy(null)}
                  position={position}
                  rank={card.rank}
                  semanticBorder={normalKnowledge.borderColor}
                  size={compact ? 'mini' : 'hand'}
                  statePresentation={statePresentation}
                  suitIndex={card.suitIndex}
                  variantName={variantName}
                />;
              })}
            </View>
          </View>;
        })}
      </View>

      <View style={[styles.ownHand, { height: layout.ownRowHeight, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.ownTitle, { color: theme.colors.text }]}>YOUR HAND</Text>
        <View
          onLayout={({ nativeEvent: { layout: next } }: LayoutChangeEvent) => setLayoutMetrics((currentMetrics) => (
            currentMetrics.ownCardLaneWidth === next.width
              ? currentMetrics
              : { ...currentMetrics, ownCardLaneWidth: next.width }
          ))}
          style={styles.ownCards}
        >
          {ownHand.map((order, position) => {
            const card = game.deck[order];
            if (card === undefined) return null;
            const globalOwnEmpathy = !reviewActive && globalEmpathy;
            const cardNote = notes[order];
            const knowledge = getCardKnowledgeViewModel(variantName, card, cardNote, false, globalOwnEmpathy, cardIdentities[order]);
            const statePresentation = getCardStatePresentation({
              game,
              state: card,
              note: cardNote,
              displaySuitIndex: knowledge.displaySuitIndex,
              displayRank: knowledge.displayRank,
              empathy: globalOwnEmpathy,
              finished: false,
            });
            return <GameCard
              hasNote={(cardNote?.text.trim().length ?? 0) > 0}
              height={layout.ownCardHeight}
              key={order}
              knowledge={knowledge}
              onSelect={() => onSelectCard(order)}
              position={position}
              selected={selectedOwnCard === order}
              statePresentation={statePresentation}
              variantName={variantName}
            />;
          })}
        </View>
      </View>
    </View>

    <View style={[styles.workbench, { minHeight: layout.workbenchHeight, backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}>
      {reviewActive ? <>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>Rewind T{selectedTurn} · Live T{liveTurn}{newerActionCount > 0 ? ` · ${newerActionCount} NEW` : ''}</Text>
        <C17RewindScrubber actionSegments={actionSegments} onSelectSegment={onScrubAction} selectedSegment={selectedActionSegment} />
        <View style={styles.rowBetween}>
          <View style={styles.actionButtons}>
            <ActionButton compact disabled={!canReviewBack} title="← Back" onLongPress={onReviewStart} onPress={onReviewBack} />
            <ActionButton compact disabled={!canReviewForward} title="Forward →" onLongPress={onReviewEnd} onPress={onReviewForward} />
          </View>
          <ActionButton compact title={`Exit · Live T${liveTurn}`} tone="primary" onPress={onReturnLive} />
        </View>
      </> : <>
        <View style={styles.rowBetween}>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>DECISION WORKBENCH</Text>
          <View style={styles.actionButtons}>
            {empathyActive && <ActionButton compact title="Normal" tone="primary" onPress={onClearEmpathy} />}
            <ActionButton compact title={globalEmpathy ? 'All empathy ✓' : 'All empathy'} tone={globalEmpathy ? 'primary' : 'ghost'} onPress={onToggleGlobalEmpathy} />
          </View>
        </View>

        {focusedPlayer !== null && focusedPlayerName !== null && <View style={[styles.playerFocus, { borderColor: theme.colors.border }]}>
          <View style={styles.rowBetween}>
            <View style={styles.grow}>
              <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>PLAYER</Text>
              <Text numberOfLines={1} style={[styles.workbenchText, { color: theme.colors.text }]}>{focusedPlayerName}</Text>
            </View>
            <ActionButton
              compact
              disabled={globalEmpathy}
              title={focusedPlayerPersistent ? 'Empathy ✓' : 'Empathy'}
              tone={focusedPlayerPersistent ? 'primary' : 'secondary'}
              onPress={() => onToggleEmpathyPlayer(focusedPlayer)}
            />
          </View>
          <Text style={[styles.playerFocusHint, { color: theme.colors.textMuted }]}>Hold the player name or one of their cards for a temporary empathy peek.</Text>
        </View>}

        {selectedOwnCard !== null && <View style={styles.rowBetween}>
          <Text style={[styles.workbenchText, { color: theme.colors.text }]}>Card {ownHand.findIndex((order) => order === selectedOwnCard) + 1}</Text>
          <View style={styles.actionButtons}>
            <ActionButton compact disabled={!canCommitCard} title="Play" tone="primary" onPress={onPlay} />
            <ActionButton compact disabled={!canCommitCard} title="Discard" onPress={onDiscard} />
          </View>
        </View>}

        {selectedTarget !== null && <ClueComposer
          choices={clueChoices}
          enabled={clueEnabled}
          onClear={onClearCluePreview}
          onConfirm={onConfirmClue}
          onPreview={onPreviewClue}
          preview={cluePreview}
          previewState={cluePreviewState}
          targetName={targetName}
        />}

        {noteCard !== null ? <View style={styles.noteInspect}>
          <View style={styles.rowBetween}>
            <Text style={[styles.workbenchText, { color: theme.colors.text }]}>{getCardLabel(game, metadata.playerNames, noteCard)}</Text>
            <ActionButton compact title="Edit note" onPress={() => onEditNote(noteCard)} />
          </View>
          <Text numberOfLines={2} style={[styles.notePreview, { color: inspectedNote.trim().length > 0 ? theme.colors.text : theme.colors.textMuted }]}>
            {inspectedNote.trim().length > 0 ? inspectedNote : 'No saved note'}
          </Text>
          {inspectedKnowledge !== null && <CardKnowledgeDetails knowledge={inspectedKnowledge} variantName={variantName} />}
        </View> : selectedOwnCard === null && selectedTarget === null && focusedPlayer === null
          ? <Text style={[styles.workbenchText, { color: theme.colors.textMuted }]}>Tap a card to inspect its note.</Text>
          : null}

        {pendingText !== null && <Text style={[styles.pendingText, { color: theme.colors.textMuted }]}>{pendingText}… awaiting server</Text>}
      </>}
    </View>

    <Modal animationType="fade" onRequestClose={() => setRecentOpen(false)} statusBarTranslucent transparent visible={recentOpen}>
      <View style={[styles.recentBackdrop, { backgroundColor: theme.colors.overlay }]}>
        <View style={[styles.recentPopup, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.recentTitle, { color: theme.colors.text }]}>Recent actions</Text>
            <ActionButton compact title="Close" onPress={() => setRecentOpen(false)} />
          </View>
          <View style={styles.recentList}>
            {[...recentActions].reverse().map((entry) => <Pressable
              key={entry.segment}
              onPress={() => {
                setRecentOpen(false);
                onSelectRecentAction(entry.segment);
              }}
              style={[styles.recentItem, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
            >
              <Text style={[styles.recentTurn, { color: theme.colors.accent }]}>T{entry.turn}</Text>
              <Text numberOfLines={2} style={[styles.recentSummary, { color: theme.colors.text }]}>{entry.summary}</Text>
              <Text style={[styles.link, { color: theme.colors.accent }]}>JUMP ›</Text>
            </Pressable>)}
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}

function HudStat({ label, value }: { label: string; value: number | string }) {
  const { theme } = useHanabTheme();
  return <View style={styles.hudStat}>
    <Text style={[styles.hudValue, { color: theme.colors.text }]}>{value}</Text>
    <Text style={[styles.hudLabel, { color: theme.colors.textMuted }]}>{label}</Text>
  </View>;
}

function getCardLabel(game: GameState, playerNames: readonly string[], order: number): string {
  for (const [playerIndex, hand] of game.hands.entries()) {
    const displayed = getDisplayedHandOrders(hand);
    const position = displayed.findIndex((candidate) => candidate === order);
    if (position >= 0) return `${playerNames[playerIndex] ?? `Player ${playerIndex + 1}`} · card ${position + 1}`;
  }
  return `Card ${order}`;
}

const styles = StyleSheet.create({
  workspace: { flex: 1, gap: 5, minHeight: 0, paddingBottom: 4 },
  grow: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  hud: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 4, paddingHorizontal: 7, paddingVertical: 5 },
  turn: { fontSize: 13, fontWeight: '900' },
  hudStat: { alignItems: 'center', minWidth: 34 },
  hudValue: { fontSize: 15, fontWeight: '900', lineHeight: 17 },
  hudLabel: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  lastAction: { borderRadius: 8, borderWidth: 1, gap: 3, minHeight: 37, paddingHorizontal: 7, paddingVertical: 4 },
  lastActionPressable: { alignItems: 'center', flexDirection: 'row', gap: 7, minHeight: 24 },
  lastActionText: { flex: 1, fontSize: 10, fontWeight: '700', minWidth: 0 },
  link: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  rowBetween: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' },
  actionButtons: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  hands: { flex: 1, gap: 5, minHeight: 0 },
  opponents: { gap: 2 },
  opponentRow: { alignItems: 'center', borderColor: 'transparent', borderRadius: 7, borderWidth: 1, flexDirection: 'row', gap: HAND_ROW_CONTENT_GAP, paddingHorizontal: HAND_ROW_HORIZONTAL_PADDING },
  opponentMeta: { gap: 3, justifyContent: 'center', width: HAND_META_WIDTH },
  namePeekArea: { borderRadius: 6, justifyContent: 'center', minHeight: 22, paddingHorizontal: 2 },
  opponentName: { fontSize: 10, fontWeight: '900' },
  metaButtons: { alignItems: 'flex-start', flexDirection: 'row', gap: 3 },
  opponentCards: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: HAND_CARD_GAP, minWidth: 0 },
  ownHand: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: HAND_ROW_CONTENT_GAP, paddingHorizontal: HAND_ROW_HORIZONTAL_PADDING, paddingVertical: 5 },
  ownTitle: { fontSize: 10, fontWeight: '900', width: HAND_META_WIDTH },
  ownCards: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: HAND_CARD_GAP, minWidth: 0 },
  workbench: { borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, gap: 5, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 7 },
  workbenchText: { fontSize: 12, lineHeight: 16 },
  playerFocus: { borderTopWidth: 1, gap: 3, paddingTop: 5 },
  playerFocusHint: { fontSize: 9, lineHeight: 12 },
  noteInspect: { gap: 3 },
  notePreview: { fontSize: 10, lineHeight: 14 },
  pendingText: { fontSize: 10, lineHeight: 14 },
  recentBackdrop: { flex: 1, justifyContent: 'center', padding: 18 },
  recentPopup: { borderRadius: 14, borderWidth: 1, gap: 10, maxHeight: '78%', padding: 12 },
  recentTitle: { fontSize: 16, fontWeight: '900' },
  recentList: { gap: 6 },
  recentItem: { alignItems: 'center', borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 48, paddingHorizontal: 9, paddingVertical: 7 },
  recentTurn: { fontSize: 11, fontWeight: '900', width: 30 },
  recentSummary: { flex: 1, fontSize: 11, lineHeight: 15, minWidth: 0 },
});
