import { View } from 'react-native';
import type { RoomState } from '../store/roomSlice';
import { ActionButton, Panel, SectionHeading } from './designSystem';

export function GameBootstrapStatus({ room, onRetry, onBrowse }: {
  room: Extract<RoomState, { kind: 'awaiting_game_bootstrap' }>;
  onRetry: () => void;
  onBrowse: () => void;
}) {
  const failed = room.bootstrap !== 'pending_c5' && room.bootstrap.phase === 'failed';
  return <Panel>
    {failed ? <View accessibilityRole="alert" accessibilityLiveRegion="polite">
      <SectionHeading title="Unable to load game"
        detail="Retry reconnects to receive fresh game state. If the room cannot be restored, you will return to browsing." />
    </View> : <SectionHeading title="Loading game…" detail="Receiving the authoritative game state." />}
    {failed && <ActionButton title="Retry" accessibilityLabel="Retry loading game" tone="primary" onPress={onRetry} />}
    <ActionButton title="Home" onPress={onBrowse} />
  </Panel>;
}
