import {
  canDiscardForVariant,
  hasClueTokenForVariant,
  isCurrentVariantColorClueValue,
  isCurrentVariantRankClueValue,
} from '../game/selectors/gameplay';
import {
  getCluePreview,
  isCluePreviewConfirmable,
} from '../game/selectors/cluePreview';
import {
  clientGameplayActionSchema,
  encodeColorClueFrame,
  encodeDiscardFrame,
  encodePlayFrame,
  encodeRankClueFrame,
  encodeNoteFrame,
  encodePauseFrame,
  noteCommandSchema,
  type ClientGameplayAction,
} from '../protocol/gameProtocol';
import type { ServerEvent } from '../protocol/lobbyProtocol';
import { roomActions } from '../store/roomSlice';
import type { AppStore } from '../store/store';
import { isEditableLiveNoteOrder } from './notePolicy';

type GameplayNoteEvent = Extract<ServerEvent, {
  command: 'noteListPlayer' | 'noteList' | 'note';
}>;

// Owns live gameplay commands and notes; connection and bootstrap stay in LobbyRuntime.
export class GameplayRuntime {
  constructor(
    private readonly store: AppStore,
    // LobbyRuntime supplies its current READY-gated sender and room readiness guard.
    private readonly sendEncoded: (frame: string) => boolean,
    private readonly isReadyCurrentRoom: (tableID: number) => boolean,
  ) {}

  play(cardOrder: number): boolean {
    return this.sendGameplayAction({ type: 0, target: cardOrder });
  }

  discard(cardOrder: number): boolean {
    return this.sendGameplayAction({ type: 1, target: cardOrder });
  }

  colorClue(targetPlayerIndex: number, colorIndex: number): boolean {
    return this.sendGameplayAction({
      type: 2,
      target: targetPlayerIndex,
      value: colorIndex,
    });
  }

  rankClue(targetPlayerIndex: number, rank: number): boolean {
    return this.sendGameplayAction({
      type: 3,
      target: targetPlayerIndex,
      value: rank,
    });
  }

