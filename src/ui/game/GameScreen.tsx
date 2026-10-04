import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { C17GameScreen } from './C17GameScreen';
import { GameScreen as LegacyGameScreen } from './LegacyGameScreen';
import { isC17WorkspaceEligible } from './c17Workspace';

export type RoomChildren = (landscapeRightWidth: number | null) => ReactNode;

export function GameScreen({ presentationVisible = true, roomChildren }: { presentationVisible?: boolean; roomChildren?: RoomChildren }) {
  const room = useAppSelector((state) => state.room.room);
  const liveRoom = room.kind === 'live_game' ? room : null;
  const clientState = liveRoom?.clientState ?? null;

  const useC17 = isC17WorkspaceEligible({
    isLiveParticipant: liveRoom !== null,
    playerCount: clientState?.metadata.playerNames.length ?? 0,
    portrait: true,
    finished: clientState?.finished ?? false,
    replayActive: clientState?.replay.active ?? false,
    sharedReplay: liveRoom?.sharedReplay ?? false,
  });

  return useC17
    ? <C17GameScreen presentationVisible={presentationVisible} roomChildren={roomChildren} />
    : <View style={{ flex: 1 }}><View pointerEvents={presentationVisible ? 'auto' : 'none'} accessibilityElementsHidden={!presentationVisible} importantForAccessibility={presentationVisible ? 'auto' : 'no-hide-descendants'}><LegacyGameScreen presentationVisible={presentationVisible} /></View>{roomChildren?.(null)}</View>;
}
