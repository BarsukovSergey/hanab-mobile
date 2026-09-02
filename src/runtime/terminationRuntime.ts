import { terminationCommandSchema } from '../protocol/terminationProtocol';
import type { AppStore } from '../store/store';
import type { LobbyRuntime } from './LobbyRuntime';

export class TerminationRuntime {
  constructor(
    private readonly lobbyRuntime: Pick<LobbyRuntime, 'send'>,
    private readonly store: Pick<AppStore, 'getState'>,
  ) {}

  voteForTermination(): boolean {
    const tableID = this.currentTerminationTableID();
    if (tableID === null) return false;
    return this.lobbyRuntime.send(
      'tableVoteForTermination',
      terminationCommandSchema.parse({ tableID }),
    );
  }

  terminateGame(): boolean {
    const tableID = this.currentTerminationTableID();
    if (tableID === null) return false;
    return this.lobbyRuntime.send(
      'tableTerminate',
      terminationCommandSchema.parse({ tableID }),
    );
  }

  private currentTerminationTableID(): number | null {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      state.session.phase !== 'ready'
      || state.room.connectionEpoch !== state.session.connectionEpoch
      || room.kind !== 'live_game'
      || room.role !== 'player'
      || room.sharedReplay
      || room.clientState.finished
      || room.clientState.replay.active
      || room.clientState.ongoingGame.turn.currentPlayerIndex === null
    ) return null;
    return room.tableID;
  }
}
