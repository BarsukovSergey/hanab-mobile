import { HanabNetworkSession } from '../network/NetworkSession';
import { store } from '../store/store';
import { LobbyRuntime } from './LobbyRuntime';
import { createRuntimeCommandGate } from './runtimeCommandGate';
import { TerminationRuntime } from './terminationRuntime';

export const networkSession = new HanabNetworkSession();
const rawLobbyRuntime = new LobbyRuntime(networkSession, store);
const gameplayCommandGate = createRuntimeCommandGate(rawLobbyRuntime, [
  'play',
  'discard',
  'colorClue',
  'rankClue',
  'editNote',
  'pauseGame',
  'navigateReplaySegment',
  'followReplayLeader',
  'quickRematch',
  'restartToPregame',
  'startHypothetical',
  'endHypothetical',
  'backHypothetical',
  'toggleHypotheticalDrawnCards',
  'hypotheticalPlay',
  'hypotheticalDiscard',
  'hypotheticalColorClue',
  'hypotheticalRankClue',
]);

export const lobbyRuntime = gameplayCommandGate.runtime;
export const suppressGameplayRuntimeCommands = () => gameplayCommandGate.suppress();
export const terminationRuntime = new TerminationRuntime(rawLobbyRuntime, store);
