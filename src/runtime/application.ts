import { HanabNetworkSession } from '../network/NetworkSession';
import { store } from '../store/store';
import { LobbyRuntime } from './LobbyRuntime';
import { TerminationRuntime } from './terminationRuntime';

export const networkSession = new HanabNetworkSession();
export const lobbyRuntime = new LobbyRuntime(networkSession, store);
export const terminationRuntime = new TerminationRuntime(lobbyRuntime, store);
