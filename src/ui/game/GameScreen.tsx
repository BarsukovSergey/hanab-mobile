import { Button, StyleSheet, Text, View } from 'react-native';

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
  if (liveRoom === null) return null;

  const playerLiveRoom = liveRoom.role === 'player' ? liveRoom : null;
  const isOurTurn = playerLiveRoom !== null
    && playerLiveRoom.game.turn.currentPlayerIndex === playerLiveRoom.metadata.ourPlayerIndex;
  const gameplayControlsEnabled = sessionPhase === 'ready'
    && isOurTurn
    && roomState.pendingGameplayAction === null;
  const clueChoices = playerLiveRoom === null
    ? null
    : getGameplayClueChoices(playerLiveRoom.metadata.options.variantName);

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Authoritative LIVE game</Text>
      <Text>tableID: {liveRoom.tableID}</Text>
      <Text>role: {liveRoom.role}</Text>
      <Text>gameLoadEpoch: {liveRoom.gameLoadEpoch}</Text>
      <Text>bootstrap phase: LIVE</Text>
      <Text>authoritative history actions: {liveRoom.historyActionCount}</Text>
      <Text>live actions: {liveRoom.liveActionCount}</Text>
      <Text>turn number: {liveRoom.game.turn.turnNum}</Text>
      <Text>
        current player: {liveRoom.game.turn.currentPlayerIndex === null
          ? 'none'
          : `${liveRoom.game.turn.currentPlayerIndex}: ${
            liveRoom.metadata.playerNames[liveRoom.game.turn.currentPlayerIndex]
          }`}
      </Text>
      <Text>score: {liveRoom.game.score}</Text>
      <Text>clue tokens: {liveRoom.game.clueTokens}</Text>
      <Text>strikes: {liveRoom.game.strikes.length}</Text>
      <Text>cards remaining: {liveRoom.game.cardsRemainingInTheDeck}</Text>

      {playerLiveRoom !== null && (
        <>
          <Text>our turn: {isOurTurn ? 'YES' : 'NO'}</Text>
          <Text>
            pending action: {roomState.pendingGameplayAction === null
              ? 'NONE'
              : ['PLAY', 'DISCARD', 'COLOR CLUE', 'RANK CLUE'][
                roomState.pendingGameplayAction.action.type
              ]}
          </Text>
          <Text style={styles.subheading}>Our hand</Text>
          {playerLiveRoom.game.hands[playerLiveRoom.metadata.ourPlayerIndex]?.map(
            (order, position) => {
              const card = playerLiveRoom.game.deck[order];
              if (card === undefined) {
                return <Text key={order}>Card {position + 1} · order {order}: unavailable</Text>;
              }
              const knowledge = getCardKnowledgeViewModel(
                playerLiveRoom.metadata.options.variantName,
                card,
              );
              return (
                <GameCard
                  controlsEnabled={gameplayControlsEnabled}
                  key={order}
                  knowledge={knowledge}
                  position={position}
                  onDiscard={() => lobbyRuntime.discard(order)}
                  onPlay={() => lobbyRuntime.play(order)}
                />
              );
            },
          )}

          <Text style={styles.subheading}>Other players and visible cards</Text>
          {playerLiveRoom.metadata.playerNames.map((name, playerIndex) => {
            if (playerIndex === playerLiveRoom.metadata.ourPlayerIndex) return null;
            return (
              <View style={styles.playerRow} key={playerIndex}>
                <Text style={styles.playerName}>{playerIndex}: {name}</Text>
                {playerLiveRoom.game.hands[playerIndex]?.map((order) => {
                  const card = playerLiveRoom.game.deck[order];
                  return (
                    <Text key={order}>
                      order {order}: {card === undefined
                        ? 'unknown'
                        : getVisibleCardIdentityLabel(
                          playerLiveRoom.metadata.options.variantName,
                          card.suitIndex,
                          card.rank,
                        )}
                    </Text>
                  );
                })}
                <Text>Color clues:</Text>
                <View style={styles.buttonWrap}>
                  {clueChoices?.colors.map((choice) => (
                    <Button
                      disabled={!gameplayControlsEnabled}
                      key={choice.value}
                      title={choice.label}
                      onPress={() => lobbyRuntime.colorClue(playerIndex, choice.value)}
                    />
                  ))}
                </View>
                <Text>Rank clues:</Text>
                <View style={styles.buttonWrap}>
                  {clueChoices?.ranks.map((choice) => (
                    <Button
                      disabled={!gameplayControlsEnabled}
                      key={choice.value}
                      title={choice.label}
                      onPress={() => lobbyRuntime.rankClue(playerIndex, choice.value)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderColor: '#999', borderWidth: 1, gap: 8, padding: 12 },
  heading: { fontSize: 18, fontWeight: '600' },
  subheading: { fontSize: 16, fontWeight: '600', marginTop: 6 },
  playerRow: { borderColor: '#bbb', borderWidth: 1, gap: 5, padding: 8 },
  playerName: { fontWeight: '600' },
  buttonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
