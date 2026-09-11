import { useMemo } from 'react';

import { useAppSelector } from '../../store/hooks';
import { useResponsiveLayout } from '../designSystem';
import { C17GameScreen } from './C17GameScreen';
import { GameScreen as LegacyGameScreen } from './LegacyGameScreen';
import { getGameplayLayout } from './gameplayLayout';
import { isC17WorkspaceEligible } from './c17Workspace';

export function GameScreen() {
  const { width, height } = useResponsiveLayout();
  const room = useAppSelector((state) => state.room.room);
  const liveRoom = room.kind === 'live_game' ? room : null;
  const clientState = liveRoom?.clientState ?? null;
  const ourIndex = clientState?.metadata.ourPlayerIndex ?? null;
  const game = clientState?.visibleState ?? null;
  const gameplayLayout = useMemo(() => getGameplayLayout({
    viewportWidth: width,
    viewportHeight: height,
    handSizes: game?.hands.map((hand) => hand.length) ?? [],
    ourPlayerIndex: ourIndex,
  }), [game, height, ourIndex, width]);

  const useC17 = isC17WorkspaceEligible({
    isLiveParticipant: liveRoom !== null,
    playerCount: clientState?.metadata.playerNames.length ?? 0,
    portrait: gameplayLayout.orientation === 'portrait',
    finished: clientState?.finished ?? false,
    replayActive: clientState?.replay.active ?? false,
  });

  return useC17 ? <C17GameScreen /> : <LegacyGameScreen />;
}
