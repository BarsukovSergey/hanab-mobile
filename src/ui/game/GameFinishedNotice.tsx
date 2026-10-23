import { useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RoomState } from '../../store/roomSlice';
import { ActionButton, useHanabTheme } from '../designSystem';
import { getGameFinishedResult, observeGameFinish, type FinishMemory } from './gameFinishedNoticePolicy';

export function GameFinishedNotice({ room, connectionEpoch, ready, presentationVisible }: {
  room: Extract<RoomState, { kind: 'live_game' }>;
  connectionEpoch: number; ready: boolean; presentationVisible: boolean;
}) {
  const { theme } = useHanabTheme();
  const memory = useRef<FinishMemory | null>(null);
  const [popupOwner, setPopupOwner] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const owner = `${connectionEpoch}:${room.tableID}:${room.gameLoadEpoch}`;
  const finished = room.clientState.finished;
  const eligibleLive = !finished && !room.sharedReplay && room.clientState.replay.shared === null
    && room.clientState.replay.databaseID === null;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const observation = observeGameFinish(memory.current, { owner, finished, eligibleLive,
      ready, visible: presentationVisible, appActive });
    memory.current = observation.memory;
    if (observation.show) {
      Keyboard.dismiss();
      setPopupOwner(owner);
    } else setPopupOwner((previous) => previous !== owner || !ready || !presentationVisible || !appActive ? null : previous);
  }, [owner, finished, eligibleLive, ready, presentationVisible, appActive]);

  if (popupOwner !== owner || !ready || !presentationVisible || !appActive) return null;
  const result = getGameFinishedResult(room);
  const dismiss = () => setPopupOwner(null);
  return <Modal animationType="fade" navigationBarTranslucent statusBarTranslucent transparent onRequestClose={dismiss} visible>
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal testID="game-finished-popup" style={[styles.popup,
          { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
          <ScrollView bounces={false} style={styles.copy} contentContainerStyle={styles.copyContent}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>Game finished</Text>
            <Text accessibilityLabel={`Final score ${result.score} out of ${result.maxScore}`} style={[styles.score, { color: theme.colors.text }]}>{result.score} / {result.maxScore}</Text>
            <Text style={[styles.reason, { color: theme.colors.textMuted }]}>{result.reason}</Text>
          </ScrollView>
          <ActionButton title="Continue to replay" tone="primary" onPress={dismiss} />
        </View>
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  popup: { borderRadius: 14, borderWidth: 1, flexShrink: 1, gap: 14, maxHeight: '100%', maxWidth: 420, padding: 14, width: '100%' },
  copy: { flexShrink: 1 },
  copyContent: { gap: 8 },
  title: { fontSize: 20, fontWeight: '900' },
  score: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  reason: { fontSize: 14 },
});
