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
  getGameplayPresentation,
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
import { EfficiencyDetailsModal } from './EfficiencyDetailsModal';
import { ClueComposer } from './ClueComposer';
import { CompactTable } from './CompactTable';
import { AuthoritativePulse } from './AuthoritativePulse';
import { DiscardViewer } from './DiscardViewer';
import { CompactHandCardSummary, GameCard, VisibleHanabiCard } from './GameCard';
import { NoteEditor } from './NoteEditor';
import {
  getC17CardLaneWidth,
  C17_SIDE_LABEL_LANE_WIDTH,
  C17_SIDE_LABEL_ROW_GAP,
  getC17DenseLayout,
  getC17AmbientEnvelope,
  getC17HandsRegionHeight,
  getC17HandRows,
  getC17WorkbenchHeight,
  hasC17AmbientRegionChanged,
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
  const username = useAppSelector((state) => state.session.authenticatedUser?.username ?? null);
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
  const seatingAnchorIndex = clientState?.metadata.ourPlayerIndex ?? null;
  const hypotheticalActor = hypothetical?.ongoing.turn.currentPlayerIndex ?? null;
  const actionHandIndex = hypotheticalActive ? hypotheticalActor : seatingAnchorIndex;
  const actionHand = useMemo(() => actionHandIndex === null ? [] : game?.hands[actionHandIndex] ?? [], [actionHandIndex, game]);
  const canHypotheticalControl = hypotheticalActive && (clientState?.replay.shared === null || clientState?.replay.shared.amLeader === true);
  const hypotheticalOperationPending = liveRoom !== null
    && roomState.pendingHypotheticalOperation?.connectionEpoch === roomState.connectionEpoch
    && roomState.pendingHypotheticalOperation.tableID === liveRoom.tableID
    && roomState.pendingHypotheticalOperation.gameLoadEpoch === liveRoom.gameLoadEpoch;
  const clueTargets = useMemo(() => (isPlayingPlayer || canHypotheticalControl)
    && clientState !== null && seatingAnchorIndex !== null
    ? getC17HandRows(clientState.metadata.playerNames.length, seatingAnchorIndex, actionHandIndex).clueTargetIndices
    : [], [actionHandIndex, canHypotheticalControl, clientState, isPlayingPlayer, seatingAnchorIndex]);
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
      ownOrders: actionHand,
      clueTargets,
      empathyPlayers,
      visibleOrders: liveNoteOrders,
    });
  }, [actionHand, clueTargets, empathyPlayers, liveNoteOrders]);

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

  if (liveRoom === null || clientState === null || game === null || seatingAnchorIndex === null) return null;

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
  const isOurTurn = isPlayingPlayer && game.turn.currentPlayerIndex === seatingAnchorIndex;
  const enabled = isPlayingPlayer
    && sessionPhase === 'ready'
    && isOurTurn
    && !replay.active
    && !clientState.pause.active
    && roomState.pendingGameplayAction === null;
  const hypotheticalEnabled = canHypotheticalControl && hypotheticalActor !== null
    && !hypotheticalOperationPending;
  const cardEnabled = (enabled || hypotheticalEnabled) && selectedCard !== null && actionHand.some((order) => order === selectedCard);
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

  const gameplayPresentation = getGameplayPresentation(
    game,
    metadata.options,
    metadata.minEfficiency,
    clientState.notes.efficiencyModifier,
    {
      finished: clientState.finished,
      viewingOngoingGame: game === clientState.ongoingGame,
      sharedReplayUseSharedSegments: clientState.replay.shared?.useSharedSegments === true,
    },
  );
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
  const sharedReplayOwnName = replay.shared !== null
    && username !== null
    && clientState.spectators.some((spectator) => spectator.name === username)
    ? username
    : null;
  const sharedReplayPassTargets = replay.shared?.amLeader
    ? clientState.spectators.map((spectator) => spectator.name)
      .filter((name) => name !== replay.shared?.leader)
    : [];

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
      gameplayPresentation={gameplayPresentation}
      game={game}
      hypothetical={hypothetical}
      hypotheticalActor={hypotheticalActor}
      actionHandIndex={actionHandIndex}
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
      onConfirmClue={confirmClue}
      onDiscard={() => {
        if (discardEnabled && selectedCard !== null) {
          const sent = hypotheticalActive ? lobbyRuntime.hypotheticalDiscard(selectedCard) : lobbyRuntime.discard(selectedCard);
          if (sent) interactionDispatch({ type: 'complete-card-action', order: selectedCard });
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
          if (sent) interactionDispatch({ type: 'complete-card-action', order: selectedCard });
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
      seatingAnchorIndex={seatingAnchorIndex}
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
      sharedReplayOwnName={sharedReplayOwnName}
      sharedReplayPassTargets={sharedReplayPassTargets}
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
  actionHandIndex,
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
  gameplayPresentation,
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
  seatingAnchorIndex,
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
  sharedReplayOwnName,
  sharedReplayPassTargets,
  speedrun,
  targetName,
  variantName,
}: {
  actionSegments: readonly number[];
  actionHandIndex: number | null;
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
  gameplayPresentation: ReturnType<typeof getGameplayPresentation>;
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
  seatingAnchorIndex: number;
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
  sharedReplayOwnName: string | null;
  sharedReplayPassTargets: readonly string[];
  speedrun: boolean;
  targetName: string | null;
  variantName: string;
}) {
  const { theme } = useHanabTheme();
  const { width: viewportWidth, height: viewportHeight, fontScale } = useWindowDimensions();
  const [recentOpen, setRecentOpen] = useState(false);
  const [efficiencyDetailsOpen, setEfficiencyDetailsOpen] = useState(false);
  const committedClue = getLastCluePresentationFromState(game);
  const opponents = getC17HandRows(metadata.playerNames.length, seatingAnchorIndex, actionHandIndex).opponentIndices;
  const usesSideLabels = opponents.length <= 2;
  const usesDenseSideLabels = opponents.length >= 3;
  const usesSideLabelRows = usesSideLabels || usesDenseSideLabels;
  const usesCompactWorkbench = usesSideLabels;
  const workbenchHeight = getC17WorkbenchHeight(viewportHeight, opponents.length);
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
  const cardLaneWidth = getC17CardLaneWidth(
    layoutMetrics.ambientBodyWidth,
    usesSideLabelRows ? C17_SIDE_LABEL_LANE_WIDTH + C17_SIDE_LABEL_ROW_GAP : 0,
  );
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
      const envelope = getC17AmbientEnvelope(
        { height: currentMetrics.ambientBodyHeight, width: currentMetrics.ambientBodyWidth },
        { height: next.height, width: next.width },
        sameShell,
      );
      if (sameShell && !hasC17AmbientRegionChanged(
        { height: currentMetrics.ambientBodyHeight, width: currentMetrics.ambientBodyWidth },
        envelope,
      )) return currentMetrics;
      return {
        shellKey,
        ambientBodyHeight: envelope.height,
        ambientBodyWidth: envelope.width,
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
  const anchoredHand = getDisplayedHandOrders(game.hands[seatingAnchorIndex]);
  const displayedActionHand = actionHandIndex === null ? [] : getDisplayedHandOrders(game.hands[actionHandIndex]);
  const anchoredIsActionHand = actionHandIndex === seatingAnchorIndex;
  const displayIdentity = (order: number) => hypothetical?.morphedIdentities[order] ?? cardIdentities[order];
  const hasExplicitBlankMorph = (order: number) => {
    const morph = hypothetical?.morphedIdentities[order];
    return morph?.suitIndex === null && morph.rank === null;
  };
  const startingHandHidden = !hypothetical?.showDrawnCards && hypothetical?.startingPlayerIndex !== null;
  const selectedActionCard = selectedCard !== null && displayedActionHand.some((order) => order === selectedCard) ? selectedCard : null;
  const inspectedNote = noteCard === null ? '' : notes[noteCard]?.text ?? '';
  const readOnlyReplay = finishedReplay || sharedReplay !== null;
  const inspectedReplayNotes = noteCard === null
    ? []
    : replayNotes[noteCard]?.filter((entry) => entry.text.trim().length > 0) ?? [];
  const hasAvailableNote = (order: number) => readOnlyReplay
    ? (replayNotes[order]?.some((entry) => entry.text.trim().length > 0) ?? false)
    : (notes[order]?.text.trim().length ?? 0) > 0;
  const showWorkbench = hypothetical !== null || reviewActive || finishedReplay || sharedReplay !== null
    || selectedTarget !== null || selectedActionCard !== null || noteCard !== null || pendingText !== null;
  const compactOrdinaryWorkbench = usesCompactWorkbench
    && hypothetical === null
    && !reviewActive
    && !finishedReplay
    && sharedReplay === null
    && selectedTarget === null
    && (selectedActionCard !== null || noteCard !== null);
  const compactCappedWorkbench = usesCompactWorkbench && (compactOrdinaryWorkbench
    || hypothetical !== null || reviewActive || finishedReplay || sharedReplay !== null);
  const showRewindScrubber = reviewActive;
  const finishedReason = result?.reason;
  const finishedStatus = finishedReason === null || finishedReason === undefined
    ? 'FINAL'
    : `FINAL · ${finishedReason}`;
  return <View style={styles.workspace}>
    <View style={styles.ledgerChrome}>
      <View style={[styles.hud, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.grow}>
          <Text numberOfLines={1} style={[styles.eyebrow, { color: theme.colors.accent }]}>{sharedReplay !== null
            ? `SHARED REVIEW T${selectedTurn}`
            : hypothetical !== null
              ? 'HYPOTHETICAL'
            : finishedReplay
            ? finishedStatus
            : reviewActive ? `REWIND T${selectedTurn}` : `LIVE T${liveTurn}`}</Text>
          <AuthoritativePulse enabled={livePulseEnabled} pulseKey={actorPulse}><Text numberOfLines={1} style={[styles.turn, { color: theme.colors.text }]}>{canPlayGameplay && current === seatingAnchorIndex ? 'YOUR TURN' : currentName}</Text></AuthoritativePulse>
        </View>
        <HudStat label="Score" pulseEnabled={livePulseEnabled} pulseKey={liveBefore === undefined ? null : resourcePulse(liveBefore.score, game.score)} value={game.score} />
        <HudStat label="Max" value={game.stats.maxScore} />
        <HudStat label="Clues" pulseEnabled={livePulseEnabled} pulseKey={liveBefore === undefined ? null : resourcePulse(getDisplayedClueTokens(liveBefore.clueTokens, variantName), getDisplayedClueTokens(game.clueTokens, variantName))} value={getDisplayedClueTokens(game.clueTokens, variantName)} />
        <HudStat label="Strikes" pulseEnabled={livePulseEnabled} pulseKey={liveBefore === undefined ? null : resourcePulse(liveBefore.strikes.length, game.strikes.length)} value={game.strikes.length} />
        <HudStat label="Deck" pulseEnabled={livePulseEnabled} pulseKey={liveBefore === undefined ? null : resourcePulse(liveBefore.cardsRemainingInTheDeck, game.cardsRemainingInTheDeck)} value={game.cardsRemainingInTheDeck} />
        <HudStat label="Pace" value={gameplayPresentation.pace}
          valueColor={paceRiskColor(theme, gameplayPresentation.paceRisk)} />
        <HudStat label="Eff" value={`${formatEfficiency(gameplayPresentation.futureRequiredEfficiency)} | ${gameplayPresentation.minimumRequiredEfficiency.toFixed(2)}`}
          valueColor={gameplayPresentation.appliesEfficiencyModifier ? theme.colors.accent : undefined}
          accessibilityLabel={`Efficiency. Future required ${formatEfficiency(gameplayPresentation.futureRequiredEfficiency)}, minimum required ${gameplayPresentation.minimumRequiredEfficiency.toFixed(2)}`}
          accessibilityHint="Opens read-only efficiency calculation details"
          onPress={() => setEfficiencyDetailsOpen(true)} />
      </View>

      <CompactTable dense game={game} onOpenDiscards={onOpenDiscards} pulseDiscard={discardPulse} pulseEnabled={livePulseEnabled} pulsePlay={playPulse} variantName={variantName} />

      <AuthoritativePulse enabled={livePulseEnabled} pulseKey={livePulseSegment}><View style={[styles.lastAction, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
        <View style={[styles.rowBetween, styles.lastActionHeader]}>
          <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>{reviewActive ? `LAST ACTION · T${selectedTurn}` : 'LAST ACTION'}</Text>
          <View style={styles.actionButtons}>
            {!reviewActive &&
              <ActionButton compact disabled={!historyAvailable} title="Rewind" onPress={onEnterRewind} />}
            <ActionButton compact title={globalEmpathy ? 'Empathy ✓' : 'Empathy'} tone={globalEmpathy ? 'primary' : 'ghost'} onPress={onToggleGlobalEmpathy} />
          </View>
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
          const isActionHand = actionHandIndex === index;
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
              if (canEnterClue && !isActionHand) onSelectClueTarget(index);
            }}
            onPressOut={globalEmpathy ? undefined : () => onHoldEmpathy(null)}
            style={[
              styles.opponentRow,
              compact && styles.compactOpponentRow,
              !compact && usesSideLabelRows && styles.sideLabelRow,
              { height: layout.opponentRowHeight },
              currentActor && (usesSideLabelRows
                ? { backgroundColor: theme.colors.surfaceMuted }
                : { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.accent }),
              target && { borderColor: theme.colors.accent },
            ]}
          >
            <View style={compact ? styles.compactOpponentNameLane : usesSideLabelRows ? styles.sideLabelLane : styles.opponentMeta}>
              <View style={[styles.namePeekArea, usesSideLabelRows && styles.sideLabelPeekArea]}>
                {usesSideLabelRows && currentActor && <View style={[styles.currentActorDot, { backgroundColor: theme.colors.accent }]} />}
                <Text numberOfLines={1} style={[styles.opponentName, { color: currentActor ? theme.colors.accent : theme.colors.text }]}>
                  {playerName}{!usesSideLabelRows && currentActor ? ' · TURN' : ''}
                </Text>
                {liveClock !== null && <C17LiveClockText
                  clock={liveClock}
                  paused={clockPaused}
                  playerIndex={index}
                />}
              </View>
            </View>
            <View style={compact ? styles.compactOpponentCards : [styles.opponentCards, usesSideLabelRows && styles.sideLabelCards, { marginTop: 2 + layout.cardTopHeadroom }]}>
              {getDisplayedHandOrders(game.hands[index]).map((order, position) => {
                const card = game.deck[order];
                if (card === undefined) return null;
                const cardNote = notes[order];
                const forcedStartingEmpathy = startingHandHidden && hypothetical?.startingPlayerIndex === index;
                if (isActionHand) {
                  const actionEmpathy = empathizing || forcedStartingEmpathy;
                  const actionKnowledge = getCardKnowledgeViewModel(variantName, card, cardNote, false, actionEmpathy, displayIdentity(order), hasExplicitBlankMorph(order));
                  const actionPresentation = getCardStatePresentation({
                    game,
                    state: card,
                    note: cardNote,
                    displaySuitIndex: actionKnowledge.displaySuitIndex,
                    displayRank: actionKnowledge.displayRank,
                    empathy: actionEmpathy,
                    finished: finishedReplay,
                    variantName,
                    speedrun,
                    hyphenatedConventions,
                    hardVariant: metadata.hardVariant,
                  });
                  return <AuthoritativePulse enabled={livePulseEnabled} key={order} pulseKey={cluePulse(index, position)}><GameCard
                    cardTopHeadroom={layout.cardTopHeadroom}
                    clueMarker={getCommittedClueMarkerForMetadata(committedClue, order, card.numPositiveClues, metadata)}
                    hasNote={hasAvailableNote(order)}
                    height={layout.opponentCardHeight}
                    knowledge={actionKnowledge}
                    onLongPress={globalEmpathy ? undefined : () => onHoldEmpathy(index)}
                    onPressOut={globalEmpathy ? undefined : () => onHoldEmpathy(null)}
                    onSelect={() => onSelectCard(order)}
                    position={position}
                    selected={selectedActionCard === order}
                    statePresentation={actionPresentation}
                    variantName={variantName}
                  /></AuthoritativePulse>;
                }
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

      <AuthoritativePulse enabled={livePulseEnabled} pulseKey={sourcePulse(seatingAnchorIndex)}><Pressable
        accessibilityLabel={`Player ${metadata.playerNames[seatingAnchorIndex] ?? `Player ${seatingAnchorIndex + 1}`}`}
        accessibilityRole="button"
        delayLongPress={350}
        disabled={globalEmpathy}
        onLongPress={() => onHoldEmpathy(seatingAnchorIndex)}
        onPress={() => { if (canEnterClue && !anchoredIsActionHand) onSelectClueTarget(seatingAnchorIndex); }}
        onPressOut={() => onHoldEmpathy(null)}
        style={[styles.ownHand, usesSideLabelRows && styles.sideLabelRow, { height: layout.ownRowHeight, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <View style={[styles.ownTitleLane, usesSideLabelRows && styles.sideLabelLane]}>
          <Text numberOfLines={1} style={[styles.ownTitle, { color: theme.colors.text }]}>{isSpectator ? 'OBSERVED' : usesSideLabelRows ? 'YOU' : 'YOUR HAND'}</Text>
          {liveClock !== null && <C17LiveClockText
            clock={liveClock}
            paused={clockPaused}
            playerIndex={seatingAnchorIndex}
          />}
        </View>
        <View style={[styles.ownCards, usesSideLabelRows && styles.sideLabelCards, { marginTop: 2 + layout.cardTopHeadroom }]}>
          {anchoredHand.map((order, position) => {
            const card = game.deck[order];
            if (card === undefined) return null;
            const ownEmpathy = globalEmpathy || empathyPlayer === seatingAnchorIndex
              || (startingHandHidden && hypothetical?.startingPlayerIndex === seatingAnchorIndex);
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
            if (!anchoredIsActionHand) {
              const anchoredEmpathizing = globalEmpathy || empathyPlayer === seatingAnchorIndex;
              const forcedStartingEmpathy = startingHandHidden && hypothetical?.startingPlayerIndex === seatingAnchorIndex;
              const normalKnowledge = getCardKnowledgeViewModel(variantName, card, cardNote, false, false, displayIdentity(order), hasExplicitBlankMorph(order));
              const empathyKnowledge = anchoredEmpathizing || forcedStartingEmpathy
                ? getCardKnowledgeViewModel(variantName, card, cardNote, false, true, displayIdentity(order), hasExplicitBlankMorph(order))
                : null;
              const activeKnowledge = empathyKnowledge ?? normalKnowledge;
              const nonActionPresentation = getCardStatePresentation({
                game,
                state: card,
                note: cardNote,
                displaySuitIndex: activeKnowledge.displaySuitIndex,
                displayRank: activeKnowledge.displayRank,
                empathy: anchoredEmpathizing,
                finished: finishedReplay,
                variantName,
                speedrun,
                hyphenatedConventions,
                hardVariant: metadata.hardVariant,
              });
              return <AuthoritativePulse enabled={livePulseEnabled} key={order} pulseKey={cluePulse(seatingAnchorIndex, position)}><VisibleHanabiCard
                cardTopHeadroom={layout.cardTopHeadroom}
                clueMarker={getCommittedClueMarkerForMetadata(committedClue, order, card.numPositiveClues, metadata)}
                empathyKnowledge={empathyKnowledge}
                hasNote={hasAvailableNote(order)}
                height={layout.ownCardHeight}
                onLongPress={globalEmpathy ? undefined : () => onHoldEmpathy(seatingAnchorIndex)}
                onPress={() => onInspectNote(order)}
                onPressOut={globalEmpathy ? undefined : () => onHoldEmpathy(null)}
                position={position}
                previewMarker={selectedTarget === seatingAnchorIndex && (cluePreview?.touchedOrders.includes(order) ?? false)
                  ? getPreviewClueMarker(cluePreviewState, card.numPositiveClues, clueChoices) : null}
                rank={hypothetical === null ? card.rank : normalKnowledge.displayRank}
                semanticBorder={normalKnowledge.borderColor}
                statePresentation={nonActionPresentation}
                suitIndex={hypothetical === null ? card.suitIndex : normalKnowledge.displaySuitIndex}
                variantName={variantName}
              /></AuthoritativePulse>;
            }
            return <AuthoritativePulse enabled={livePulseEnabled} key={order} pulseKey={cluePulse(seatingAnchorIndex, position)}><GameCard
              hasNote={hasAvailableNote(order)}
              height={layout.ownCardHeight}
              knowledge={knowledge}
              clueMarker={getCommittedClueMarkerForMetadata(committedClue, order, card.numPositiveClues, metadata)}
              previewMarker={selectedTarget === seatingAnchorIndex && (cluePreview?.touchedOrders.includes(order) ?? false)
                ? getPreviewClueMarker(cluePreviewState, card.numPositiveClues, clueChoices) : null}
              cardTopHeadroom={layout.cardTopHeadroom}
              onDoublePress={readOnlyReplay || hypothetical !== null ? undefined : () => onEditNote(order)}
              onLongPress={globalEmpathy ? undefined : () => onHoldEmpathy(seatingAnchorIndex)}
              onPressOut={globalEmpathy ? undefined : () => onHoldEmpathy(null)}
              onSelect={() => onSelectCard(order)}
              position={position}
              selected={selectedActionCard === order}
              statePresentation={statePresentation}
              variantName={variantName}
            /></AuthoritativePulse>;
          })}
        </View>
      </Pressable></AuthoritativePulse>
      </View>

      {(!shellMeasured || showWorkbench) ? <View style={[
      styles.workbench,
      compactOrdinaryWorkbench ? styles.compactWorkbenchReserve : { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong },
      compactCappedWorkbench ? { height: layout.workbenchHeight } : shellMeasured ? styles.workbenchExpanded : { height: layout.workbenchHeight },
      !shellMeasured && styles.shellPending,
    ]}>
      {showRewindScrubber && <View style={styles.workbenchScrubber}>
        <C17RewindScrubber actionSegments={actionSegments} onSelectSegment={onScrubAction} selectedSegment={selectedActionSegment} />
      </View>}
      <ScrollView contentContainerStyle={styles.workbenchContent} nestedScrollEnabled style={[
        styles.workbenchScroll,
        compactOrdinaryWorkbench && [styles.compactWorkbenchTray, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }],
      ]}>
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
          {sharedReplay !== null && <View style={styles.actionButtons}>
            {!sharedReplay.amLeader && sharedReplayOwnName !== null && <ActionButton compact title="Take leadership" onPress={() => lobbyRuntime.setSharedReplayLeader(sharedReplayOwnName)} />}
            {sharedReplay.amLeader && sharedReplayPassTargets.map((name) => <ActionButton
              compact
              key={name}
              title={`Pass to ${name}`}
              onPress={() => lobbyRuntime.setSharedReplayLeader(name)}
            />)}
          </View>}
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
          /> : canPlayGameplay && selectedActionCard !== null ? <View style={styles.rowBetween}>
            <Text style={[styles.workbenchText, { color: theme.colors.text }]}>Actor card {displayedActionHand.findIndex((order) => order === selectedActionCard) + 1}</Text>
            <View style={styles.actionButtons}>
              <ActionButton compact disabled={!canPlayCard} title="Play" tone="primary" onPress={onPlay} />
              <ActionButton compact disabled={!canDiscardCard} title="Discard" onPress={onDiscard} />
            </View>
          </View> : hypotheticalController ? <Text style={[styles.workbenchText, { color: theme.colors.textMuted }]}>Select a card from the hypothetical actor hand or a player to plan a clue.</Text> : null}
        </> : reviewActive && !finishedReplay && sharedReplay === null ? <>
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>Rewind T{selectedTurn} · Live T{liveTurn}{newerActionCount > 0 ? ` · ${newerActionCount} NEW` : ''}</Text>
          <View style={styles.rowBetween}>
            <View style={styles.actionButtons}>
              <ActionButton compact disabled={!canReviewBack} title="← Back" onLongPress={onReviewStart} onPress={onReviewBack} />
              <ActionButton compact disabled={!canReviewForward} title="Forward →" onLongPress={onReviewEnd} onPress={onReviewForward} />
            </View>
            <ActionButton compact title={`Exit · Live T${liveTurn}`} tone="primary" onPress={onReturnLive} />
          </View>
          {canStartHypothetical && <ActionButton compact title="Start Hypothetical" tone="primary" onPress={onStartHypothetical} />}
          {noteCard !== null && <View style={styles.noteInspect}>
            <View style={styles.rowBetween}>
              <ActionButton compact title="Edit note" onPress={() => onEditNote(noteCard)} />
            </View>
            <Text numberOfLines={2} style={[styles.notePreview, { color: inspectedNote.trim().length > 0 ? theme.colors.text : theme.colors.textMuted }]}>
              {inspectedNote.trim().length > 0 ? inspectedNote : 'No saved note'}
            </Text>
          </View>}
        </> : finishedReplay || sharedReplay !== null ? <>
          {sharedReplay === null ? <>
            <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>{`Replay T${selectedTurn}${selectedActionSegment === actionSegments.at(-1) ? ' · End' : ''}`}</Text>
            <View style={styles.rowBetween}>
              <View style={styles.actionButtons}>
                <ActionButton compact disabled={!canReviewBack} title="Back" onLongPress={onReviewStart} onPress={onReviewBack} />
                <ActionButton compact disabled={!canReviewForward} title="Forward" onLongPress={onReviewEnd} onPress={onReviewForward} />
              </View>
            </View>
            {(canQuickRematch || canRemake) && <View style={styles.actionButtons}>
              {canQuickRematch && <ActionButton compact title="Quick rematch" tone="primary" onPress={onQuickRematch} />}
              {canRemake && <ActionButton compact title="Remake table" onPress={onRemake} />}
            </View>}
            {canStartHypothetical && <ActionButton compact title="Start Hypothetical" tone="primary" onPress={onStartHypothetical} />}
          </> : <>
            <Text numberOfLines={1} style={[styles.workbenchText, { color: theme.colors.textMuted }]}>Leader: {sharedReplay.leader}</Text>
            <View style={styles.actionButtons}>
              <ActionButton compact disabled={!canReviewBack} title="Back" onLongPress={onReviewStart} onPress={onReviewBack} />
              <ActionButton compact disabled={!canReviewForward} title="Forward" onLongPress={onReviewEnd} onPress={onReviewForward} />
              {!sharedReplay.amLeader && !sharedReplay.useSharedSegments && <ActionButton compact title="Follow leader" tone="primary" onPress={() => lobbyRuntime.followReplayLeader()} />}
              {!sharedReplay.amLeader && sharedReplayOwnName !== null && <ActionButton compact title="Take leadership" onPress={() => lobbyRuntime.setSharedReplayLeader(sharedReplayOwnName)} />}
              {sharedReplay.amLeader && sharedReplayPassTargets.map((name) => <ActionButton
                compact
                key={name}
                title={`Pass to ${name}`}
                onPress={() => lobbyRuntime.setSharedReplayLeader(name)}
              />)}
              {canStartHypothetical && <ActionButton compact title="Start Hypothetical" tone="primary" onPress={onStartHypothetical} />}
              {canQuickRematch && <ActionButton compact title="Quick rematch" tone="primary" onPress={onQuickRematch} />}
              {canRemake && <ActionButton compact title="Remake table" onPress={onRemake} />}
            </View>
          </>}
          {noteCard !== null && <View style={styles.noteInspect}>
            <Text style={[styles.notePreview, { color: inspectedReplayNotes.length > 0 ? theme.colors.text : theme.colors.textMuted }]}>
              {inspectedReplayNotes.length > 0
                ? inspectedReplayNotes.map((entry) => `${entry.name}: ${entry.text}`).join('\n')
                : 'No replay notes'}
            </Text>
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
          {canPlayGameplay && selectedActionCard !== null && <View style={styles.actionButtons}>
            <ActionButton compact disabled={!canPlayCard} title="Play" tone="primary" onPress={onPlay} />
            <ActionButton compact disabled={!canDiscardCard} title="Discard" onPress={onDiscard} />
            {(noteCard === null || noteCard === selectedActionCard) && <ActionButton compact title="Edit note" onPress={() => onEditNote(selectedActionCard)} />}
          </View>}

          {selectedActionCard !== null && noteCard === null && (notes[selectedActionCard]?.text.trim().length ?? 0) > 0 && <Text style={[styles.notePreview, { color: theme.colors.text }]}>
            {notes[selectedActionCard]?.text}
          </Text>}

          {noteCard !== null ? <View style={styles.noteInspect}>
            {noteCard !== selectedActionCard && <View style={styles.rowBetween}>
              <ActionButton compact title="Edit note" onPress={() => onEditNote(noteCard)} />
            </View>}
            {inspectedNote.trim().length > 0 && <Text style={[styles.notePreview, { color: theme.colors.text }]}>{inspectedNote}</Text>}
          </View> : null}

          {pendingText !== null && <Text style={[styles.pendingText, { color: theme.colors.textMuted }]}>{pendingText}… awaiting server</Text>}
        </>}
      </ScrollView>
    </View> : <View style={styles.idleWorkbench} />}
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
    <EfficiencyDetailsModal
      onClose={() => setEfficiencyDetailsOpen(false)}
      presentation={gameplayPresentation}
      visible={efficiencyDetailsOpen}
    />
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

function HudStat({ label, pulseEnabled, pulseKey, value, valueColor, onPress, accessibilityLabel, accessibilityHint }: {
  label: string;
  pulseEnabled?: boolean;
  pulseKey?: number | null;
  value: number | string;
  valueColor?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { theme } = useHanabTheme();
  const contents = <>
    <Text style={[styles.hudValue, { color: valueColor ?? theme.colors.text }]}>{value}</Text>
    <Text style={[styles.hudLabel, { color: theme.colors.textMuted }]}>{label}</Text>
  </>;
  return <AuthoritativePulse enabled={pulseEnabled} pulseKey={pulseKey ?? null}>
    {onPress === undefined
      ? <View style={styles.hudStat}>{contents}</View>
      : <Pressable accessibilityHint={accessibilityHint} accessibilityLabel={accessibilityLabel}
        accessibilityRole="button" hitSlop={6} onPress={onPress} style={styles.hudStat}>{contents}</Pressable>}
  </AuthoritativePulse>;
}

function formatEfficiency(value: number | null): string {
  return value === null ? '-' : value.toFixed(2);
}

function paceRiskColor(theme: ReturnType<typeof useHanabTheme>['theme'], risk: 'low' | 'medium' | 'high' | 'zero' | null): string {
  if (risk === 'medium') return theme.colors.warning;
  if (risk === 'high') return theme.dark ? '#fbbf24' : '#b45309';
  if (risk === 'zero') return theme.colors.danger;
  return theme.colors.text;
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
  link: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  rowBetween: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' },
  actionButtons: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  hands: { gap: 5, marginTop: 5, minHeight: 0 },
  handsPending: { height: 0, overflow: 'hidden' },
  shellPending: { opacity: 0 },
  opponents: { gap: 2 },
  opponentRow: { borderColor: 'transparent', borderRadius: 7, borderWidth: HAND_ROW_BORDER_WIDTH, paddingHorizontal: HAND_ROW_HORIZONTAL_PADDING, paddingVertical: 2 },
  compactOpponentRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  sideLabelRow: { alignItems: 'center', flexDirection: 'row-reverse', gap: C17_SIDE_LABEL_ROW_GAP },
  opponentMeta: { height: 14, justifyContent: 'center', minWidth: 0 },
  compactOpponentNameLane: { flexShrink: 1, justifyContent: 'center', maxWidth: '36%', minWidth: 0 },
  sideLabelLane: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: 3, justifyContent: 'center', minWidth: 0, width: C17_SIDE_LABEL_LANE_WIDTH },
  namePeekArea: { alignItems: 'center', borderRadius: 6, flexDirection: 'row', gap: 3, height: 14, justifyContent: 'center', minWidth: 0 },
  sideLabelPeekArea: { width: '100%' },
  opponentName: { flex: 1, fontSize: 10, fontWeight: '900', lineHeight: 14, minWidth: 0 },
  currentActorDot: { borderRadius: 3, height: 6, width: 6 },
  opponentCards: { alignItems: 'center', flexDirection: 'row', gap: HAND_CARD_GAP, minWidth: 0 },
  sideLabelCards: { flex: 1 },
  compactOpponentCards: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 2, minWidth: 0 },
  ownHand: { borderRadius: 10, borderWidth: HAND_ROW_BORDER_WIDTH, paddingHorizontal: HAND_ROW_HORIZONTAL_PADDING, paddingVertical: 2 },
  ownTitleLane: { alignItems: 'center', flexDirection: 'row', gap: 3, height: 14, minWidth: 0 },
  ownTitle: { flex: 1, fontSize: 10, fontWeight: '900', lineHeight: 14, minWidth: 0 },
  clock: { flexShrink: 0, fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 14 },
  ownCards: { alignItems: 'center', flexDirection: 'row', gap: HAND_CARD_GAP, minWidth: 0 },
  workbench: { borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, marginTop: 5, overflow: 'hidden' },
  compactWorkbenchReserve: { backgroundColor: 'transparent', borderWidth: 0, flexGrow: 0, flexShrink: 0, overflow: 'visible' },
  workbenchExpanded: { flex: 1 },
  workbenchScrubber: { paddingHorizontal: 10, paddingTop: 7 },
  workbenchScroll: { flex: 1 },
  compactWorkbenchTray: { alignSelf: 'stretch', borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, flex: 0, flexGrow: 0, flexShrink: 1, maxHeight: '100%' },
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
