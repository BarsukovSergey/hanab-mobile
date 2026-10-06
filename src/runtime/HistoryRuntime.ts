import type { NetworkSession } from '../network/types';
import { areTableOptionsSupported } from '../game/client/supportedVariants';
import {
  encodeHistoryGetFrame,
  encodeHistoryFriendsGetFrame,
  encodeHistoryGetSeedFrame,
  encodeJSONReplayCreateFrame,
  encodeReplayCreateFrame,
  historyGetSeedCommandSchema,
  type ServerEvent,
} from '../protocol/lobbyProtocol';
import { historyActions } from '../store/historySlice';
import type { AppStore, RootState } from '../store/store';

const MAX_STATUS_LENGTH = 240;

type HistoryEvent = Extract<ServerEvent, {
  command: 'gameHistory' | 'gameHistoryFriends' | 'gameHistoryOtherScores';
}>;

function safeStatus(value: unknown, fallback: string): string {
  const message = value instanceof Error ? value.message : fallback;
  return message.slice(0, MAX_STATUS_LENGTH);
}

// Owns history requests and replay creation intent, without connection or room lifecycle ownership.
export class HistoryRuntime {
  constructor(
    private readonly store: AppStore,
    private readonly networkSession: Pick<NetworkSession, 'fetchTaggedGames' | 'searchTag'>,
    // LobbyRuntime supplies its current READY-gated sender; failed sends create no pending intent.
    private readonly sendEncoded: (frame: string) => boolean,
  ) {}

  loadMoreHistory(): boolean {
    const state = this.store.getState();
    const history = state.history;
    if (
      state.session.phase !== 'ready'
      || history.connectionEpoch !== state.session.connectionEpoch
      || !history.initialPageReceived
      || !history.hasMore
      || history.pendingRequest !== null
    ) return false;
    const request = {
      connectionEpoch: state.session.connectionEpoch,
      offset: history.items.length,
      amount: 10 as const,
    };
    if (!this.sendEncoded(encodeHistoryGetFrame(request.offset, request.amount))) return false;
    this.store.dispatch(historyActions.pageRequested(request));
    return this.store.getState().history.pendingRequest?.offset === request.offset;
  }

  ensureFriendsHistory(): boolean {
    const state = this.store.getState();
    const history = state.history;
    if (
      state.session.phase !== 'ready'
      || history.connectionEpoch !== state.session.connectionEpoch
      || state.session.friends.length === 0
      || history.friendInitialPageReceived
      || history.friendPendingRequest !== null
    ) return false;
    if (!this.sendEncoded(encodeHistoryFriendsGetFrame(0))) return false;
    this.store.dispatch(historyActions.friendPageRequested({
      connectionEpoch: state.session.connectionEpoch, offset: 0, amount: 10,
    }));
    return this.store.getState().history.friendPendingRequest?.offset === 0;
  }

  ensureTaggedGames(): boolean {
    const state = this.store.getState();
    const username = state.session.authenticatedUser?.username;
    const history = state.history;
    if (state.session.phase !== 'ready' || username === undefined
      || history.connectionEpoch !== state.session.connectionEpoch
      || history.taggedLoaded || history.taggedPending) return false;
    const epoch = state.session.connectionEpoch;
    this.store.dispatch(historyActions.taggedRequested({ connectionEpoch: epoch }));
    void this.networkSession.fetchTaggedGames(username).then((items) => {
      if (this.store.getState().session.connectionEpoch !== epoch) return;
      this.store.dispatch(historyActions.taggedReceived({ connectionEpoch: epoch, history: items }));
    }).catch((error: unknown) => {
      if (this.store.getState().session.connectionEpoch !== epoch) return;
      this.store.dispatch(historyActions.tagFailed({ connectionEpoch: epoch, request: 'tagged', message: safeStatus(error, 'Unable to load tagged games.') }));
    });
    return true;
  }

  searchTag(tag: string): boolean {
    const state = this.store.getState();
    if (tag.trim() === '' || state.session.phase !== 'ready'
      || state.history.connectionEpoch !== state.session.connectionEpoch
      || state.history.tagSearchPending) return false;
    const epoch = state.session.connectionEpoch;
    this.store.dispatch(historyActions.tagSearchRequested({ connectionEpoch: epoch, tag }));
    const requestId = this.store.getState().history.tagSearchRequestId;
    if (requestId === null) return false;
    void this.networkSession.searchTag(tag).then((items) => {
      if (this.store.getState().session.connectionEpoch !== epoch) return;
      this.store.dispatch(historyActions.tagSearchReceived({ connectionEpoch: epoch, requestId, tag, history: items }));
    }).catch((error: unknown) => {
      if (this.store.getState().session.connectionEpoch !== epoch) return;
      this.store.dispatch(historyActions.tagFailed({ connectionEpoch: epoch, request: 'search', requestId, tag, message: safeStatus(error, 'Unable to search this tag.') }));
    });
    return true;
  }

  clearTagSearch(): void { this.store.dispatch(historyActions.tagSearchCleared()); }

  loadMoreFriendsHistory(): boolean {
    const state = this.store.getState();
    const history = state.history;
    if (
      state.session.phase !== 'ready'
      || history.connectionEpoch !== state.session.connectionEpoch
      || !history.friendInitialPageReceived
      || !history.friendHasMore
      || history.friendPendingRequest !== null
    ) return false;
    const offset = history.friendItems.length;
    if (!this.sendEncoded(encodeHistoryFriendsGetFrame(offset))) return false;
    this.store.dispatch(historyActions.friendPageRequested({
      connectionEpoch: state.session.connectionEpoch, offset, amount: 10,
    }));
    return this.store.getState().history.friendPendingRequest?.offset === offset;
  }

