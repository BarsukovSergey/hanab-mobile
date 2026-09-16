import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';

import type { CardIdentity, CardNote, GameMetadata, GameState } from '../../game/bootstrap/types';
import type { HypotheticalState } from '../../game/client/types/HypotheticalState';
import { canToggleHypotheticalDrawnCards } from '../../game/client/hypotheticalEligibility';
import { getCardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import { getCardStatePresentation } from '../../game/selectors/cardStatePresentation';
import { getCluePreview } from '../../game/selectors/cluePreview';
import { getNoteImpossibilityWarning } from '../../game/selectors/noteImpossibility';
import { getLastCluePresentationFromState } from '../../game/selectors/lastClue';
import {
  canDiscardForVariant,
  getDisplayedClueTokens,
  getDisplayedClockString,
  getDisplayedLiveFutureEfficiency,
  getGameplayCardsPerHand,
  getGameplayClueChoicesForPlayer,
  hasClueTokenForVariant,
  type LiveClock,
} from '../../game/selectors/gameplay';
import { isQuickRematchEligible, isRestartToPregameEligible } from '../../runtime/LobbyRuntime';
import { lobbyRuntime } from '../../runtime/application';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { roomActions } from '../../store/roomSlice';
import { ActionButton, Notice, useHanabTheme } from '../designSystem';
import { C17RewindScrubber } from './C17RewindScrubber';
import { ClueComposer } from './ClueComposer';
import { CompactTable } from './CompactTable';
import { AuthoritativePulse } from './AuthoritativePulse';
import { DiscardViewer } from './DiscardViewer';
import { CardKnowledgeDetails, CompactHandCardSummary, GameCard, VisibleHanabiCard } from './GameCard';
import { NoteEditor } from './NoteEditor';
import {
  getC17CardLaneWidth,
  getC17DenseLayout,
  getC17HandsRegionHeight,
  getC17WorkbenchHeight,
  hasC17AmbientRegionChanged,
  getRelativeOpponentIndices,
} from './c17DenseLayout';
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
import { getCommittedClueMarkerForMetadata, getPreviewClueMarker } from './clueIndication';

type C17ReviewSelection = {
  actionSegment: number;
  liveSegmentAtEntry: number;
};

const END_CONDITIONS: Record<number, string> = {
  0: 'In progress', 1: 'Normal completion', 2: 'Strikeout', 3: 'Timeout',
  4: 'Terminated by player', 5: 'Speedrun failed', 6: 'Idle timeout',
  7: 'Character softlock', 8: 'All or Nothing failed',
  9: 'All or Nothing softlock', 10: 'Terminated by vote',
};

const HAND_ROW_HORIZONTAL_PADDING = 4;
const HAND_ROW_BORDER_WIDTH = 1;
const HAND_CARD_GAP = 3;

export function C17GameScreen() {
  const { theme } = useHanabTheme();
  const { width, height } = useWindowDimensions();
  const orientation = width > height ? 'landscape' : 'portrait';
  const orientationRef = useRef(orientation);
  const dispatch = useAppDispatch();
  const sessionPhase = useAppSelector((state) => state.session.phase);
  const hyphenatedConventions = useAppSelector((state) => {
    const userID = state.session.authenticatedUser?.userID;
    return userID !== undefined && state.lobby.users.entities[userID]?.hyphenated === true;
  });
  const roomState = useAppSelector((state) => state.room);
  const liveRoom = roomState.room.kind === 'live_game' ? roomState.room : null;
  const clientState = liveRoom?.clientState ?? null;
  const hypothetical = clientState?.replay.hypothetical ?? null;
  const hypotheticalActive = hypothetical !== null;
  const game = hypothetical?.ongoing ?? clientState?.visibleState ?? null;
  const isFinishedReplay = clientState?.finished === true;
  const isSharedReplay = clientState?.replay.shared !== null;
  const isPlayingPlayer = liveRoom?.role === 'player' && clientState?.playing === true
    && !isFinishedReplay && !isSharedReplay;
  const isSpectator = liveRoom?.role === 'spectator';
  const ourIndex = clientState?.metadata.ourPlayerIndex ?? null;
  const hypotheticalActor = hypothetical?.ongoing.turn.currentPlayerIndex ?? null;
  const actionHandIndex = hypotheticalActive ? hypotheticalActor : ourIndex;
  const ourHand = useMemo(() => actionHandIndex === null ? [] : game?.hands[actionHandIndex] ?? [], [actionHandIndex, game]);
  const canHypotheticalControl = hypotheticalActive && (clientState?.replay.shared === null || clientState?.replay.shared.amLeader === true);
  const hypotheticalOperationPending = liveRoom !== null
    && roomState.pendingHypotheticalOperation?.connectionEpoch === roomState.connectionEpoch
    && roomState.pendingHypotheticalOperation.tableID === liveRoom.tableID
    && roomState.pendingHypotheticalOperation.gameLoadEpoch === liveRoom.gameLoadEpoch;
  const clueTargets = useMemo(() => (isPlayingPlayer || canHypotheticalControl) ? clientState?.metadata.playerNames
    .map((_, index) => index)
    .filter((index) => index !== actionHandIndex) ?? [] : [], [actionHandIndex, canHypotheticalControl, clientState, isPlayingPlayer]);
  const empathyPlayers = useMemo(() => clientState?.metadata.playerNames
    .map((_, index) => index) ?? [], [clientState]);
  const [interaction, interactionDispatch] = useReducer(gameplayInteractionReducer, initialGameplayInteractionState);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [discardViewerOpen, setDiscardViewerOpen] = useState(false);
  const [note, setNote] = useState('');
  const [noteWarning, setNoteWarning] = useState<string | null>(null);
  const [c17Review, setC17Review] = useState<C17ReviewSelection | null>(null);
  const longPressedOpponent = useRef<number | null>(null);

  useEffect(() => {
    if (orientationRef.current === orientation) return;
    orientationRef.current = orientation;
    longPressedOpponent.current = null;
    interactionDispatch({ type: 'reset-lifecycle-transients' });
  }, [orientation]);

  const liveNoteOrders = useMemo(() => getLiveNoteOrders(game), [game]);
  useEffect(() => {
    interactionDispatch({
      type: 'sync-hands',
      ownOrders: ourHand,
      clueTargets,
      empathyPlayers,
      visibleOrders: liveNoteOrders,
    });
  }, [clueTargets, empathyPlayers, liveNoteOrders, ourHand]);

  const replayActive = clientState?.replay.active ?? false;
  useEffect(() => {
    interactionDispatch({ type: 'disarm-gameplay' });
    if (!replayActive) setC17Review(null);
  }, [replayActive]);

  useEffect(() => {
    if (!isPlayingPlayer) interactionDispatch({ type: 'disarm-gameplay' });
  }, [isPlayingPlayer]);

  useEffect(() => {
    if (hypotheticalActive) interactionDispatch({ type: 'disarm-gameplay' });
  }, [hypotheticalActive, hypothetical?.ongoing.turn.currentPlayerIndex, hypothetical?.ongoing.turn.segment]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      longPressedOpponent.current = null;
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

  if (liveRoom === null || clientState === null || game === null || ourIndex === null) return null;

  const { metadata, replay, ongoingGame } = clientState;
  const liveClock = metadata.options.timed === true
    && !clientState.finished
    && !replay.active
    && !hypotheticalActive
    && !liveRoom.sharedReplay
    && ongoingGame.turn.currentPlayerIndex !== null
    && liveRoom.clock !== null
    ? liveRoom.clock
    : null;
  const latest = ongoingGame.turn.segment ?? 0;
  const selectedCard = isPlayingPlayer || canHypotheticalControl ? interaction.selectedCard : null;
  const selectedTarget = isPlayingPlayer || canHypotheticalControl ? interaction.clueTarget : null;
  const isOurTurn = isPlayingPlayer && game.turn.currentPlayerIndex === ourIndex;
  const enabled = isPlayingPlayer
    && sessionPhase === 'ready'
    && isOurTurn
    && !replay.active
    && !clientState.pause.active
    && roomState.pendingGameplayAction === null;
  const hypotheticalEnabled = canHypotheticalControl && hypotheticalActor !== null
    && !hypotheticalOperationPending;
  const cardEnabled = (enabled || hypotheticalEnabled) && selectedCard !== null && ourHand.some((order) => order === selectedCard);
  const discardEnabled = cardEnabled
    && canDiscardForVariant(game.clueTokens, metadata.options.variantName);
  const clueChoices = getGameplayClueChoicesForPlayer(metadata);
  const clueEnabled = (enabled || hypotheticalEnabled)
    && hasClueTokenForVariant(game.clueTokens, metadata.options.variantName)
    && selectedTarget !== null;
  const notesEditable = !hypotheticalActive && sessionPhase === 'ready'
    && !clientState.finished
    && !liveRoom.sharedReplay
    && noteCard !== null
    && clientState.notes.ourNotes[noteCard] !== undefined;
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
      setNoteWarning(getNoteImpossibilityWarning({
        card: game.deck[noteCard ?? -1],
        noteText: value,
        ourPlayerIndex: metadata.ourPlayerIndex,
        variantName: metadata.options.variantName,
      }));
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
      hypotheticalActive ? {
        cardIdentities: clientState.cardIdentities,
        morphedIdentities: hypothetical!.morphedIdentities,
        notes: clientState.notes.ourNotes,
        playing: clientState.playing,
      } : undefined,
    );
  const targetName = selectedTarget === null
    ? null
    : metadata.playerNames[selectedTarget] ?? `Player ${selectedTarget + 1}`;
  const confirmClue = () => {
    if (!clueEnabled || selectedTarget === null || interaction.cluePreview === null) return;
    const sent = hypotheticalActive
      ? interaction.cluePreview.type === 'color'
        ? lobbyRuntime.hypotheticalColorClue(selectedTarget, interaction.cluePreview.value)
        : lobbyRuntime.hypotheticalRankClue(selectedTarget, interaction.cluePreview.value)
      : interaction.cluePreview.type === 'color'
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
  const reviewTemporal = isFinishedReplay || isSharedReplay
    ? getC17TemporalContext({
      states: replay.states,
      selectedSegment: replay.segment,
      variantName: metadata.options.variantName,
    })
    : replay.active && c17Review !== null
    ? getC17TemporalContext({
      states: replay.states,
      selectedSegment: c17Review.actionSegment,
      variantName: metadata.options.variantName,
    })
    : liveTemporal;
  const newerActionCount = !isFinishedReplay && !isSharedReplay && replay.active && c17Review !== null
    ? countC17TemporalStatesAfter(replay.states, c17Review.liveSegmentAtEntry)
    : 0;
  const recentTemporal = isFinishedReplay || isSharedReplay || replay.active && c17Review !== null
    ? reviewTemporal
    : liveTemporal;
  const recentActions = [...recentTemporal.recent, recentTemporal.last]
    .filter((entry, index, entries) => entry.segment > 0
      && entries.findIndex((candidate) => candidate.segment === entry.segment) === index)
    .slice(-Math.max(5, metadata.playerNames.length));
  const actionSegments = replay.states.flatMap((state, segment) => state === undefined ? [] : [segment]);
  const firstActionSegment = actionSegments[0] ?? null;
  const lastActionSegment = actionSegments.at(-1) ?? null;
  const liveBefore = liveTemporal.beforeSegment === null ? undefined : replay.states[liveTemporal.beforeSegment];
  const livePulseSegment = !hypotheticalActive && !isFinishedReplay && !isSharedReplay
    && liveTemporal.last.segment > 0 && liveBefore !== undefined
    ? liveTemporal.last.segment
    : null;

  const disarmGameplay = () => interactionDispatch({ type: 'disarm-gameplay' });
  const jumpToAction = (actionSegment: number) => {
    const temporal = getC17TemporalContext({
      states: replay.states,
      selectedSegment: actionSegment,
      variantName: metadata.options.variantName,
    });
    disarmGameplay();
    if (!isFinishedReplay && !isSharedReplay) {
      setC17Review({
        actionSegment: temporal.selectedSegment,
        liveSegmentAtEntry: c17Review?.liveSegmentAtEntry ?? latest,
      });
    }
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
    if (isFinishedReplay || isSharedReplay) return;
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
  const gameOver = [...replay.actions].reverse().find((action) => action.type === 'gameOver');
  const endCondition = liveRoom.gameHistory?.endCondition
    ?? (gameOver?.type === 'gameOver' ? gameOver.endCondition : null);
  const result = isFinishedReplay ? {
    score: ongoingGame.score,
    reason: endCondition === null ? null : END_CONDITIONS[endCondition] ?? `End condition ${endCondition}`,
  } : null;
  const canQuickRematch = sessionPhase === 'ready'
    && isQuickRematchEligible(clientState, roomState.pendingRestartTableID)
    && (replay.shared === null || replay.shared.amLeader);
  const canRemake = sessionPhase === 'ready'
    && isRestartToPregameEligible(clientState, roomState.pendingRestartTableID)
    && (replay.shared === null || replay.shared.amLeader);
  const canStartHypothetical = replay.active && !hypotheticalActive
    && (replay.shared === null || replay.shared.amLeader);

  return <>
    <C17DenseWorkspace
      actionSegments={actionSegments}
      canPlayCard={cardEnabled}
      canDiscardCard={discardEnabled}
      canPlayGameplay={isPlayingPlayer || canHypotheticalControl}
      canStartHypothetical={canStartHypothetical}
      canQuickRematch={canQuickRematch}
      canRemake={canRemake}
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
      hypothetical={hypothetical}
      hypotheticalActor={hypotheticalActor}
      hypotheticalController={canHypotheticalControl}
      hypotheticalOperationPending={hypotheticalOperationPending}
      globalEmpathy={interaction.globalEmpathy}
      historyAvailable={recentActions.length > 0}
      hyphenatedConventions={hyphenatedConventions}
      isSpectator={isSpectator}
      lastAction={reviewTemporal.last.summary}
      liveBefore={liveBefore}
      liveClock={liveClock}
      clockPaused={clientState.pause.active}
      livePulseSegment={livePulseSegment}
      livePulseEnabled={!replay.active}
      liveTransition={liveTemporal.last}
      liveTurn={liveTemporal.liveTurn}
      longPressedOpponent={longPressedOpponent}
      metadata={metadata}
      newerActionCount={newerActionCount}
      noteCard={noteCard}
      notes={clientState.notes.ourNotes}
      replayNotes={clientState.notes.allNotes}
      onClearCluePreview={() => interactionDispatch({ type: 'clear-clue-preview' })}
      onCloseNote={() => interactionDispatch({ type: 'open-note', order: null })}
      onConfirmClue={confirmClue}
      onDiscard={() => {
        if (discardEnabled && selectedCard !== null) {
          const sent = hypotheticalActive ? lobbyRuntime.hypotheticalDiscard(selectedCard) : lobbyRuntime.discard(selectedCard);
          if (sent) interactionDispatch({ type: 'disarm-gameplay' });
        }
      }}
      onEditNote={editNote}
      onEnterRewind={enterRewind}
      onHoldEmpathy={(playerIndex) => interactionDispatch({ type: 'hold-empathy', playerIndex })}
      onInspectNote={inspectNote}
      onOpenDiscards={() => setDiscardViewerOpen(true)}
      onPlay={() => {
        if (cardEnabled && selectedCard !== null) {
          const sent = hypotheticalActive ? lobbyRuntime.hypotheticalPlay(selectedCard) : lobbyRuntime.play(selectedCard);
          if (sent) interactionDispatch({ type: 'disarm-gameplay' });
        }
      }}
      onPreviewClue={(clueType, value) => interactionDispatch({ type: 'preview-clue', clueType, value })}
      onReviewBack={() => navigateReviewAction('back')}
      onReviewEnd={() => jumpReviewEdge('end')}
      onReviewForward={() => navigateReviewAction('forward')}
      onReviewStart={() => jumpReviewEdge('start')}
      onReturnLive={returnLive}
      onQuickRematch={() => lobbyRuntime.quickRematch()}
      onRemake={() => lobbyRuntime.restartToPregame()}
      onScrubAction={jumpToAction}
      onSelectCard={(order) => {
        if ((isPlayingPlayer && !replay.active) || canHypotheticalControl) {
          interactionDispatch({ type: 'select-card', order });
        }
        inspectNote(order);
      }}
      onSelectClueTarget={(playerIndex) => interactionDispatch({ type: 'select-clue-target', playerIndex })}
      onSelectRecentAction={jumpToAction}
      onToggleGlobalEmpathy={() => interactionDispatch({ type: 'toggle-global-empathy' })}
      onStartHypothetical={() => { if (lobbyRuntime.startHypothetical()) interactionDispatch({ type: 'disarm-gameplay' }); }}
      onEndHypothetical={() => { if (lobbyRuntime.endHypothetical()) interactionDispatch({ type: 'disarm-gameplay' }); }}
      onBackHypothetical={() => { if (lobbyRuntime.backHypothetical()) interactionDispatch({ type: 'disarm-gameplay' }); }}
      onToggleHypotheticalDrawn={() => lobbyRuntime.toggleHypotheticalDrawnCards()}
      ourIndex={actionHandIndex ?? ourIndex}
      pendingText={pendingText ?? null}
      canEnterClue={enabled || hypotheticalEnabled}
      recentActions={recentActions}
      result={result}
      reviewActive={!hypotheticalActive && (isFinishedReplay || replay.active || isSharedReplay)}
      finishedReplay={isFinishedReplay}
      selectedActionSegment={reviewTemporal.selectedSegment}
      selectedCard={selectedCard}
      selectedTarget={selectedTarget}
      selectedTurn={reviewTemporal.selectedTurn}
      sharedReplay={replay.shared}
      speedrun={metadata.options.speedrun}
      targetName={targetName}
      variantName={metadata.options.variantName}
    />
    {clientState.pause.active && <Notice tone="error">Game paused</Notice>}
    {noteWarning !== null && <View style={[styles.noteWarning, { borderColor: theme.colors.warning }]}>
      <Text style={[styles.noteWarningText, { color: theme.colors.warning }]}>{noteWarning}</Text>
    </View>}
    <DiscardViewer
      game={game}
      onClose={() => setDiscardViewerOpen(false)}
      variantName={metadata.options.variantName}
      visible={discardViewerOpen}
    />
    <NoteEditor
      editable={notesEditable}
      onChange={setNote}
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
  canPlayCard,
  canDiscardCard,
  canPlayGameplay,
  canStartHypothetical,
  canQuickRematch,
  canRemake,
  canReviewBack,
  canReviewForward,
  cardIdentities,
  cardsPerHand,
  canEnterClue,
  clueChoices,
  clueEnabled,
  cluePreview,
  cluePreviewState,
  clockPaused,
  empathyPlayer,
  futureEfficiency,
  game,
  hypothetical,
  hypotheticalActor,
  hypotheticalController,
  hypotheticalOperationPending,
  globalEmpathy,
  historyAvailable,
  hyphenatedConventions,
  isSpectator,
  lastAction,
  liveBefore,
  liveClock,
  livePulseSegment,
  livePulseEnabled,
  liveTransition,
  liveTurn,
  longPressedOpponent,
  metadata,
  newerActionCount,
  noteCard,
  notes,
  replayNotes,
  onClearCluePreview,
  onCloseNote,
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
  onQuickRematch,
  onRemake,
  onScrubAction,
  onSelectCard,
  onSelectClueTarget,
  onSelectRecentAction,
  onToggleGlobalEmpathy,
  onStartHypothetical,
  onEndHypothetical,
  onBackHypothetical,
  onToggleHypotheticalDrawn,
  ourIndex,
  pendingText,
  recentActions,
  result,
  reviewActive,
  finishedReplay,
  selectedActionSegment,
  selectedCard,
  selectedTarget,
  selectedTurn,
  sharedReplay,
  speedrun,
  targetName,
  variantName,
}: {
  actionSegments: readonly number[];
  canPlayCard: boolean;
  canDiscardCard: boolean;
  canPlayGameplay: boolean;
  canStartHypothetical: boolean;
  canQuickRematch: boolean;
  canRemake: boolean;
  canReviewBack: boolean;
  canReviewForward: boolean;
  cardIdentities: readonly CardIdentity[];
  cardsPerHand: number;
  canEnterClue: boolean;
  clueChoices: ReturnType<typeof getGameplayClueChoicesForPlayer>;
  clueEnabled: boolean;
  cluePreview: ReturnType<typeof getCluePreview> | null;
  cluePreviewState: { type: 'color' | 'rank'; value: number } | null;
  clockPaused: boolean;
  empathyPlayer: number | null;
  futureEfficiency: number | null;
  game: GameState;
  hypothetical: HypotheticalState | null;
  hypotheticalActor: number | null;
  hypotheticalController: boolean;
  hypotheticalOperationPending: boolean;
  globalEmpathy: boolean;
  historyAvailable: boolean;
  hyphenatedConventions: boolean;
  isSpectator: boolean;
  lastAction: string;
  liveBefore: GameState | undefined;
  liveClock: LiveClock | null;
  livePulseSegment: number | null;
  livePulseEnabled: boolean;
  liveTransition: C17TemporalEntry;
  liveTurn: number;
  longPressedOpponent: { current: number | null };
  metadata: GameMetadata;
  newerActionCount: number;
  noteCard: number | null;
  notes: readonly CardNote[];
  replayNotes: ReadonlyArray<ReadonlyArray<{ name: string; text: string }>>;
  onClearCluePreview: () => void;
  onCloseNote: () => void;
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
  onQuickRematch: () => void;
  onRemake: () => void;
  onScrubAction: (segment: number) => void;
  onSelectCard: (order: number) => void;
  onSelectClueTarget: (playerIndex: number | null) => void;
  onSelectRecentAction: (segment: number) => void;
  onToggleGlobalEmpathy: () => void;
  onStartHypothetical: () => void;
  onEndHypothetical: () => void;
  onBackHypothetical: () => void;
  onToggleHypotheticalDrawn: () => void;
  ourIndex: number;
  pendingText: string | null;
  recentActions: readonly C17TemporalEntry[];
  result: { score: number; reason: string | null } | null;
  reviewActive: boolean;
  finishedReplay: boolean;
  selectedActionSegment: number;
  selectedCard: number | null;
  selectedTarget: number | null;
  selectedTurn: number;
  sharedReplay: { amLeader: boolean; leader: string; segment: number; useSharedSegments: boolean } | null;
  speedrun: boolean;
  targetName: string | null;
  variantName: string;
}) {
  const { theme } = useHanabTheme();
  const { width: viewportWidth, height: viewportHeight, fontScale } = useWindowDimensions();
  const [recentOpen, setRecentOpen] = useState(false);
  const committedClue = getLastCluePresentationFromState(game);
  const opponents = getRelativeOpponentIndices(metadata.playerNames.length, ourIndex);
  const workbenchHeight = getC17WorkbenchHeight(viewportHeight);
  const shellKey = `${Math.round(viewportWidth)}:${Math.round(viewportHeight)}:${fontScale.toFixed(2)}:${opponents.length}:${cardsPerHand}:${workbenchHeight}`;
  const [layoutMetrics, setLayoutMetrics] = useState({
    shellKey: '',
    ambientBodyHeight: 0,
    ambientBodyWidth: 0,
  });
  useEffect(() => {
    if (reviewActive) setRecentOpen(false);
  }, [reviewActive]);

  const shellMeasured = layoutMetrics.shellKey === shellKey
    && layoutMetrics.ambientBodyHeight > 0
    && layoutMetrics.ambientBodyWidth > 0;
  const handsRegionHeight = getC17HandsRegionHeight(layoutMetrics.ambientBodyHeight, workbenchHeight);
  const cardLaneWidth = getC17CardLaneWidth(layoutMetrics.ambientBodyWidth);
  const layout = getC17DenseLayout({
    opponentCardLaneWidth: cardLaneWidth,
    handsRegionHeight,
    ownCardLaneWidth: cardLaneWidth,
    opponentCount: opponents.length,
    cardsPerHand,
    workbenchHeight,
  });
  const captureAmbientBody = ({ nativeEvent: { layout: next } }: LayoutChangeEvent) => {
    setLayoutMetrics((currentMetrics) => {
      const sameShell = currentMetrics.shellKey === shellKey;
      if (sameShell && !hasC17AmbientRegionChanged(
        { height: currentMetrics.ambientBodyHeight, width: currentMetrics.ambientBodyWidth },
        { height: next.height, width: next.width },
      )) return currentMetrics;
      return {
        shellKey,
        ambientBodyHeight: next.height,
        ambientBodyWidth: next.width,
      };
    });
  };

  const current = game.turn.currentPlayerIndex;
  const actorPulse = liveBefore !== undefined && liveBefore.turn.currentPlayerIndex !== current ? livePulseSegment : null;
  const resourcePulse = (before: number, after: number) => before !== after ? livePulseSegment : null;
  const playPulse = livePulseSegment !== null && liveTransition.actionType === 'play' && liveTransition.cardOrder !== null
    ? { segment: livePulseSegment, suitIndex: game.deck[liveTransition.cardOrder]?.suitIndex ?? -1 }
    : null;
  const discardPulse = liveTransition.actionType === 'discard' ? livePulseSegment : null;
  const sourcePulse = (index: number) => (
    (liveTransition.actionType === 'play' || liveTransition.actionType === 'discard')
      && liveTransition.actorIndex === index ? livePulseSegment : null
  );
  const clueTargetPulse = (index: number) => (
    liveTransition.actionType === 'clue'
      && liveTransition.targetIndex === index ? livePulseSegment : null
  );
  const cluePulse = (index: number, position: number) => (
    liveTransition.actionType === 'clue'
      && liveTransition.targetIndex === index
      && liveTransition.touchedSlots.includes(position + 1) ? livePulseSegment : null
  );
  const currentName = current === null ? 'No current player' : metadata.playerNames[current] ?? `Player ${current + 1}`;
  const ownHand = getDisplayedHandOrders(game.hands[ourIndex]);
  const displayIdentity = (order: number) => hypothetical?.morphedIdentities[order] ?? cardIdentities[order];
  const hasExplicitBlankMorph = (order: number) => {
    const morph = hypothetical?.morphedIdentities[order];
    return morph?.suitIndex === null && morph.rank === null;
  };
  const startingHandHidden = !hypothetical?.showDrawnCards && hypothetical?.startingPlayerIndex !== null;
  const selectedOwnCard = selectedCard !== null && ownHand.some((order) => order === selectedCard) ? selectedCard : null;
  const inspectedNote = noteCard === null ? '' : notes[noteCard]?.text ?? '';
  const readOnlyReplay = finishedReplay || sharedReplay !== null;
  const inspectedReplayNotes = noteCard === null
    ? []
    : replayNotes[noteCard]?.filter((entry) => entry.text.trim().length > 0) ?? [];
  const hasAvailableNote = (order: number) => readOnlyReplay
    ? (replayNotes[order]?.some((entry) => entry.text.trim().length > 0) ?? false)
    : (notes[order]?.text.trim().length ?? 0) > 0;
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
  const showWorkbench = hypothetical !== null || reviewActive || finishedReplay || sharedReplay !== null
    || selectedTarget !== null || selectedOwnCard !== null || noteCard !== null || pendingText !== null;
  return <View style={styles.workspace}>
    <View style={styles.ledgerChrome}>
      <View style={[styles.hud, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.grow}>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>{sharedReplay !== null
            ? `SHARED REVIEW T${selectedTurn}`
            : hypothetical !== null
              ? 'HYPOTHETICAL'
            : finishedReplay
            ? `REPLAY T${selectedTurn}${selectedActionSegment === actionSegments.at(-1) ? ' · END' : ''}`
            : reviewActive ? `REWIND T${selectedTurn}` : `LIVE T${liveTurn}`}</Text>
          <AuthoritativePulse enabled={livePulseEnabled} pulseKey={actorPulse}><Text numberOfLines={1} style={[styles.turn, { color: theme.colors.text }]}>{canPlayGameplay && current === ourIndex ? 'YOUR TURN' : currentName}</Text></AuthoritativePulse>
        </View>
        <HudStat label="Score" pulseEnabled={livePulseEnabled} pulseKey={liveBefore === undefined ? null : resourcePulse(liveBefore.score, game.score)} value={game.score} />
        <HudStat label="Max" value={game.stats.maxScore} />
        <HudStat label="Clues" pulseEnabled={livePulseEnabled} pulseKey={liveBefore === undefined ? null : resourcePulse(getDisplayedClueTokens(liveBefore.clueTokens, variantName), getDisplayedClueTokens(game.clueTokens, variantName))} value={getDisplayedClueTokens(game.clueTokens, variantName)} />
        <HudStat label="Strikes" pulseEnabled={livePulseEnabled} pulseKey={liveBefore === undefined ? null : resourcePulse(liveBefore.strikes.length, game.strikes.length)} value={game.strikes.length} />
        <HudStat label="Deck" pulseEnabled={livePulseEnabled} pulseKey={liveBefore === undefined ? null : resourcePulse(liveBefore.cardsRemainingInTheDeck, game.cardsRemainingInTheDeck)} value={game.cardsRemainingInTheDeck} />
        {game.stats.pace !== null && <HudStat label="Pace" value={game.stats.pace} />}
        {futureEfficiency !== null && <HudStat label="FRE" value={futureEfficiency.toFixed(2)} />}
      </View>

      {result !== null && <View style={[styles.result, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
        <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>FINAL SCORE · {result.score}</Text>
        {result.reason !== null && <Text style={[styles.resultReason, { color: theme.colors.text }]}>{result.reason}</Text>}
        {(canQuickRematch || canRemake) && <View style={styles.actionButtons}>
          {canQuickRematch && <ActionButton compact title="Quick rematch" tone="primary" onPress={onQuickRematch} />}
          {canRemake && <ActionButton compact title="Remake table" onPress={onRemake} />}
        </View>}
      </View>}

      <CompactTable dense game={game} onOpenDiscards={onOpenDiscards} pulseDiscard={discardPulse} pulseEnabled={livePulseEnabled} pulsePlay={playPulse} variantName={variantName} />

      <AuthoritativePulse enabled={livePulseEnabled} pulseKey={livePulseSegment}><View style={[styles.lastAction, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
        <View style={[styles.rowBetween, styles.lastActionHeader]}>
          <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>{reviewActive ? `LAST ACTION · T${selectedTurn}` : 'LAST ACTION'}</Text>
          {!reviewActive && <ActionButton compact disabled={!historyAvailable} title="Rewind" onPress={onEnterRewind} />}
        </View>
        <Pressable disabled={!historyAvailable} onPress={() => setRecentOpen(true)} style={styles.lastActionPressable}>
          <Text numberOfLines={1} style={[styles.lastActionText, { color: theme.colors.text }]}>{lastAction}</Text>
          <Text style={[styles.link, { color: historyAvailable ? theme.colors.accent : theme.colors.textMuted }]}>RECENT ›</Text>
        </Pressable>
      </View></AuthoritativePulse>
    </View>

    <View onLayout={captureAmbientBody} style={styles.workspaceBody}>
      <View
        style={[
          styles.hands,
          shellMeasured ? { height: layout.handsHeight } : styles.handsPending,
          !shellMeasured && styles.shellPending,
        ]}
      >
      <View style={styles.opponents}>
        {opponents.map((index) => {
          const currentActor = current === index;
          const compact = layout.mode === 'compact-overview';
          const empathizing = globalEmpathy || empathyPlayer === index;
          const target = selectedTarget === index;
          const playerName = metadata.playerNames[index] ?? `Player ${index + 1}`;
          return <AuthoritativePulse enabled={livePulseEnabled} key={index} pulseKey={compact ? (clueTargetPulse(index) ?? sourcePulse(index)) : sourcePulse(index)}><Pressable
            accessibilityLabel={`Player ${playerName}`}
            accessibilityRole="button"
            delayLongPress={350}
            onPressIn={() => { longPressedOpponent.current = null; }}
            onLongPress={globalEmpathy ? undefined : () => {
              longPressedOpponent.current = index;
              onHoldEmpathy(index);
            }}
            onPress={() => {
              if (longPressedOpponent.current === index) {
                longPressedOpponent.current = null;
                return;
              }
              if (canEnterClue) onSelectClueTarget(index);
            }}
            onPressOut={globalEmpathy ? undefined : () => onHoldEmpathy(null)}
            style={[
              styles.opponentRow,
              compact && styles.compactOpponentRow,
              { height: layout.opponentRowHeight },
              currentActor && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.accent },
              target && { borderColor: theme.colors.accent },
            ]}
          >
            <View style={compact ? styles.compactOpponentNameLane : styles.opponentMeta}>
              <View style={styles.namePeekArea}>
                <Text numberOfLines={1} style={[styles.opponentName, { color: currentActor ? theme.colors.accent : theme.colors.text }]}>
                  {playerName}{currentActor ? ' · TURN' : ''}
                </Text>
                {liveClock !== null && <C17LiveClockText
                  clock={liveClock}
                  paused={clockPaused}
                  playerIndex={index}
                />}
              </View>
            </View>
            <View style={compact ? styles.compactOpponentCards : [styles.opponentCards, { marginTop: 2 + layout.cardTopHeadroom }]}>
              {getDisplayedHandOrders(game.hands[index]).map((order, position) => {
                const card = game.deck[order];
                if (card === undefined) return null;
                const cardNote = notes[order];
                const forcedStartingEmpathy = startingHandHidden && hypothetical?.startingPlayerIndex === index;
                const normalKnowledge = getCardKnowledgeViewModel(variantName, card, cardNote, false, false, displayIdentity(order), hasExplicitBlankMorph(order));
                const empathyKnowledge = empathizing || forcedStartingEmpathy
                  ? getCardKnowledgeViewModel(variantName, card, cardNote, false, true, displayIdentity(order), hasExplicitBlankMorph(order))
                  : null;
                const activeKnowledge = empathyKnowledge ?? normalKnowledge;
                const statePresentation = getCardStatePresentation({
                  game,
                  state: card,
                  note: cardNote,
                  displaySuitIndex: activeKnowledge.displaySuitIndex,
                  displayRank: activeKnowledge.displayRank,
                  empathy: empathizing,
                  finished: finishedReplay,
                  variantName,
                  speedrun,
                  hyphenatedConventions,
                  hardVariant: metadata.hardVariant,
                });
                const cardProps = {
                  empathyKnowledge,
                  hasNote: hasAvailableNote(order),
                  height: layout.opponentCardHeight,
                  clueMarker: getCommittedClueMarkerForMetadata(committedClue, order, card.numPositiveClues, metadata),
                  previewMarker: target && (cluePreview?.touchedOrders.includes(order) ?? false)
                    ? getPreviewClueMarker(cluePreviewState, card.numPositiveClues, clueChoices) : null,
                  onDoublePress: readOnlyReplay || hypothetical !== null ? undefined : () => onEditNote(order),
                  onLongPress: globalEmpathy ? undefined : () => onHoldEmpathy(index),
                  onPress: () => onInspectNote(order),
                  onPressOut: globalEmpathy ? undefined : () => onHoldEmpathy(null),
                  position,
                  rank: hypothetical === null ? card.rank : normalKnowledge.displayRank,
                  semanticBorder: normalKnowledge.borderColor,
                  statePresentation,
                  suitIndex: hypothetical === null ? card.suitIndex : normalKnowledge.displaySuitIndex,
                  variantName,
                };
                return compact
                  ? <CompactHandCardSummary key={order} {...cardProps} />
                  : <AuthoritativePulse enabled={livePulseEnabled} key={order} pulseKey={cluePulse(index, position)}>
                    <VisibleHanabiCard {...cardProps} cardTopHeadroom={layout.cardTopHeadroom} size="hand" />
                  </AuthoritativePulse>;
              })}
            </View>
          </Pressable></AuthoritativePulse>;
        })}
      </View>

      <AuthoritativePulse enabled={livePulseEnabled} pulseKey={sourcePulse(ourIndex)}><Pressable
        delayLongPress={350}
        disabled={globalEmpathy}
        onLongPress={() => onHoldEmpathy(ourIndex)}
        onPressOut={() => onHoldEmpathy(null)}
        style={[styles.ownHand, { height: layout.ownRowHeight, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <View style={styles.ownTitleLane}>
          <Text numberOfLines={1} style={[styles.ownTitle, { color: theme.colors.text }]}>{hypothetical !== null
            ? `ACTOR · ${metadata.playerNames[ourIndex] ?? `P${ourIndex + 1}`}`
            : isSpectator ? 'OBSERVED HAND' : 'YOUR HAND'}</Text>
          {liveClock !== null && <C17LiveClockText
            clock={liveClock}
            paused={clockPaused}
            playerIndex={ourIndex}
          />}
        </View>
        <View style={[styles.ownCards, { marginTop: 2 + layout.cardTopHeadroom }]}>
          {ownHand.map((order, position) => {
            const card = game.deck[order];
            if (card === undefined) return null;
            const ownEmpathy = globalEmpathy || empathyPlayer === ourIndex
              || (startingHandHidden && hypothetical?.startingPlayerIndex === ourIndex);
            const cardNote = notes[order];
            const knowledge = getCardKnowledgeViewModel(variantName, card, cardNote, false, ownEmpathy, displayIdentity(order), hasExplicitBlankMorph(order));
            const statePresentation = getCardStatePresentation({
              game,
              state: card,
              note: cardNote,
              displaySuitIndex: knowledge.displaySuitIndex,
              displayRank: knowledge.displayRank,
              empathy: ownEmpathy,
              finished: finishedReplay,
              variantName,
              speedrun,
              hyphenatedConventions,
              hardVariant: metadata.hardVariant,
            });
            return <AuthoritativePulse enabled={livePulseEnabled} key={order} pulseKey={cluePulse(ourIndex, position)}><GameCard
              hasNote={hasAvailableNote(order)}
              height={layout.ownCardHeight}
              knowledge={knowledge}
              clueMarker={getCommittedClueMarkerForMetadata(committedClue, order, card.numPositiveClues, metadata)}
              previewMarker={selectedTarget === ourIndex && (cluePreview?.touchedOrders.includes(order) ?? false)
                ? getPreviewClueMarker(cluePreviewState, card.numPositiveClues, clueChoices) : null}
              cardTopHeadroom={layout.cardTopHeadroom}
              onDoublePress={readOnlyReplay || hypothetical !== null ? undefined : () => onEditNote(order)}
              onLongPress={globalEmpathy ? undefined : () => onHoldEmpathy(ourIndex)}
              onPressOut={globalEmpathy ? undefined : () => onHoldEmpathy(null)}
              onSelect={() => onSelectCard(order)}
              position={position}
              selected={selectedOwnCard === order}
              statePresentation={statePresentation}
              variantName={variantName}
            /></AuthoritativePulse>;
          })}
        </View>
      </Pressable></AuthoritativePulse>
      </View>

      {(!shellMeasured || showWorkbench) ? <View style={[
      styles.workbench,
      { minHeight: layout.workbenchHeight, backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong },
      shellMeasured ? styles.workbenchExpanded : { height: layout.workbenchHeight },
      !shellMeasured && styles.shellPending,
    ]}>
      <ScrollView contentContainerStyle={styles.workbenchContent} nestedScrollEnabled style={styles.workbenchScroll}>
        {hypothetical !== null ? <>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>HYPOTHETICAL · ACTOR {hypotheticalActor === null ? '—' : metadata.playerNames[hypotheticalActor] ?? `P${hypotheticalActor + 1}`}</Text>
          {hypotheticalController ? <View style={styles.actionButtons}>
            <ActionButton compact disabled={hypotheticalOperationPending || hypothetical.states.length <= 1} title="Back" onPress={onBackHypothetical} />
            <ActionButton compact title="End Hypothetical" tone="primary" onPress={onEndHypothetical} />
            <ActionButton
              compact
              disabled={!canToggleHypotheticalDrawnCards(hypothetical)}
              title={hypothetical.showDrawnCards ? 'Hide drawn cards' : 'Reveal drawn cards'}
              onPress={onToggleHypotheticalDrawn}
            />
          </View> : <Text style={[styles.workbenchText, { color: theme.colors.textMuted }]}>Following the shared hypothetical branch.</Text>}
          {selectedTarget !== null ? <ClueComposer
            choices={clueChoices}
            variantName={variantName}
            enabled={clueEnabled}
            onClear={onClearCluePreview}
            onConfirm={onConfirmClue}
            onPreview={onPreviewClue}
            preview={cluePreview}
            previewState={cluePreviewState}
            targetName={targetName}
          /> : canPlayGameplay && selectedOwnCard !== null ? <View style={styles.rowBetween}>
            <Text style={[styles.workbenchText, { color: theme.colors.text }]}>Actor card {ownHand.findIndex((order) => order === selectedOwnCard) + 1}</Text>
            <View style={styles.actionButtons}>
              <ActionButton compact disabled={!canPlayCard} title="Play" tone="primary" onPress={onPlay} />
              <ActionButton compact disabled={!canDiscardCard} title="Discard" onPress={onDiscard} />
            </View>
          </View> : hypotheticalController ? <Text style={[styles.workbenchText, { color: theme.colors.textMuted }]}>Select a card from the hypothetical actor hand or a player to plan a clue.</Text> : null}
        </> : reviewActive && !finishedReplay && sharedReplay === null ? <>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>Rewind T{selectedTurn} · Live T{liveTurn}{newerActionCount > 0 ? ` · ${newerActionCount} NEW` : ''}</Text>
          <C17RewindScrubber actionSegments={actionSegments} onSelectSegment={onScrubAction} selectedSegment={selectedActionSegment} />
          <View style={styles.rowBetween}>
            <View style={styles.actionButtons}>
              <ActionButton compact disabled={!canReviewBack} title="← Back" onLongPress={onReviewStart} onPress={onReviewBack} />
              <ActionButton compact disabled={!canReviewForward} title="Forward →" onLongPress={onReviewEnd} onPress={onReviewForward} />
            </View>
            <ActionButton compact title={`Exit · Live T${liveTurn}`} tone="primary" onPress={onReturnLive} />
            <ActionButton compact title={globalEmpathy ? 'All empathy ✓' : 'All empathy'} tone={globalEmpathy ? 'primary' : 'ghost'} onPress={onToggleGlobalEmpathy} />
          </View>
          {canStartHypothetical && <ActionButton compact title="Start Hypothetical" tone="primary" onPress={onStartHypothetical} />}
          {noteCard !== null && <View style={styles.noteInspect}>
            <View style={styles.rowBetween}>
              <Text style={[styles.workbenchText, { color: theme.colors.text }]}>{getCardLabel(game, metadata.playerNames, noteCard)}</Text>
              <ActionButton compact title="Edit note" onPress={() => onEditNote(noteCard)} />
            </View>
            <Text numberOfLines={2} style={[styles.notePreview, { color: inspectedNote.trim().length > 0 ? theme.colors.text : theme.colors.textMuted }]}>
              {inspectedNote.trim().length > 0 ? inspectedNote : 'No saved note'}
            </Text>
            {inspectedKnowledge !== null && <CardKnowledgeDetails knowledge={inspectedKnowledge} variantName={variantName} />}
          </View>}
        </> : finishedReplay || sharedReplay !== null ? <>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>{sharedReplay === null
            ? `Replay T${selectedTurn}${selectedActionSegment === actionSegments.at(-1) ? ' · End' : ''}`
            : `SHARED REPLAY · Leader: ${sharedReplay.leader}`}</Text>
          {sharedReplay !== null && <View style={styles.noteInspect}>
            <Text style={[styles.workbenchText, { color: theme.colors.text }]}>{sharedReplay.amLeader
              ? 'You control the shared segment.'
              : sharedReplay.useSharedSegments
                ? `Following ${sharedReplay.leader} at shared segment ${sharedReplay.segment}.`
                : `Viewing segment ${selectedActionSegment}; shared segment is ${sharedReplay.segment}.`}</Text>
            {!sharedReplay.amLeader && !sharedReplay.useSharedSegments && <ActionButton compact title="Follow leader" tone="primary" onPress={() => lobbyRuntime.followReplayLeader()} />}
          </View>}
          <C17RewindScrubber actionSegments={actionSegments} onSelectSegment={onScrubAction} selectedSegment={selectedActionSegment} />
          <View style={styles.rowBetween}>
            <View style={styles.actionButtons}>
              <ActionButton compact disabled={!canReviewBack} title="Back" onLongPress={onReviewStart} onPress={onReviewBack} />
              <ActionButton compact disabled={!canReviewForward} title="Forward" onLongPress={onReviewEnd} onPress={onReviewForward} />
            </View>
            <ActionButton compact title={globalEmpathy ? 'All empathy ✓' : 'All empathy'} tone={globalEmpathy ? 'primary' : 'ghost'} onPress={onToggleGlobalEmpathy} />
          </View>
          {canStartHypothetical && <ActionButton compact title="Start Hypothetical" tone="primary" onPress={onStartHypothetical} />}
          {noteCard !== null && <View style={styles.noteInspect}>
            <Text style={[styles.workbenchText, { color: theme.colors.text }]}>{getCardLabel(game, metadata.playerNames, noteCard)}</Text>
            <Text style={[styles.notePreview, { color: inspectedReplayNotes.length > 0 ? theme.colors.text : theme.colors.textMuted }]}>
              {inspectedReplayNotes.length > 0
                ? inspectedReplayNotes.map((entry) => `${entry.name}: ${entry.text}`).join('\n')
                : 'No replay notes'}
            </Text>
            {inspectedKnowledge !== null && <CardKnowledgeDetails knowledge={inspectedKnowledge} variantName={variantName} />}
          </View>}
        </> : selectedTarget !== null ? <ClueComposer
          choices={clueChoices}
          variantName={variantName}
          enabled={clueEnabled}
          onClear={onClearCluePreview}
          onConfirm={onConfirmClue}
          onPreview={onPreviewClue}
          preview={cluePreview}
          previewState={cluePreviewState}
          targetName={targetName}
        /> : <>
          <View style={styles.rowBetween}>
            <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>DECISION WORKBENCH</Text>
            <View style={styles.actionButtons}>
              <ActionButton compact title={globalEmpathy ? 'All empathy ✓' : 'All empathy'} tone={globalEmpathy ? 'primary' : 'ghost'} onPress={onToggleGlobalEmpathy} />
            </View>
          </View>

          {canPlayGameplay && selectedOwnCard !== null && <View style={styles.rowBetween}>
            <Text style={[styles.workbenchText, { color: theme.colors.text }]}>Card {ownHand.findIndex((order) => order === selectedOwnCard) + 1}</Text>
            <View style={styles.actionButtons}>
              <ActionButton compact disabled={!canPlayCard} title="Play" tone="primary" onPress={onPlay} />
              <ActionButton compact disabled={!canDiscardCard} title="Discard" onPress={onDiscard} />
            </View>
          </View>}

          {noteCard !== null ? <View style={styles.noteInspect}>
            <View style={styles.rowBetween}>
              <Text style={[styles.workbenchText, { color: theme.colors.text }]}>{getCardLabel(game, metadata.playerNames, noteCard)}</Text>
              <View style={styles.actionButtons}><ActionButton compact title="Edit note" onPress={() => onEditNote(noteCard)} /><ActionButton compact title="Close" onPress={onCloseNote} /></View>
            </View>
            <Text numberOfLines={2} style={[styles.notePreview, { color: inspectedNote.trim().length > 0 ? theme.colors.text : theme.colors.textMuted }]}>
              {inspectedNote.trim().length > 0 ? inspectedNote : 'No saved note'}
            </Text>
            {inspectedKnowledge !== null && <CardKnowledgeDetails knowledge={inspectedKnowledge} variantName={variantName} />}
          </View> : selectedOwnCard === null
            ? <Text style={[styles.workbenchText, { color: theme.colors.textMuted }]}>Tap a card to inspect its note.</Text>
            : null}

          {pendingText !== null && <Text style={[styles.pendingText, { color: theme.colors.textMuted }]}>{pendingText}… awaiting server</Text>}
        </>}
      </ScrollView>
    </View> : <View style={styles.idleWorkbench}><ActionButton compact title={globalEmpathy ? 'All empathy ✓' : 'All empathy'} tone={globalEmpathy ? 'primary' : 'ghost'} onPress={onToggleGlobalEmpathy} /></View>}
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

function C17LiveClockText({ clock, playerIndex, paused }: { clock: LiveClock; playerIndex: number; paused: boolean }) {
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

function HudStat({ label, pulseEnabled, pulseKey, value }: { label: string; pulseEnabled?: boolean; pulseKey?: number | null; value: number | string }) {
  const { theme } = useHanabTheme();
  return <AuthoritativePulse enabled={pulseEnabled} pulseKey={pulseKey ?? null}><View style={styles.hudStat}>
    <Text style={[styles.hudValue, { color: theme.colors.text }]}>{value}</Text>
    <Text style={[styles.hudLabel, { color: theme.colors.textMuted }]}>{label}</Text>
  </View></AuthoritativePulse>;
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
  workspace: { flex: 1, minHeight: 0, paddingBottom: 4 },
  workspaceBody: { flex: 1, minHeight: 0 },
  ledgerChrome: { gap: 5 },
  grow: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  hud: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 4, paddingHorizontal: 7, paddingVertical: 5 },
  turn: { fontSize: 13, fontWeight: '900' },
  hudStat: { alignItems: 'center', minWidth: 34 },
  hudValue: { fontSize: 15, fontWeight: '900', lineHeight: 17 },
  hudLabel: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  lastAction: { borderRadius: 8, borderWidth: 1, gap: 3, minHeight: 37, paddingHorizontal: 7, paddingVertical: 4 },
  lastActionHeader: { minHeight: 32 },
  lastActionPressable: { alignItems: 'center', flexDirection: 'row', gap: 7, minHeight: 24 },
  lastActionText: { flex: 1, fontSize: 10, fontWeight: '700', minWidth: 0 },
  result: { borderRadius: 8, borderWidth: 1, gap: 3, paddingHorizontal: 7, paddingVertical: 5 },
  resultReason: { fontSize: 11, fontWeight: '700' },
  link: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  rowBetween: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' },
  actionButtons: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  hands: { gap: 5, marginTop: 5, minHeight: 0 },
  handsPending: { height: 0, overflow: 'hidden' },
  shellPending: { opacity: 0 },
  opponents: { gap: 2 },
  opponentRow: { borderColor: 'transparent', borderRadius: 7, borderWidth: HAND_ROW_BORDER_WIDTH, paddingHorizontal: HAND_ROW_HORIZONTAL_PADDING, paddingVertical: 2 },
  compactOpponentRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  opponentMeta: { height: 14, justifyContent: 'center', minWidth: 0 },
  compactOpponentNameLane: { flexShrink: 1, justifyContent: 'center', maxWidth: '36%', minWidth: 0 },
  namePeekArea: { alignItems: 'center', borderRadius: 6, flexDirection: 'row', gap: 3, height: 14, justifyContent: 'center', minWidth: 0 },
  opponentName: { flexShrink: 1, fontSize: 10, fontWeight: '900', lineHeight: 14, minWidth: 0 },
  opponentCards: { alignItems: 'center', flexDirection: 'row', gap: HAND_CARD_GAP, minWidth: 0 },
  compactOpponentCards: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 2, minWidth: 0 },
  ownHand: { borderRadius: 10, borderWidth: HAND_ROW_BORDER_WIDTH, paddingHorizontal: HAND_ROW_HORIZONTAL_PADDING, paddingVertical: 2 },
  ownTitleLane: { alignItems: 'center', flexDirection: 'row', gap: 3, height: 14, minWidth: 0 },
  ownTitle: { flexShrink: 1, fontSize: 10, fontWeight: '900', lineHeight: 14, minWidth: 0 },
  clock: { flexShrink: 0, fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 14 },
  ownCards: { alignItems: 'center', flexDirection: 'row', gap: HAND_CARD_GAP, minWidth: 0 },
  workbench: { borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, marginTop: 5, overflow: 'hidden' },
  workbenchExpanded: { flex: 1 },
  workbenchScroll: { flex: 1 },
  workbenchContent: { flexGrow: 1, gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  idleWorkbench: { alignItems: 'flex-end', flex: 1, justifyContent: 'flex-start', marginTop: 5 },
  workbenchText: { fontSize: 12, lineHeight: 16 },
  noteInspect: { gap: 3 },
  notePreview: { fontSize: 10, lineHeight: 14 },
  noteWarning: { borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  noteWarningText: { lineHeight: 20 },
  pendingText: { fontSize: 10, lineHeight: 14 },
  recentBackdrop: { flex: 1, justifyContent: 'center', padding: 18 },
  recentPopup: { borderRadius: 14, borderWidth: 1, gap: 10, maxHeight: '78%', padding: 12 },
  recentTitle: { fontSize: 16, fontWeight: '900' },
  recentList: { gap: 6 },
  recentItem: { alignItems: 'center', borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 48, paddingHorizontal: 9, paddingVertical: 7 },
  recentTurn: { fontSize: 11, fontWeight: '900', width: 30 },
  recentSummary: { flex: 1, fontSize: 11, lineHeight: 15, minWidth: 0 },
});
