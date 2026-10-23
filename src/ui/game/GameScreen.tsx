import type { ReactNode, RefObject } from 'react';
import { Text, View } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { C17GameScreen } from './C17GameScreen';
import { isC17WorkspaceEligible } from './c17Workspace';

export type ReplayExitControl = { onExit: () => void; pending: boolean };
export type RoomChildren = (landscapeRightWidth: number | null) => ReactNode;

/**
 * Gameplay is only available after the live-game bootstrap has completed.
 * Never expose gameplay actions for malformed/unexpected room metadata.
 */
export function GameScreen({ replayExit, noteBackRef, presentationVisible = true, roomChildren, heightConstrained = false, landscapeHeader, landscapeHeaderMinWidth = 0 }: { replayExit?: ReplayExitControl; noteBackRef?: RefObject<(() => boolean) | null>; presentationVisible?: boolean; roomChildren?: RoomChildren; heightConstrained?: boolean; landscapeHeader?: ReactNode; landscapeHeaderMinWidth?: number }) {
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

  if (!useC17 || clientState === null || clientState.metadata.options.numPlayers !== clientState.metadata.playerNames.length) {
    return (
      <View style={{ flex: 1 }} pointerEvents="none" accessibilityElementsHidden={!presentationVisible} importantForAccessibility={presentationVisible ? 'auto' : 'no-hide-descendants'}>
        <Text accessibilityRole="alert">Unable to display game: unsupported or inconsistent player data.</Text>
      </View>
    );
  }

  return <C17GameScreen noteBackRef={noteBackRef} presentationVisible={presentationVisible} roomChildren={roomChildren} heightConstrained={heightConstrained} landscapeHeader={landscapeHeader} landscapeHeaderMinWidth={landscapeHeaderMinWidth} replayExit={replayExit} />;
}
