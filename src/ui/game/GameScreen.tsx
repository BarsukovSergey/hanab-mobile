import { useEffect, useState } from 'react';
import { Button, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getCardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import {
  getDisplayedClueTokens,
  getDisplayedClockString,
  getGameTableSuits,
  getGameplayClueChoicesForPlayer,
  getVisibleCardIdentityLabel,
  hasClueTokenForVariant,
} from '../../game/selectors/gameplay';
import { lobbyRuntime } from '../../runtime/application';
import {
  isQuickRematchEligible,
  isRestartToPregameEligible,
} from '../../runtime/LobbyRuntime';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { roomActions } from '../../store/roomSlice';
import { CardKnowledgeDetails, GameCard } from './GameCard';
import type { GameState } from '../../game/bootstrap/types';

const END_CONDITION_TEXT: Record<number, string> = {
  0: 'In progress',
  1: 'Normal completion',
  2: 'Strikeout',
  3: 'Timeout',
  4: 'Terminated by player',
  5: 'Speedrun failed',
  6: 'Idle timeout',
  7: 'Character softlock',
  8: 'All or Nothing failed',
  9: 'All or Nothing softlock',
  10: 'Terminated by vote',
};

export function GameScreen() {
  const dispatch = useAppDispatch();
  const sessionPhase = useAppSelector((state) => state.session.phase);
  const roomState = useAppSelector((state) => state.room);
  const lobbyUsers = useAppSelector((state) => state.lobby.users.entities);
  const liveRoom = roomState.room.kind === 'live_game' ? roomState.room : null;
  const [selectedCardOrder, setSelectedCardOrder] = useState<number | null>(null);
  const [selectedClueTarget, setSelectedClueTarget] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [clockNowMs, setClockNowMs] = useState(Date.now());

  const clientState = liveRoom?.clientState ?? null;
  const displayedGame = clientState?.visibleState ?? null;

  const playerLiveRoom = liveRoom?.role === 'player' && clientState?.playing
    ? liveRoom
    : null;
  const ourPlayerIndex = playerLiveRoom?.clientState.metadata.ourPlayerIndex ?? null;
  const ourHand = ourPlayerIndex === null
    ? []
    : displayedGame?.hands[ourPlayerIndex] ?? [];
  const selectableCardOrders = clientState?.finished || liveRoom?.role === 'spectator'
    ? displayedGame?.hands.flatMap((hand) => hand) ?? []
    : ourHand;
  const clueTargetIndexes = playerLiveRoom?.clientState.metadata.playerNames
    .map((_, playerIndex) => playerIndex)
    .filter((playerIndex) => playerIndex !== ourPlayerIndex) ?? [];

  useEffect(() => {
    if (selectableCardOrders.length === 0) {
      setSelectedCardOrder(null);
    } else if (
      selectedCardOrder === null
      || !selectableCardOrders.some((order) => order === selectedCardOrder)
    ) {
      setSelectedCardOrder(selectableCardOrders[0] ?? null);
    }
  }, [selectableCardOrders, selectedCardOrder]);

  const authoritativeNote = selectedCardOrder === null
    ? ''
    : clientState?.notes.ourNotes[selectedCardOrder]?.text ?? '';
  const selectedCombinedNotes = selectedCardOrder === null
    ? []
    : clientState?.notes.allNotes[selectedCardOrder]?.filter(
      (note) => note.text.trim().length > 0,
    ) ?? [];
  useEffect(() => {
    setNoteText(authoritativeNote);
  }, [authoritativeNote, selectedCardOrder]);

  useEffect(() => {
    if (
      selectedClueTarget === null
      || !clueTargetIndexes.includes(selectedClueTarget)
    ) {
      setSelectedClueTarget(clueTargetIndexes[0] ?? null);
    }
  }, [clueTargetIndexes, selectedClueTarget]);

  const timedOngoing = clientState?.metadata.options.timed === true
    && !clientState.finished
    && clientState.ongoingGame.turn.currentPlayerIndex !== null
    && !liveRoom?.sharedReplay;
  useEffect(() => {
    if (!timedOngoing || clientState?.pause.active || liveRoom?.clock === null) return undefined;
    setClockNowMs(Date.now());
    const timer = setInterval(() => setClockNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [timedOngoing, clientState?.pause.active, liveRoom?.clock?.receivedAtMs]);

  if (liveRoom === null) return null;

  if (displayedGame === null || clientState === null) return null;

  const { metadata, replay, ongoingGame } = clientState;
  const isFinished = clientState.finished;
  const latestSegment = ongoingGame.turn.segment ?? 0;
  const currentSegment = replay.active ? replay.segment : latestSegment;
  const availableSegments = replay.states.flatMap((state, segment) => (
    state === undefined ? [] : [segment]
  ));
  const shared = replay.shared;
  const selectSegment = (segment: number) => {
    lobbyRuntime.navigateReplaySegment(segment);
  };
  const reviewControls = (
    <View style={styles.reviewArea}>
      <Text style={styles.actionTitle}>
        {!replay.active ? 'Live' : 'Review'} · Segment {currentSegment}
        {' / '}{latestSegment} · Turn {displayedGame.turn.turnNum}
      </Text>
      <View style={styles.buttonWrap}>
        <Button
          disabled={availableSegments.length === 0 || currentSegment === 0}
          title="First"
          onPress={() => selectSegment(availableSegments[0] ?? 0)}
        />
        <Button
          disabled={availableSegments.length === 0 || currentSegment <= 0}
          title="Previous"
          onPress={() => {
            const previous = [...availableSegments]
              .reverse()
              .find((segment) => segment < currentSegment);
            if (previous !== undefined) selectSegment(previous);
          }}
        />
        <Button
          disabled={!replay.active || currentSegment >= latestSegment}
          title="Next"
          onPress={() => {
            const next = availableSegments.find((segment) => segment > currentSegment);
            if (next !== undefined) selectSegment(next);
          }}
        />
        <Button
          disabled={!replay.active || (shared !== null && currentSegment >= latestSegment)}
          title={shared === null ? 'Latest live' : 'Last'}
          onPress={() => {
            if (shared !== null) {
              selectSegment(latestSegment);
            } else {
              dispatch(roomActions.reviewSegmentSelected({
                tableID: liveRoom.tableID,
                gameLoadEpoch: liveRoom.gameLoadEpoch,
                segment: null,
              }));
            }
          }}
        />
      </View>
      {shared !== null && (
        <View style={styles.sharedReplayStatus}>
          <Text>Leader: {shared.leader}</Text>
          <Text>
            {shared.amLeader
              ? 'You control the shared segment.'
              : shared.useSharedSegments
                ? `Following shared segment ${shared.segment}.`
                : `Viewing locally; shared segment is ${shared.segment}.`}
          </Text>
          {!shared.amLeader && !shared.useSharedSegments && (
            <Button title="Follow Leader" onPress={() => lobbyRuntime.followReplayLeader()} />
          )}
        </View>
      )}
    </View>
  );

  if (isFinished) {
    const history = liveRoom.gameHistory;
    const gameOver = [...replay.actions].reverse().find((action) => (
      action.type === 'gameOver'
    ));
    const times = [...replay.actions].reverse().find((action) => (
      action.type === 'playerTimes'
    ));
    const endCondition = history?.endCondition
      ?? (gameOver?.type === 'gameOver' ? gameOver.endCondition : 0);
    const endConditionText = END_CONDITION_TEXT[endCondition] ?? `End condition ${endCondition}`;
    const timestampDuration = durationBetween(
      clientState.datetimeStarted ?? '',
      clientState.datetimeFinished ?? '',
    );
    const canQuickRematch = sessionPhase === 'ready'
      && isQuickRematchEligible(clientState, roomState.pendingRestartTableID);
    const canRestartToPregame = sessionPhase === 'ready'
      && isRestartToPregameEligible(clientState, roomState.pendingRestartTableID);

    return (
      <View style={styles.screen}>
        <View style={styles.finishedHeader}>
          <Text style={styles.gameOver}>GAME OVER</Text>
          <Text style={styles.finalScore}>{ongoingGame.score}</Text>
          <Text style={styles.scoreLabel}>FINAL SCORE</Text>
        </View>

        <View style={styles.statRow}>
          <Stat label="Strikes" value={ongoingGame.strikes.length} />
          <Stat label="Clues" value={getDisplayedClueTokens(
            ongoingGame.clueTokens, metadata.options.variantName,
          )} />
          <Stat label="Cards remaining" value={ongoingGame.cardsRemainingInTheDeck} />
        </View>

        <View style={styles.resultDetails}>
          <Text>End: {endConditionText}</Text>
          <Text>Players: {metadata.playerNames.join(', ')}</Text>
          <Text>Turns: {history?.numTurns ?? ongoingGame.turn.turnNum}</Text>
          {replay.databaseID !== null && (
            <Text>Game ID: {replay.databaseID}</Text>
          )}
          <Text>Seed: {metadata.seed}</Text>
          {times?.type === 'playerTimes' && (
            <>
              <Text>Duration: {formatMilliseconds(times.duration)}</Text>
              {times.playerTimes.map((time, index) => (
                <Text key={metadata.playerNames[index] ?? index}>
                  {metadata.playerNames[index] ?? `Player ${index + 1}`}: {formatMilliseconds(time)}
                </Text>
              ))}
            </>
          )}
          {times?.type !== 'playerTimes' && timestampDuration !== null && (
            <Text>Duration: {formatMilliseconds(timestampDuration)}</Text>
          )}
        </View>

        {shared !== null && (
          <View style={styles.resultDetails}>
            <Text style={styles.subheading}>Shared replay</Text>
            <Text>{clientState.spectators.length} active spectators</Text>
            {clientState.spectators.map((spectator) => (
              <Text key={spectator.name}>
                {spectator.name}
                {spectator.shadowingPlayerUsername === ''
                  ? ''
                  : ` (viewing as ${spectator.shadowingPlayerUsername})`}
              </Text>
            ))}
            {shared.amLeader && (
              <>
                <Button
                  disabled={!canQuickRematch}
                  title={roomState.pendingRestartTableID === null
                    ? 'Quick rematch'
                    : 'Starting rematch...'}
                  onPress={() => lobbyRuntime.quickRematch()}
                />
                <Button
                  disabled={!canRestartToPregame}
                  title={roomState.pendingRestartTableID === null
                    ? 'Remake table'
                    : 'Remaking table...'}
                  onPress={() => lobbyRuntime.restartToPregame()}
                />
              </>
            )}
          </View>
        )}

        {reviewControls}
        <ReplayTable
          game={displayedGame}
          variantName={metadata.options.variantName}
        />
        <ReplayHands
          game={displayedGame}
          playerNames={metadata.playerNames}
          variantName={metadata.options.variantName}
        />
        <ReadOnlyCardNotes notes={clientState.notes.allNotes} />

        <View style={styles.gameLog}>
          <Text style={styles.subheading}>Full game log</Text>
          {ongoingGame.log.map((entry, index) => (
            <Text key={`${entry.turn}-${index}`} style={styles.logEntry}>
              {entry.text}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  const isOurTurn = playerLiveRoom !== null
    && displayedGame.turn.currentPlayerIndex === ourPlayerIndex;
  const gameplayControlsEnabled = sessionPhase === 'ready'
    && isOurTurn
    && !replay.active
    && !clientState.pause.active
    && roomState.pendingGameplayAction === null;
  const clueChoices = playerLiveRoom === null
    ? null
    : getGameplayClueChoicesForPlayer(playerLiveRoom.clientState.metadata);
  const currentPlayerIndex = displayedGame.turn.currentPlayerIndex;
  const currentPlayerName = currentPlayerIndex === null
    ? 'No current player'
    : metadata.playerNames[currentPlayerIndex] ?? `Player ${currentPlayerIndex + 1}`;
  const pendingAction = roomState.pendingGameplayAction?.action ?? null;
  const pendingLabel = pendingAction === null
    ? null
    : ['Playing card', 'Discarding card', 'Giving color clue', 'Giving rank clue'][
      pendingAction.type
    ];
  const visiblePlayerIndexes = metadata.playerNames
    .map((_, playerIndex) => playerIndex)
    .filter((playerIndex) => playerLiveRoom === null || playerIndex !== ourPlayerIndex);
  const cardActionsEnabled = gameplayControlsEnabled && selectedCardOrder !== null;
  const clueActionsEnabled = gameplayControlsEnabled
    && hasClueTokenForVariant(displayedGame.clueTokens, metadata.options.variantName)
    && selectedClueTarget !== null;
  const tableSuits = getGameTableSuits(
    metadata.options.variantName,
    displayedGame,
  );
  const notesEditable = sessionPhase === 'ready'
    && !replay.active
    && !clientState.finished
    && !liveRoom.sharedReplay
    && selectedCardOrder !== null;
  const pauseLabel = clientState.pause.active
    ? 'Unpause'
    : isOurTurn
      ? 'Pause'
      : clientState.pause.queued
        ? 'Cancel queued pause'
        : 'Queue pause';
  const clockText = (playerIndex: number) => liveRoom.clock === null
    ? null
    : getDisplayedClockString(
      liveRoom.clock, playerIndex, clientState.pause.active, clockNowMs,
    );

  return (
    <View style={styles.screen}>
      {reviewControls}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TURN {displayedGame.turn.turnNum}</Text>
          <Text style={styles.heading}>{currentPlayerName}</Text>
          <Text style={styles.turnStatus}>
            {replay.active
              ? 'Reviewing an earlier segment'
              : playerLiveRoom === null
              ? 'Spectating'
              : isOurTurn ? 'Your turn' : 'Waiting for another player'}
          </Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreValue}>{displayedGame.score}</Text>
          <Text style={styles.scoreLabel}>SCORE</Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <Stat label="Clues" value={getDisplayedClueTokens(
          displayedGame.clueTokens, metadata.options.variantName,
        )} />
        <Stat label="Strikes" value={displayedGame.strikes.length} />
        <Stat label="Deck" value={displayedGame.cardsRemainingInTheDeck} />
      </View>

      {timedOngoing && clientState.pause.active && (
        <Text style={styles.paused}>Paused</Text>
      )}
      {timedOngoing && playerLiveRoom !== null && (
        <Button title={pauseLabel} onPress={() => lobbyRuntime.pauseGame()} />
      )}

      <View style={styles.tableArea}>
        <Text style={styles.subheading}>Table</Text>
        <Text style={styles.tableLabel}>Play stacks</Text>
        <View style={styles.playStacks}>
          {tableSuits.map((suit) => (
            <View key={suit.suitIndex} style={styles.playStack}>
              <Text style={styles.stackSuit}>{suit.suitName}</Text>
              <Text style={styles.stackTop}>{suit.topCardLabel ?? 'Empty'}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.tableLabel}>Discards</Text>
        <View style={styles.discardList}>
          {tableSuits.map((suit) => (
            <View key={suit.suitIndex} style={styles.discardRow}>
              <Text style={styles.discardSuit}>{suit.suitName}</Text>
              <Text style={styles.discardCards}>
                {suit.discardCardLabels.length === 0
                  ? '—'
                  : suit.discardCardLabels.join(', ')}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {pendingLabel !== null && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>{pendingLabel}… awaiting server</Text>
        </View>
      )}

      {playerLiveRoom !== null && (
        <>
          <View style={styles.playerHeadingRow}>
            <Text style={styles.subheading}>Your hand</Text>
            {timedOngoing && clockText(metadata.ourPlayerIndex) !== null && (
              <Text style={styles.clock}>{clockText(metadata.ourPlayerIndex)}</Text>
            )}
            <Text style={styles.presenceText}>
              {getPlayerPresence(
                liveRoom.connected?.[metadata.ourPlayerIndex],
                Object.values(lobbyUsers).find(
                  (user) => user?.name === metadata.playerNames[metadata.ourPlayerIndex],
                )?.inactive ?? false,
              )}
            </Text>
          </View>
          <Text style={styles.helper}>Tap a card to select it. Its identity stays hidden.</Text>
          <View style={styles.cardList}>
            {ourHand.map((order, position) => {
              const card = displayedGame.deck[order];
              if (card === undefined) {
                return <Text key={order}>Card {position + 1} unavailable</Text>;
              }
              const knowledge = getCardKnowledgeViewModel(
                playerLiveRoom.clientState.metadata.options.variantName,
                card,
              );
              return (
                <GameCard
                  key={order}
                  knowledge={knowledge}
                  position={position}
                  selected={selectedCardOrder === order}
                  onSelect={() => setSelectedCardOrder(order)}
                />
              );
            })}
          </View>

          <View style={styles.actionArea}>
            <Text style={styles.actionTitle}>
              {selectedCardOrder === null
                ? 'Select a card'
                : `Card ${ourHand.findIndex((order) => order === selectedCardOrder) + 1} selected`}
            </Text>
            <Text style={styles.helper}>
              {!isOurTurn
                ? 'Actions unlock on your turn.'
                : pendingLabel ?? 'Choose Play or Discard.'}
            </Text>
            <View style={styles.buttonRow}>
              <View style={styles.buttonCell}>
                <Button
                  disabled={!cardActionsEnabled}
                  title="Play selected"
                  onPress={() => {
                    if (selectedCardOrder !== null) lobbyRuntime.play(selectedCardOrder);
                  }}
                />
              </View>
              <View style={styles.buttonCell}>
                <Button
                  disabled={!cardActionsEnabled}
                  title="Discard selected"
                  onPress={() => {
                    if (selectedCardOrder !== null) lobbyRuntime.discard(selectedCardOrder);
                  }}
                />
              </View>
            </View>
          </View>
        </>
      )}

      <Text style={styles.subheading}>
        {playerLiveRoom === null ? 'Players' : 'Other players'}
      </Text>
      <View style={styles.playerList}>
        {visiblePlayerIndexes.map((playerIndex) => {
          const isTarget = selectedClueTarget === playerIndex;
          return (
            <Pressable
              accessibilityRole={playerLiveRoom === null ? undefined : 'button'}
              accessibilityState={playerLiveRoom === null ? undefined : { selected: isTarget }}
              disabled={playerLiveRoom === null}
              key={playerIndex}
              onPress={() => setSelectedClueTarget(playerIndex)}
              style={[styles.playerRow, isTarget && styles.selectedPlayer]}
            >
              <View style={styles.playerHeadingRow}>
                <Text style={styles.playerName}>{metadata.playerNames[playerIndex]}</Text>
                {timedOngoing && clockText(playerIndex) !== null && (
                  <Text style={styles.clock}>{clockText(playerIndex)}</Text>
                )}
                <Text style={styles.presenceText}>
                  {getPlayerPresence(
                    liveRoom.connected?.[playerIndex],
                    Object.values(lobbyUsers).find(
                      (user) => user?.name === metadata.playerNames[playerIndex],
                    )?.inactive ?? false,
                  )}
                </Text>
                {isTarget && <Text style={styles.selectedLabel}>CLUE TARGET</Text>}
              </View>
              <View style={styles.visibleHand}>
                {displayedGame.hands[playerIndex]?.map((order, position) => {
                  const card = displayedGame.deck[order];
                  return (
                    <Pressable
                      accessibilityRole={liveRoom.role === 'spectator' ? 'button' : undefined}
                      accessibilityState={liveRoom.role === 'spectator'
                        ? { selected: selectedCardOrder === order }
                        : undefined}
                      disabled={liveRoom.role !== 'spectator' || replay.active}
                      key={order}
                      onPress={() => setSelectedCardOrder(order)}
                      style={[
                        styles.visibleCard,
                        selectedCardOrder === order && liveRoom.role === 'spectator'
                          ? styles.selectedVisibleCard
                          : undefined,
                      ]}
                    >
                      <Text style={styles.visibleCardPosition}>{position + 1}</Text>
                      <Text style={styles.visibleCardIdentity}>
                        {card === undefined
                          ? 'Unknown'
                          : getVisibleCardIdentityLabel(
                            metadata.options.variantName,
                            card.suitIndex,
                            card.rank,
                          )}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.noteArea}>
        <Text style={styles.actionTitle}>Selected card note</Text>
        <TextInput
          editable={notesEditable}
          maxLength={300}
          onChangeText={setNoteText}
          placeholder={selectedCardOrder === null ? 'Select a card' : 'Add a note'}
          style={styles.noteInput}
          value={noteText}
        />
        {liveRoom.role === 'spectator' && selectedCombinedNotes.length > 0 && (
          <View style={styles.combinedNotes}>
            <Text style={styles.controlLabel}>Combined notes</Text>
            {selectedCombinedNotes.map((note, index) => (
              <Text key={`${note.name}-${index}`} style={styles.helper}>
                {note.name}: {note.text}
              </Text>
            ))}
          </View>
        )}
        <View style={styles.buttonRow}>
          <View style={styles.buttonCell}>
            <Button
              disabled={!notesEditable || noteText.length > 300}
              title="Save"
              onPress={() => {
                if (selectedCardOrder !== null) {
                  lobbyRuntime.editNote(selectedCardOrder, noteText);
                }
              }}
            />
          </View>
          <View style={styles.buttonCell}>
            <Button
              disabled={!notesEditable}
              title="Clear"
              onPress={() => {
                if (selectedCardOrder !== null && lobbyRuntime.editNote(selectedCardOrder, '')) {
                  setNoteText('');
                }
              }}
            />
          </View>
        </View>
      </View>

      {playerLiveRoom !== null && (
        <View style={styles.clueArea}>
          <Text style={styles.actionTitle}>
            Give a clue to {selectedClueTarget === null
              ? 'a player'
              : playerLiveRoom.clientState.metadata.playerNames[selectedClueTarget]}
          </Text>
          <Text style={styles.helper}>
            {!hasClueTokenForVariant(displayedGame.clueTokens, metadata.options.variantName)
              ? 'No clue tokens available.'
              : 'Choose a color or rank.'}
          </Text>
          <Text style={styles.controlLabel}>Color</Text>
          <View style={styles.buttonWrap}>
            {clueChoices?.colors.map((choice) => (
              <Button
                disabled={!clueActionsEnabled}
                key={choice.value}
                title={choice.label}
                onPress={() => {
                  if (selectedClueTarget !== null) {
                    lobbyRuntime.colorClue(selectedClueTarget, choice.value);
                  }
                }}
              />
            ))}
          </View>
          <Text style={styles.controlLabel}>Rank</Text>
          <View style={styles.buttonWrap}>
            {clueChoices?.ranks.map((choice) => (
              <Button
                disabled={!clueActionsEnabled}
                key={choice.value}
                title={choice.label}
                onPress={() => {
                  if (selectedClueTarget !== null) {
                    lobbyRuntime.rankClue(selectedClueTarget, choice.value);
                  }
                }}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.gameLog}>
        <Text style={styles.subheading}>Game log</Text>
        {displayedGame.log.map((entry, index) => (
          <Text key={`${entry.turn}-${index}`} style={styles.logEntry}>
            {entry.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

function getPlayerPresence(connected: boolean | undefined, inactive: boolean): string {
  if (connected === false) return 'disconnected';
  return inactive ? 'away' : 'online';
}

function ReadOnlyCardNotes({
  notes,
}: {
  notes: ReadonlyArray<readonly { name: string; text: string; isSpectator: boolean }[]>;
}) {
  const entries = notes.flatMap((cardNotes, order) => {
    const nonEmpty = cardNotes.filter((note) => note.text.trim().length > 0);
    return nonEmpty.length === 0 ? [] : [{ order, notes: nonEmpty }];
  });
  if (entries.length === 0) return null;
  return (
    <View style={styles.noteArea}>
      <Text style={styles.subheading}>Card notes</Text>
      {entries.map((entry) => (
        <View key={entry.order} style={styles.combinedNotes}>
          <Text style={styles.controlLabel}>Card order {entry.order}</Text>
          {entry.notes.map((note, index) => (
            <Text key={`${note.name}-${index}`} style={styles.helper}>
              {note.name}: {note.text}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function ReplayTable({ game, variantName }: { game: GameState; variantName: string }) {
  const suits = getGameTableSuits(variantName, game);
  return (
    <View style={styles.tableArea}>
      <Text style={styles.subheading}>Replay table</Text>
      <Text style={styles.tableLabel}>Play stacks</Text>
      <View style={styles.playStacks}>
        {suits.map((suit) => (
          <View key={suit.suitIndex} style={styles.playStack}>
            <Text style={styles.stackSuit}>{suit.suitName}</Text>
            <Text style={styles.stackTop}>{suit.topCardLabel ?? 'Empty'}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.tableLabel}>Discards</Text>
      <View style={styles.discardList}>
        {suits.map((suit) => (
          <View key={suit.suitIndex} style={styles.discardRow}>
            <Text style={styles.discardSuit}>{suit.suitName}</Text>
            <Text style={styles.discardCards}>
              {suit.discardCardLabels.length === 0 ? '—' : suit.discardCardLabels.join(', ')}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ReplayHands({
  game,
  playerNames,
  variantName,
}: {
  game: GameState;
  playerNames: readonly string[];
  variantName: string;
}) {
  return (
    <View style={styles.playerList}>
      <Text style={styles.subheading}>Replay hands</Text>
      {playerNames.map((name, playerIndex) => (
        <View key={name} style={styles.playerRow}>
          <Text style={styles.playerName}>{name}</Text>
          <View style={styles.visibleHand}>
            {game.hands[playerIndex]?.map((order, position) => {
              const card = game.deck[order];
              const knowledge = card === undefined
                ? null
                : getCardKnowledgeViewModel(variantName, card);
              return (
                <View style={styles.visibleCard} key={order}>
                  <Text style={styles.visibleCardPosition}>{position + 1}</Text>
                  <Text style={styles.visibleCardIdentity}>
                    {card === undefined || card.suitIndex === null || card.rank === null
                      ? 'Unknown'
                      : getVisibleCardIdentityLabel(
                        variantName,
                        card.suitIndex,
                        card.rank,
                      )}
                  </Text>
                  {knowledge !== null && (
                    <CardKnowledgeDetails knowledge={knowledge} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function formatMilliseconds(value: number): string {
  const seconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function durationBetween(started: string, finished: string): number | null {
  const start = Date.parse(started);
  const finish = Date.parse(finished);
  return Number.isFinite(start) && Number.isFinite(finish) && finish >= start
    ? finish - start
    : null;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 12, paddingBottom: 24 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: { color: '#626b73', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  heading: { fontSize: 24, fontWeight: '700' },
  turnStatus: { color: '#46515c', marginTop: 2 },
  scoreBlock: { alignItems: 'center', minWidth: 64 },
  scoreValue: { fontSize: 28, fontWeight: '700' },
  scoreLabel: { color: '#626b73', fontSize: 11, fontWeight: '700' },
  finishedHeader: { alignItems: 'center', gap: 2, paddingVertical: 12 },
  gameOver: { color: '#9e2a2b', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  finalScore: { fontSize: 40, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: {
    alignItems: 'center',
    backgroundColor: '#eef1f4',
    borderRadius: 8,
    flex: 1,
    padding: 10,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#626b73', fontSize: 12 },
  pendingBanner: { backgroundColor: '#fff0c2', borderRadius: 8, padding: 12 },
  pendingText: { color: '#654a00', fontWeight: '600' },
  paused: { color: '#9e2a2b', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  clock: { fontVariant: ['tabular-nums'], fontWeight: '700' },
  reviewArea: { backgroundColor: '#eef4ff', borderRadius: 10, gap: 8, padding: 12 },
  sharedReplayStatus: { gap: 6 },
  resultDetails: { backgroundColor: '#f3f5f7', borderRadius: 10, gap: 4, padding: 12 },
  gameLog: { backgroundColor: '#f3f5f7', borderRadius: 10, gap: 8, padding: 12 },
  logEntry: { color: '#303840' },
  subheading: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  tableArea: { backgroundColor: '#f3f5f7', borderRadius: 10, gap: 8, padding: 12 },
  tableLabel: { color: '#46515c', fontSize: 12, fontWeight: '700' },
  playStacks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playStack: {
    backgroundColor: '#fff',
    borderColor: '#c7ccd1',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 96,
    padding: 10,
  },
  stackSuit: { color: '#46515c', fontSize: 12, fontWeight: '600' },
  stackTop: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  discardList: { gap: 4 },
  discardRow: { flexDirection: 'row', gap: 8 },
  discardSuit: { fontWeight: '600', width: 72 },
  discardCards: { color: '#303840', flex: 1 },
  helper: { color: '#626b73' },
  cardList: { gap: 8 },
  actionArea: { backgroundColor: '#eef4ff', borderRadius: 10, gap: 8, padding: 12 },
  clueArea: { backgroundColor: '#f3f5f7', borderRadius: 10, gap: 8, padding: 12 },
  actionTitle: { fontSize: 16, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 8 },
  buttonCell: { flex: 1 },
  playerList: { gap: 8 },
  playerRow: {
    backgroundColor: '#fff',
    borderColor: '#c7ccd1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  selectedPlayer: { borderColor: '#2457a6', borderWidth: 2, padding: 9 },
  playerHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  playerName: { fontWeight: '600' },
  selectedLabel: { color: '#2457a6', fontSize: 11, fontWeight: '700' },
  presenceText: { color: '#626b73', fontSize: 12 },
  visibleHand: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  visibleCard: {
    alignItems: 'center',
    backgroundColor: '#eef1f4',
    borderRadius: 6,
    minWidth: 72,
    padding: 8,
  },
  selectedVisibleCard: { borderColor: '#2457a6', borderWidth: 2 },
  noteArea: { backgroundColor: '#f3f5f7', borderRadius: 10, gap: 8, padding: 12 },
  noteInput: {
    backgroundColor: '#fff',
    borderColor: '#c7ccd1',
    borderRadius: 6,
    borderWidth: 1,
    padding: 10,
  },
  combinedNotes: { gap: 3 },
  visibleCardPosition: { color: '#626b73', fontSize: 11 },
  visibleCardIdentity: { fontWeight: '600' },
  controlLabel: { fontWeight: '600', marginTop: 2 },
  buttonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
