import { useEffect, useState } from 'react';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';

import { getCardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import {
  getGameplayClueChoices,
  getVisibleCardIdentityLabel,
} from '../../game/selectors/gameplay';
import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { GameCard } from './GameCard';

export function GameScreen() {
  const sessionPhase = useAppSelector((state) => state.session.phase);
  const roomState = useAppSelector((state) => state.room);
  const liveRoom = roomState.room.kind === 'live_game' ? roomState.room : null;
  const [selectedCardOrder, setSelectedCardOrder] = useState<number | null>(null);
  const [selectedClueTarget, setSelectedClueTarget] = useState<number | null>(null);

  const playerLiveRoom = liveRoom?.role === 'player' ? liveRoom : null;
  const ourPlayerIndex = playerLiveRoom?.metadata.ourPlayerIndex ?? null;
  const ourHand = ourPlayerIndex === null
    ? []
    : playerLiveRoom?.game.hands[ourPlayerIndex] ?? [];
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

  const isOurTurn = playerLiveRoom !== null
    && liveRoom.game.turn.currentPlayerIndex === ourPlayerIndex;
  const gameplayControlsEnabled = sessionPhase === 'ready'
    && isOurTurn
    && roomState.pendingGameplayAction === null;
  const clueChoices = playerLiveRoom === null
    ? null
    : getGameplayClueChoices(playerLiveRoom.metadata.options.variantName);
  const currentPlayerIndex = liveRoom.game.turn.currentPlayerIndex;
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
    && liveRoom.game.clueTokens > 0
    && selectedClueTarget !== null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TURN {liveRoom.game.turn.turnNum}</Text>
          <Text style={styles.heading}>{currentPlayerName}</Text>
          <Text style={styles.turnStatus}>
            {playerLiveRoom === null
              ? 'Spectating'
              : isOurTurn ? 'Your turn' : 'Waiting for another player'}
          </Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreValue}>{liveRoom.game.score}</Text>
          <Text style={styles.scoreLabel}>SCORE</Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <Stat label="Clues" value={liveRoom.game.clueTokens} />
        <Stat label="Strikes" value={liveRoom.game.strikes.length} />
        <Stat label="Deck" value={liveRoom.game.cardsRemainingInTheDeck} />
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
              const card = playerLiveRoom.game.deck[order];
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
                {liveRoom.game.hands[playerIndex]?.map((order, position) => {
                  const card = liveRoom.game.deck[order];
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
            {liveRoom.game.clueTokens === 0
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
  subheading: { fontSize: 18, fontWeight: '700', marginTop: 6 },
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
