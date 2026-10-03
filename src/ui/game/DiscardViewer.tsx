import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { GameState } from '../../game/bootstrap/types';
import { getGameTableSuits } from '../../game/selectors/gameplay';
import { isEngineTrash } from '../../game/selectors/cardStatePresentation';
import { useAppSelector } from '../../store/hooks';
import { ActionButton, useHanabTheme } from '../designSystem';
import { VisibleHanabiCard } from './GameCard';

export function DiscardViewer({
  game,
  variantName,
  visible,
  onClose,
}: {
  game: GameState;
  variantName: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useHanabTheme();
  const cardIdentities = useAppSelector((state) => (
    state.room.room.kind === 'live_game'
      ? state.room.room.clientState.cardIdentities
      : undefined
  ));
  const suits = getGameTableSuits(variantName, game);
  const total = game.discardStacks.reduce((sum, stack) => sum + stack.length, 0);

  return <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
    <View style={styles.backdrop}>
      <View style={[styles.sheet, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Discard pile</Text>
            <Text style={[styles.detail, { color: theme.colors.textMuted }]}>{total} card{total === 1 ? '' : 's'} discarded</Text>
          </View>
          <ActionButton compact title="Close" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {total === 0 ? <Text style={[styles.empty, { color: theme.colors.textMuted }]}>No discarded cards yet.</Text> : suits.map((suit) => {
            const orders = game.discardStacks[suit.suitIndex] ?? [];
            if (orders.length === 0) return null;
            return <View key={suit.suitIndex} style={styles.suitGroup}>
              <Text style={[styles.suitName, { color: theme.colors.text }]}>{suit.suitName}</Text>
              <View style={styles.cards}>{orders.map((order) => {
                const card = game.deck[order];
                if (card === undefined) return null;
                const authoritativeIdentity = cardIdentities?.[order];
                return <VisibleHanabiCard
                  key={order}
                  faded={isEngineTrash(game, authoritativeIdentity?.suitIndex ?? card.suitIndex, authoritativeIdentity?.rank ?? card.rank)}
                  rank={authoritativeIdentity?.rank ?? card.rank}
                  size="mini"
                  suitIndex={authoritativeIdentity?.suitIndex ?? card.suitIndex}
                  variantName={variantName}
                />;
              })}</View>
            </View>;
          })}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.58)', flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '86%', minHeight: '58%', padding: 14 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, fontWeight: '900' },
  detail: { fontSize: 12, lineHeight: 17 },
  content: { gap: 14, paddingBottom: 24, paddingTop: 14 },
  empty: { fontSize: 13, fontStyle: 'italic' },
  suitGroup: { gap: 7 },
  suitName: { fontSize: 13, fontWeight: '900' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
