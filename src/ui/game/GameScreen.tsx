import { useAppSelector } from '../../store/hooks';
import { C17GameScreen } from './C17GameScreen';
import { GameScreen as LegacyGameScreen } from './LegacyGameScreen';
import { isC17WorkspaceEligible } from './c17Workspace';

export function GameScreen() {
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

  return useC17 ? <C17GameScreen /> : <LegacyGameScreen />;
}