  pauseGame(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'live_game'
      || room.role !== 'player'
      || room.sharedReplay
      || room.clientState.finished
      || room.clientState.replay.active
      || room.clientState.ongoingGame.turn.currentPlayerIndex === null
      || !room.clientState.metadata.options.timed
      || !this.isReadyCurrentRoom(room.tableID)
    ) return false;
    const pause = room.clientState.pause;
    const ownTurn = room.clientState.ongoingGame.turn.currentPlayerIndex
      === room.clientState.metadata.ourPlayerIndex;
    const setting = pause.active
      ? 'unpause'
      : ownTurn
        ? 'pause'
        : pause.queued
          ? 'pause-unqueue'
          : 'pause-queue';
    let sent = false;
    try {
      sent = this.sendEncoded(encodePauseFrame(room.tableID, setting));
    } catch {
      sent = false;
    }
    if (!sent) return false;
    if (setting === 'pause-queue' || setting === 'pause-unqueue') {
      this.store.dispatch(roomActions.pauseQueueChanged({
        connectionEpoch: state.session.connectionEpoch,
        tableID: room.tableID,
        gameLoadEpoch: room.gameLoadEpoch,
        queued: setting === 'pause-queue',
      }));
    }
    return true;
  }

  editNote(cardOrder: number, text: string): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'live_game'
      || room.clientState.finished
      || room.sharedReplay
      || !Number.isInteger(cardOrder)
      || cardOrder < 0
      || text.length > 300
      || !this.isReadyCurrentRoom(room.tableID)
    ) return false;

    const parsed = noteCommandSchema.safeParse({
      tableID: room.tableID,
      order: cardOrder,
      note: text,
    });
    if (!parsed.success) return false;
    const order = parsed.data.order;
    if (!isEditableLiveNoteOrder(room.clientState.notes.ourNotes, order)) return false;

    let sent = false;
    try {
      sent = this.sendEncoded(encodeNoteFrame(room.tableID, order, text));
    } catch {
      sent = false;
    }
    if (!sent) return false;
    this.store.dispatch(roomActions.noteActionAccepted({
      connectionEpoch: state.session.connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      noteAction: { type: 'editNote', order, text },
    }));
    return true;
  }

  receiveEvent(epoch: number, event: GameplayNoteEvent): void {
    switch (event.command) {
      case 'noteListPlayer': {
        const room = this.store.getState().room.room;
        if (room.kind !== 'live_game') break;
        this.store.dispatch(roomActions.noteActionAccepted({
          connectionEpoch: epoch,
          tableID: event.data.tableID,
          gameLoadEpoch: room.gameLoadEpoch,
          noteAction: { type: 'noteListPlayer', texts: event.data.notes },
        }));
        break;
      }
      case 'noteList': {
        const room = this.store.getState().room.room;
        if (room.kind !== 'live_game') break;
        this.store.dispatch(roomActions.noteActionAccepted({
          connectionEpoch: epoch,
          tableID: event.data.tableID,
          gameLoadEpoch: room.gameLoadEpoch,
          noteAction: {
            type: 'noteList',
            names: event.data.notes.map((notes) => notes.name),
            noteTextLists: event.data.notes.map((notes) => notes.notes),
            isSpectators: event.data.notes.map((notes) => notes.isSpectator),
          },
        }));
        break;
      }
      case 'note': {
        const room = this.store.getState().room.room;
        if (room.kind !== 'live_game') break;
        this.store.dispatch(roomActions.noteActionAccepted({
          connectionEpoch: epoch,
          tableID: event.data.tableID,
          gameLoadEpoch: room.gameLoadEpoch,
          noteAction: {
            type: 'receiveNote',
            order: event.data.order,
            notes: event.data.notes,
          },
        }));
        break;
      }
    }
  }

  clearCurrentPending(connectionEpoch: number): void {
    const pending = this.store.getState().room.pendingGameplayAction;
    if (pending === null || pending.connectionEpoch !== connectionEpoch) return;
    this.store.dispatch(roomActions.gameplayPendingCleared({
      connectionEpoch,
      tableID: pending.tableID,
      gameLoadEpoch: pending.gameLoadEpoch,
    }));
  }

  private sendGameplayAction(
    intent:
      | { type: 0 | 1; target: number }
      | { type: 2 | 3; target: number; value: number },
  ): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'live_game'
      || !this.isReadyCurrentRoom(room.tableID)
      || room.role !== 'player'
      || room.clientState.replay.active
      || room.clientState.pause.active
      || room.clientState.ongoingGame.turn.currentPlayerIndex
        !== room.clientState.metadata.ourPlayerIndex
      || state.room.pendingGameplayAction !== null
    ) return false;

    const candidate = { tableID: room.tableID, ...intent };
    const parsed = clientGameplayActionSchema.safeParse(candidate);
    if (!parsed.success) return false;
    const action = parsed.data;
    const ourPlayerIndex = room.clientState.metadata.ourPlayerIndex;
    if (
      (action.type === 0 || action.type === 1)
      && !(room.clientState.ongoingGame.hands[ourPlayerIndex]?.includes(action.target) ?? false)
    ) return false;
    const variantName = room.clientState.metadata.options.variantName;
    if (
      action.type === 1
      && !canDiscardForVariant(room.clientState.ongoingGame.clueTokens, variantName)
    ) return false;
    if (action.type === 2 || action.type === 3) {
      if (
        action.target === ourPlayerIndex
        || action.target < 0
        || action.target >= room.clientState.metadata.options.numPlayers
      ) return false;
      if (
        !hasClueTokenForVariant(room.clientState.ongoingGame.clueTokens, variantName)
        ||
        (action.type === 2
          && !isCurrentVariantColorClueValue(variantName, action.value))
        || (action.type === 3
          && !isCurrentVariantRankClueValue(variantName, action.value))
      ) return false;
      const preview = getCluePreview(
        room.clientState.ongoingGame,
        variantName,
        action.target,
        action.type === 2 ? 'color' : 'rank',
        action.value,
      );
      if (!isCluePreviewConfirmable(
        preview,
        room.clientState.metadata.options.emptyClues,
        variantName,
      )) return false;
    }

    const pending = {
      connectionEpoch: state.session.connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      action,
    };
    this.store.dispatch(roomActions.gameplayActionRequested(pending));
    if (this.store.getState().room.pendingGameplayAction === null) return false;

    let sent = false;
    try {
      sent = this.sendEncoded(this.encodeGameplayFrame(action));
    } catch {
      sent = false;
    }
    if (!sent) this.store.dispatch(roomActions.gameplayPendingCleared(pending));
    return sent;
  }

  private encodeGameplayFrame(action: ClientGameplayAction): string {
    switch (action.type) {
      case 0: return encodePlayFrame(action.tableID, action.target);
      case 1: return encodeDiscardFrame(action.tableID, action.target);
      case 2: return encodeColorClueFrame(action.tableID, action.target, action.value);
      case 3: return encodeRankClueFrame(action.tableID, action.target, action.value);
    }
  }

}
