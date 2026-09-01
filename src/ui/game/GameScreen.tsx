import { useEffect, useMemo, useState } from 'react';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';

import { getCardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import {
  getGameTableSuits,
  getGameplayClueChoices,
  getVisibleCardIdentityLabel,
} from '../../game/selectors/gameplay';
import { lobbyRuntime } from '../../runtime/application';
import { buildReplayTimeline } from '../../game/replay/ReplayTimeline';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { roomActions } from '../../store/roomSlice';
import { GameCard } from './GameCard';
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
  const liveRoom = roomState.room.kind === 'live_game' ? roomState.room : null;
  const [selectedCardOrder, setSelectedCardOrder] = useState<number | null>(null);
  const [selectedClueTarget, setSelectedClueTarget] = useState<number | null>(null);

  const timeline = useMemo(() => liveRoom === null ? null : buildReplayTimeline(
    liveRoom.metadata,
    liveRoom.postgame.identitiesRevealed
      ? 'finished'
      : liveRoom.role === 'player' ? 'player-live' : 'spectator-live',
    liveRoom.actionHistory,
  ), [liveRoom]);
  const selectedSnapshot = liveRoom?.reviewSegment === null
    ? null
    : timeline?.snapshots.find((snapshot) => snapshot.segment === liveRoom?.reviewSegment) ?? null;
  const displayedGame = selectedSnapshot?.game ?? liveRoom?.game ?? null;

  const playerLiveRoom = liveRoom?.role === 'player' ? liveRoom : null;
  const ourPlayerIndex = playerLiveRoom?.metadata.ourPlayerIndex ?? null;
  const ourHand = ourPlayerIndex === null
    ? []
    : displayedGame?.hands[ourPlayerIndex] ?? [];
  const clueTargetIndexes = playerLiveRoom?.metadata.playerNames
    .map((_, playerIndex) => playerIndex)
    .filter((playerIndex) => playerIndex !== ourPlayerIndex) ?? [];

  useEffect(() => {
    if (ourHand.length === 0) {
      setSelectedCardOrder(null);
    } else if (
      selectedCardOrder === null
      || !ourHand.some((order) => order === selectedCardOrder)
    ) {
      setSelectedCardOrder(ourHand[0] ?? null);
    }
  }, [ourHand, selectedCardOrder]);

  useEffect(() => {
    if (
      selectedClueTarget === null
      || !clueTargetIndexes.includes(selectedClueTarget)
    ) {
      setSelectedClueTarget(clueTargetIndexes[0] ?? null);
    }
  }, [clueTargetIndexes, selectedClueTarget]);

  if (liveRoom === null) return null;

  if (displayedGame === null || timeline === null) return null;

  const isFinished = liveRoom.game.turn.currentPlayerIndex === null;
  const latestSegment = timeline.snapshots.at(-1)?.segment ?? 0;
  const currentSegment = liveRoom.reviewSegment ?? latestSegment;
  const reviewControls = (
    <View style={styles.reviewArea}>
      <Text style={styles.actionTitle}>
        {liveRoom.reviewSegment === null ? 'Live' : 'Review'} · Segment {currentSegment}
        {' / '}{latestSegment} · Turn {displayedGame.turn.turnNum}
      </Text>
      <View style={styles.buttonWrap}>
        <Button
          disabled={timeline.snapshots.length === 0 || currentSegment === 0}
          title="First"
          onPress={() => dispatch(roomActions.reviewSegmentSelected({
            tableID: liveRoom.tableID,
            gameLoadEpoch: liveRoom.gameLoadEpoch,
            segment: timeline.snapshots[0]?.segment ?? 0,
          }))}
        />
        <Button
          disabled={timeline.snapshots.length === 0 || currentSegment <= 0}
          title="Previous"
          onPress={() => {
            const previous = [...timeline.snapshots]
              .reverse()
              .find((snapshot) => snapshot.segment < currentSegment);
            if (previous !== undefined) dispatch(roomActions.reviewSegmentSelected({
              tableID: liveRoom.tableID,
              gameLoadEpoch: liveRoom.gameLoadEpoch,
              segment: previous.segment,
            }));
          }}
        />
        <Button
          disabled={liveRoom.reviewSegment === null || currentSegment >= latestSegment}
          title="Next"
          onPress={() => {
            const next = timeline.snapshots.find((snapshot) => snapshot.segment > currentSegment);
            if (next !== undefined) dispatch(roomActions.reviewSegmentSelected({
              tableID: liveRoom.tableID,
              gameLoadEpoch: liveRoom.gameLoadEpoch,
              segment: next.segment,
            }));
          }}
        />
        <Button
          disabled={liveRoom.reviewSegment === null}
          title="Latest live"
          onPress={() => dispatch(roomActions.reviewSegmentSelected({
            tableID: liveRoom.tableID,
            gameLoadEpoch: liveRoom.gameLoadEpoch,
            segment: null,
          }))}
        />
      </View>
    </View>
  );

  if (isFinished) {
    const history = liveRoom.postgame.gameHistory;
    const gameOver = [...liveRoom.actionHistory].reverse().find((action) => (
      action.type === 'gameOver'
    ));
    const times = [...liveRoom.actionHistory].reverse().find((action) => (
      action.type === 'playerTimes'
    ));
    const endCondition = history?.endCondition
      ?? (gameOver?.type === 'gameOver' ? gameOver.endCondition : 0);
    const endConditionText = END_CONDITION_TEXT[endCondition] ?? `End condition ${endCondition}`;
    const timestampDuration = durationBetween(
      liveRoom.postgame.datetimeStarted,
      liveRoom.postgame.datetimeFinished,
    );

    return (
      <View style={styles.screen}>
        <View style={styles.finishedHeader}>
          <Text style={styles.gameOver}>GAME OVER</Text>
          <Text style={styles.finalScore}>{liveRoom.game.score}</Text>
          <Text style={styles.scoreLabel}>FINAL SCORE</Text>
        </View>

        <View style={styles.statRow}>
          <Stat label="Strikes" value={liveRoom.game.strikes.length} />
          <Stat label="Clues" value={liveRoom.game.clueTokens} />
          <Stat label="Cards remaining" value={liveRoom.game.cardsRemainingInTheDeck} />
        </View>

        <View style={styles.resultDetails}>
          <Text>End: {endConditionText}</Text>
          <Text>Players: {liveRoom.metadata.playerNames.join(', ')}</Text>
          <Text>Turns: {history?.numTurns ?? liveRoom.game.turn.turnNum}</Text>
          {liveRoom.postgame.databaseID !== null && (
            <Text>Game ID: {liveRoom.postgame.databaseID}</Text>
          )}
          <Text>Seed: {liveRoom.metadata.seed}</Text>
          {times?.type === 'playerTimes' && (
            <>
              <Text>Duration: {formatMilliseconds(times.duration)}</Text>
              {times.playerTimes.map((time, index) => (
                <Text key={liveRoom.metadata.playerNames[index] ?? index}>
                  {liveRoom.metadata.playerNames[index] ?? `Player ${index + 1}`}: {formatMilliseconds(time)}
                </Text>
              ))}
            </>
          )}
          {times?.type !== 'playerTimes' && timestampDuration !== null && (
            <Text>Duration: {formatMilliseconds(timestampDuration)}</Text>
          )}
        </View>

        {reviewControls}
        <ReplayTable
          game={displayedGame}
          variantName={liveRoom.metadata.options.variantName}
        />
        <ReplayHands
          game={displayedGame}
          playerNames={liveRoom.metadata.playerNames}
          variantName={liveRoom.metadata.options.variantName}
        />

        <View style={styles.gameLog}>
          <Text style={styles.subheading}>Full game log</Text>
          {liveRoom.game.log.map((entry, index) => (
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
    && liveRoom.reviewSegment === null
    && roomState.pendingGameplayAction === null;
  const clueChoices = playerLiveRoom === null
    ? null
    : getGameplayClueChoices(playerLiveRoom.metadata.options.variantName);
  const currentPlayerIndex = displayedGame.turn.currentPlayerIndex;
  const currentPlayerName = currentPlayerIndex === null
    ? 'No current player'
    : liveRoom.metadata.playerNames[currentPlayerIndex] ?? `Player ${currentPlayerIndex + 1}`;
  const pendingAction = roomState.pendingGameplayAction?.action ?? null;
  const pendingLabel = pendingAction === null
    ? null
    : ['Playing card', 'Discarding card', 'Giving color clue', 'Giving rank clue'][
      pendingAction.type
    ];
  const visiblePlayerIndexes = liveRoom.metadata.playerNames
    .map((_, playerIndex) => playerIndex)
    .filter((playerIndex) => playerLiveRoom === null || playerIndex !== ourPlayerIndex);
  const cardActionsEnabled = gameplayControlsEnabled && selectedCardOrder !== null;
  const clueActionsEnabled = gameplayControlsEnabled
    && displayedGame.clueTokens > 0
    && selectedClueTarget !== null;
  const tableSuits = getGameTableSuits(
    liveRoom.metadata.options.variantName,
    displayedGame,
  );

  return (
    <View style={styles.screen}>
      {reviewControls}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TURN {displayedGame.turn.turnNum}</Text>
          <Text style={styles.heading}>{currentPlayerName}</Text>
          <Text style={styles.turnStatus}>
            {liveRoom.reviewSegment !== null
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
        <Stat label="Clues" value={displayedGame.clueTokens} />
        <Stat label="Strikes" value={displayedGame.strikes.length} />
        <Stat label="Deck" value={displayedGame.cardsRemainingInTheDeck} />
      </View>

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
          <Text style={styles.subheading}>Your hand</Text>
          <Text style={styles.helper}>Tap a card to select it. Its identity stays hidden.</Text>
          <View style={styles.cardList}>
            {ourHand.map((order, position) => {
              const card = displayedGame.deck[order];
              if (card === undefined) {
                return <Text key={order}>Card {position + 1} unavailable</Text>;
              }
              const knowledge = getCardKnowledgeViewModel(
                playerLiveRoom.metadata.options.variantName,
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
                <Text style={styles.playerName}>{liveRoom.metadata.playerNames[playerIndex]}</Text>
                {isTarget && <Text style={styles.selectedLabel}>CLUE TARGET</Text>}
              </View>
              <View style={styles.visibleHand}>
                {displayedGame.hands[playerIndex]?.map((order, position) => {
                  const card = displayedGame.deck[order];
                  return (
                    <View style={styles.visibleCard} key={order}>
                      <Text style={styles.visibleCardPosition}>{position + 1}</Text>
                      <Text style={styles.visibleCardIdentity}>
                        {card === undefined
                          ? 'Unknown'
                          : getVisibleCardIdentityLabel(
                            liveRoom.metadata.options.variantName,
                            card.suitIndex,
                            card.rank,
                          )}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Pressable>
          );
        })}
      </View>

      {playerLiveRoom !== null && (
        <View style={styles.clueArea}>
          <Text style={styles.actionTitle}>
            Give a clue to {selectedClueTarget === null
              ? 'a player'
              : playerLiveRoom.metadata.playerNames[selectedClueTarget]}
          </Text>
          <Text style={styles.helper}>
            {displayedGame.clueTokens === 0
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
  reviewArea: { backgroundColor: '#eef4ff', borderRadius: 10, gap: 8, padding: 12 },
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
  visibleHand: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  visibleCard: {
    alignItems: 'center',
    backgroundColor: '#eef1f4',
    borderRadius: 6,
    minWidth: 72,
    padding: 8,
  },
  visibleCardPosition: { color: '#626b73', fontSize: 11 },
  visibleCardIdentity: { fontWeight: '600' },
  controlLabel: { fontWeight: '600', marginTop: 2 },
  buttonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
