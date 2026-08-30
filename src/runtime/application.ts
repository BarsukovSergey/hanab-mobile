import { HanabNetworkSession } from '../network/NetworkSession';
import { store } from '../store/store';
import { LobbyRuntime } from './LobbyRuntime';

export const networkSession = new HanabNetworkSession();
export const lobbyRuntime = new LobbyRuntime(networkSession, store);