  loadOtherScores(databaseID: number, friends: boolean): boolean {
    const state = this.store.getState();
    const history = state.history;
    const source = (friends ? history.friendItems : history.items)
      .find((item) => item.id === databaseID);
    if (state.session.phase !== 'ready'
      || history.connectionEpoch !== state.session.connectionEpoch
      || !Number.isInteger(databaseID) || databaseID <= 0
      || source === undefined || source.numGamesOnThisSeed <= 1
      || !historyGetSeedCommandSchema.safeParse({ seed: source.seed, friends }).success
      || history.pendingOtherScores !== null) return false;
    if (!this.sendEncoded(encodeHistoryGetSeedFrame(source.seed, friends))) return false;
    this.store.dispatch(historyActions.otherScoresRequested({
      connectionEpoch: state.session.connectionEpoch,
      sourceDatabaseID: databaseID,
      seed: source.seed,
      friends,
    }));
    return this.store.getState().history.pendingOtherScores?.sourceDatabaseID === databaseID;
  }

  dismissOtherScores(): void {
    this.store.dispatch(historyActions.otherScoresDismissed());
  }

  watchHistoricalGame(databaseID: number, visibility: 'solo' | 'shared' = 'solo'): boolean {
    const state = this.store.getState();
    const item = [...state.history.items, ...state.history.friendItems, ...state.history.taggedItems,
      ...(state.history.tagSearchItems ?? []), ...(state.history.otherScores?.games ?? [])]
      .find((candidate) => candidate.id === databaseID);
    if (
      state.session.phase !== 'ready'
      || state.history.connectionEpoch !== state.session.connectionEpoch
      || !Number.isInteger(databaseID)
      || databaseID <= 0
      || item === undefined
      || !areTableOptionsSupported(item.options)
      || !this.canRequestReplay(state)
    ) return false;
    if (!this.sendEncoded(encodeReplayCreateFrame(databaseID, visibility))) return false;
    this.store.dispatch(historyActions.replayCreateRequested({
      connectionEpoch: state.session.connectionEpoch,
      source: 'id', visibility,
      databaseID,
    }));
    return this.store.getState().history.pendingReplayCreate?.databaseID === databaseID;
  }

  watchReplayByID(databaseID: number, visibility: 'solo' | 'shared'): boolean {
    const state = this.store.getState();
    if (!Number.isInteger(databaseID) || databaseID <= 0 || !this.canRequestReplay(state)) return false;
    if (!this.sendEncoded(encodeReplayCreateFrame(databaseID, visibility))) return false;
    this.store.dispatch(historyActions.externalReplayCreateRequested({
      connectionEpoch: state.session.connectionEpoch, source: 'id', databaseID, visibility,
    }));
    return this.store.getState().history.pendingReplayCreate?.databaseID === databaseID;
  }

  watchJSONReplay(gameJSON: Record<string, unknown>, visibility: 'solo' | 'shared'): boolean {
    const state = this.store.getState();
    if (!this.canRequestReplay(state)) return false;
    if (!this.sendEncoded(encodeJSONReplayCreateFrame(gameJSON, visibility))) return false;
    this.store.dispatch(historyActions.replayCreateRequested({
      connectionEpoch: state.session.connectionEpoch, source: 'json', visibility,
    }));
    return this.store.getState().history.pendingReplayCreate?.source === 'json';
  }

  private canRequestReplay(state: RootState): boolean {
    const room = state.room;
    return state.session.phase === 'ready'
      && state.history.connectionEpoch === state.session.connectionEpoch
      && room.room.kind === 'none'
      && room.pendingRecovery === null && room.pendingSpectateTableID === null
      && room.pendingJoin === null && room.pendingCreate === null
      && room.pendingLeaveTableID === null && room.pendingUnattendTableID === null
      && room.pendingStart === null && room.pendingUpdate === null
      && room.pendingLeaderName === null && room.pendingRestartTableID === null
      && room.rematchTransition === null && room.pendingGameplayAction === null
      && state.history.pendingReplayCreate === null;
  }

  receiveEvent(epoch: number, event: HistoryEvent): void {
    switch (event.command) {
      case 'gameHistory':
        this.store.dispatch(historyActions.pageReceived({
          connectionEpoch: epoch,
          history: event.data,
        }));
        break;
      case 'gameHistoryFriends':
        this.store.dispatch(historyActions.friendPageReceived({
          connectionEpoch: epoch,
          history: event.data,
        }));
        break;
      case 'gameHistoryOtherScores':
        this.store.dispatch(historyActions.otherScoresReceived({
          connectionEpoch: epoch,
          result: event.data,
        }));
        break;
    }
  }

  clearCurrentPending(epoch: number, message: string): void {
    const history = this.store.getState().history;
    if (
      history.connectionEpoch === epoch
      && (history.pendingRequest !== null
        || history.friendPendingRequest !== null
        || history.pendingReplayCreate !== null
        || history.pendingOtherScores !== null)
    ) this.store.dispatch(historyActions.operationFailed({
      connectionEpoch: epoch,
      message: message.slice(0, MAX_STATUS_LENGTH),
    }));
  }
}
