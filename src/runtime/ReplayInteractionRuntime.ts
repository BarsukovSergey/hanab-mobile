import { canDiscardForVariant, hasClueTokenForVariant } from '../game/selectors/gameplay';
import { getCluePreview, isCluePreviewConfirmable } from '../game/selectors/cluePreview';
import type { ActionIncludingHypothetical } from '../game/client/types/actions';
import { getHypotheticalActions } from '../game/client/hypotheticalActions';
import { canToggleHypotheticalDrawnCards } from '../game/client/hypotheticalEligibility';
import {
  encodeReplayActionFrame,
  encodeReplayHypoActionFrame,
  encodeReplayHypoBackFrame,
  encodeReplayHypoEndFrame,
  encodeReplayHypoStartFrame,
  encodeReplayHypoToggleRevealedFrame,
  encodeTableSetLeaderFrame,
  hypoActionSchema,
  type ServerEvent,
} from '../protocol/lobbyProtocol';
import { roomActions } from '../store/roomSlice';
import type { AppStore } from '../store/store';

type ReplayInteractionEvent = Extract<ServerEvent, {
  command: 'replaySegment' | 'replayLeader' | 'suggestion' | 'replayEfficiencyMod'
    | 'hypothetical' | 'hypoStart' | 'hypoEnd' | 'hypoAction' | 'hypoBack' | 'hypoShowDrawnCards';
}>;

// Owns active-room replay interactions; connection and room lifecycle stay in LobbyRuntime.
export class ReplayInteractionRuntime {
  constructor(
    private readonly store: AppStore,
    // LobbyRuntime supplies its current READY-gated sender and room readiness guard.
    private readonly sendEncoded: (frame: string) => boolean,
    private readonly isReadyCurrentRoom: (tableID: number) => boolean,
    private readonly recordMalformedHypothetical: (epoch: number) => void,
  ) {}

  navigateReplaySegment(segment: number): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'live_game'
      || !Number.isInteger(segment)
      || segment < 0
      || room.clientState.replay.states[segment] === undefined
    ) return false;
    const shared = room.clientState.replay.shared;
    if (shared === null || !shared.amLeader) {
      this.store.dispatch(roomActions.reviewSegmentSelected({
        tableID: room.tableID,
        gameLoadEpoch: room.gameLoadEpoch,
        segment,
      }));
      return true;
    }
    if (!this.isReadyCurrentRoom(room.tableID)) return false;
    return this.sendEncoded(encodeReplayActionFrame(room.tableID, segment));
  }

  followReplayLeader(): boolean {
    const room = this.store.getState().room.room;
    if (
      room.kind !== 'live_game'
      || room.clientState.replay.shared === null
      || room.clientState.replay.shared.amLeader
      || room.clientState.replay.shared.useSharedSegments
    ) return false;
    this.store.dispatch(roomActions.followReplayLeader({
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
    }));
    return true;
  }

  startHypothetical(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (room.kind !== 'live_game' || !room.clientState.replay.active
      || room.clientState.replay.hypothetical !== null) return false;
    const shared = room.clientState.replay.shared;
    if (shared !== null) {
      if (!shared.amLeader || !this.isReadyCurrentRoom(room.tableID)) return false;
      return this.sendEncoded(encodeReplayHypoStartFrame(room.tableID));
    }
    this.store.dispatch(roomActions.hypotheticalStarted({
      epoch: state.session.connectionEpoch, tableID: room.tableID, showDrawnCards: false, actions: [],
    }));
    return true;
  }

  setSharedReplayLeader(name: string): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const shared = room.kind === 'live_game' ? room.clientState.replay.shared : null;
    if (
      room.kind !== 'live_game'
      || shared === null
      || shared.leader === name
      || !room.clientState.spectators.some((spectator) => spectator.name === name)
      || !this.isReadyCurrentRoom(room.tableID)
    ) return false;
    return this.sendEncoded(encodeTableSetLeaderFrame(room.tableID, name));
  }

  endHypothetical(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (room.kind !== 'live_game' || room.clientState.replay.hypothetical === null) return false;
    const shared = room.clientState.replay.shared;
    if (shared !== null) {
      if (!shared.amLeader || !this.isReadyCurrentRoom(room.tableID)) return false;
      return this.sendEncoded(encodeReplayHypoEndFrame(room.tableID));
    }
    this.store.dispatch(roomActions.hypotheticalEnded({ epoch: state.session.connectionEpoch, tableID: room.tableID }));
    return true;
  }

  sendHypotheticalAction(action: ActionIncludingHypothetical): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (room.kind !== 'live_game' || room.clientState.replay.hypothetical === null) return false;
    let parsed: ActionIncludingHypothetical;
    try { parsed = hypoActionSchema.parse(action) as ActionIncludingHypothetical; } catch { return false; }
    const shared = room.clientState.replay.shared;
    if (shared === null) {
      this.store.dispatch(roomActions.hypotheticalActionReceived({
        epoch: state.session.connectionEpoch, tableID: room.tableID, action: parsed,
      }));
      return true;
    }
    return this.sendSharedHypotheticalOperation([parsed]);
  }

  hypotheticalMorph(order: number, suitIndex: number, rank: number): boolean {
    return this.sendHypotheticalAction({ type: 'morph', order, suitIndex, rank } as Extract<ActionIncludingHypothetical, { readonly type: 'morph' }>);
  }

  hypotheticalUnmorph(order: number): boolean {
    return this.sendHypotheticalAction({ type: 'unmorph', order } as Extract<ActionIncludingHypothetical, { readonly type: 'unmorph' }>);
  }

  hypotheticalPlay(order: number): boolean {
    return this.sendHypotheticalClientAction({ type: 'play', order });
  }

  hypotheticalDiscard(order: number): boolean {
    return this.sendHypotheticalClientAction({ type: 'discard', order });
  }

  hypotheticalColorClue(target: number, value: number): boolean {
    return this.sendHypotheticalClientAction({ type: 'colorClue', target, value });
  }

  hypotheticalRankClue(target: number, value: number): boolean {
    return this.sendHypotheticalClientAction({ type: 'rankClue', target, value });
  }

  private sendHypotheticalClientAction(action: Parameters<typeof getHypotheticalActions>[0]): boolean {
    const room = this.store.getState().room.room;
    if (room.kind !== 'live_game') return false;
    const hypothetical = room.clientState.replay.hypothetical;
    if (hypothetical === null) return false;
    const variantName = room.clientState.metadata.options.variantName;
    const clueTokens = hypothetical.ongoing.clueTokens;
    if (action.type === 'discard' && !canDiscardForVariant(clueTokens, variantName)) return false;
    if (
      (action.type === 'colorClue' || action.type === 'rankClue')
      && !hasClueTokenForVariant(clueTokens, variantName)
    ) return false;
    if (action.type === 'colorClue' || action.type === 'rankClue') {
      const preview = getCluePreview(
        hypothetical.ongoing,
        variantName,
        action.target,
        action.type === 'colorClue' ? 'color' : 'rank',
        action.value,
        {
          cardIdentities: room.clientState.cardIdentities,
          morphedIdentities: hypothetical.morphedIdentities,
          notes: room.clientState.notes.ourNotes,
          playing: room.clientState.playing,
        },
      );
      if (!isCluePreviewConfirmable(
        preview,
        room.clientState.metadata.options.emptyClues,
        variantName,
      )) return false;
    }
    const actions = getHypotheticalActions(
      action,
      hypothetical.ongoing,
      room.clientState.metadata,
      room.clientState.cardIdentities,
      hypothetical.morphedIdentities,
      room.clientState.notes.ourNotes,
      room.clientState.playing,
    );
    if (actions === null) return false;
    if (room.clientState.replay.shared !== null) {
      return this.sendSharedHypotheticalOperation(actions);
    }
    return actions.every((hypoAction) => this.sendHypotheticalAction(hypoAction));
  }

  backHypothetical(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (room.kind !== 'live_game' || room.clientState.replay.hypothetical === null
      || room.clientState.replay.hypothetical.states.length <= 1) return false;
    const shared = room.clientState.replay.shared;
    if (shared === null) {
      this.store.dispatch(roomActions.hypotheticalBackReceived({ epoch: state.session.connectionEpoch, tableID: room.tableID }));
      return true;
    }
    return state.room.pendingHypotheticalOperation === null
      && shared.amLeader && this.isReadyCurrentRoom(room.tableID)
      && this.sendEncoded(encodeReplayHypoBackFrame(room.tableID));
  }

  private sendSharedHypotheticalOperation(
    actions: readonly ActionIncludingHypothetical[],
  ): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      actions.length === 0
      || room.kind !== 'live_game'
      || room.clientState.replay.hypothetical === null
      || room.clientState.replay.shared?.amLeader !== true
      || state.room.pendingHypotheticalOperation !== null
      || !this.isReadyCurrentRoom(room.tableID)
    ) return false;

    let parsedActions: ActionIncludingHypothetical[];
    let frames: string[];
    try {
      parsedActions = actions.map((action) => (
        hypoActionSchema.parse(action) as ActionIncludingHypothetical
      ));
      frames = parsedActions.map((action) => (
        encodeReplayHypoActionFrame(room.tableID, JSON.stringify(action))
      ));
    } catch {
      return false;
    }

    const finalAction = parsedActions.at(-1);
    if (finalAction === undefined) return false;
    const pending = {
      connectionEpoch: state.session.connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      finalAction,
    };
    this.store.dispatch(roomActions.hypotheticalOperationRequested(pending));
    const accepted = this.store.getState().room.pendingHypotheticalOperation;
    if (
      accepted === null
      || accepted.connectionEpoch !== pending.connectionEpoch
      || accepted.tableID !== pending.tableID
      || accepted.gameLoadEpoch !== pending.gameLoadEpoch
    ) return false;

    let sentCount = 0;
    for (const frame of frames) {
      if (!this.sendEncoded(frame)) {
        if (sentCount === 0) {
          this.store.dispatch(roomActions.hypotheticalOperationPendingCleared(pending));
        }
        return false;
      }
      sentCount += 1;
    }
    return true;
  }

  toggleHypotheticalDrawnCards(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const hypothetical = room.kind === 'live_game' ? room.clientState.replay.hypothetical : null;
    if (room.kind !== 'live_game' || hypothetical === null || !canToggleHypotheticalDrawnCards(hypothetical)) return false;
    const shared = room.clientState.replay.shared;
    if (shared === null) {
      this.store.dispatch(roomActions.hypotheticalDrawnCardsChanged({
        epoch: state.session.connectionEpoch, tableID: room.tableID,
        showDrawnCards: !hypothetical.showDrawnCards,
      }));
      return true;
    }
    return shared.amLeader && this.isReadyCurrentRoom(room.tableID)
      && this.sendEncoded(encodeReplayHypoToggleRevealedFrame(room.tableID));
  }

  receiveEvent(epoch: number, event: ReplayInteractionEvent): void {
    switch (event.command) {
      case 'replaySegment':
        this.store.dispatch(roomActions.sharedReplaySegmentReceived({
          epoch,
          tableID: event.data.tableID,
          segment: event.data.segment,
        }));
        break;
      case 'replayLeader':
        this.store.dispatch(roomActions.sharedReplayLeaderReceived({
          epoch,
          tableID: event.data.tableID,
          name: event.data.name,
        }));
        break;
      case 'suggestion':
        this.store.dispatch(roomActions.replaySuggestionReceived({
          epoch,
          suggestion: event.data,
        }));
        break;
      case 'replayEfficiencyMod':
        this.store.dispatch(roomActions.sharedReplayEfficiencyModReceived({
          epoch,
          tableID: event.data.tableID,
          mod: event.data.mod,
        }));
        break;
      case 'hypothetical': {
        const room = this.store.getState().room.room;
        if (room.kind !== 'live_game' || room.clientState.replay.shared === null) break;
        try {
          const actions = event.data.actions.map((encoded) => (
            hypoActionSchema.parse(JSON.parse(encoded)) as ActionIncludingHypothetical
          ));
          this.store.dispatch(roomActions.hypotheticalStarted({
            epoch, tableID: room.tableID, showDrawnCards: event.data.showDrawnCards, actions,
          }));
        } catch {
          this.recordMalformedHypothetical(epoch);
        }
        break;
      }
      case 'hypoStart':
        this.store.dispatch(roomActions.hypotheticalStarted({
          epoch, tableID: event.data.TableID, showDrawnCards: false, actions: [],
        }));
        break;
      case 'hypoEnd':
        this.store.dispatch(roomActions.hypotheticalEnded({ epoch, tableID: event.data.TableID }));
        break;
      case 'hypoAction': {
        const room = this.store.getState().room.room;
        if (room.kind !== 'live_game') break;
        this.store.dispatch(roomActions.hypotheticalActionReceived({
          epoch,
          tableID: room.tableID,
          action: event.data as ActionIncludingHypothetical,
        }));
        break;
      }
      case 'hypoBack':
        this.store.dispatch(roomActions.hypotheticalBackReceived({ epoch, tableID: event.data.TableID }));
        break;
      case 'hypoShowDrawnCards':
        this.store.dispatch(roomActions.hypotheticalDrawnCardsChanged({
          epoch, tableID: event.data.tableID, showDrawnCards: event.data.showDrawnCards,
        }));
        break;
    }
  }
}
