import { isVariantNameSupported } from '../game/client/supportedVariants';
import { findKnownBotUser, freeBotSlots, isBotAtTable, knownBots, normalizedBotName } from '../config/knownBots';
import {
  encodeCreateTableSettingFrame,
  encodeGetNameFrame,
  encodeTableCreateFrame,
  encodeTableSetLeaderFrame,
  encodeTableStartFrame,
  encodeTableUpdateFrame,
  type ChatMessage,
  type CreateTableSetting,
  type MobileTableOptions,
} from '../protocol/lobbyProtocol';
import { roomActions } from '../store/roomSlice';
import { sessionActions } from '../store/sessionSlice';
import type { AppStore } from '../store/store';

export type BotJoinPM = { msg: string; recipient: string; room: `table${number}` };

// Owns table commands and transient bot-create secrets; connection and room reducers stay in LobbyRuntime.
export class TableManagementRuntime {
  private pendingBotCreate: {
    epoch: number;
    name: string;
    creatorUserID: number;
    bots: string[];
    password: string;
  } | null = null;

  constructor(
    private readonly store: AppStore,
    // Both senders are current READY-only gates supplied by LobbyRuntime; neither queues work.
    private readonly sendEncoded: (frame: string) => boolean,
    private readonly sendBotPM: (message: BotJoinPM) => boolean,
    private readonly isReadyPregame: (tableID: number) => boolean,
  ) {}

  clearTransientState(): void {
    this.pendingBotCreate = null;
  }

  // Must run before commandPendingCleared removes the rejected create evidence.
  clearRejectedCreate(): void {
    if (this.store.getState().room.pendingCreate !== null) this.clearTransientState();
  }

  createTable(
    name: string,
    maxPlayers: number,
    options: MobileTableOptions | string,
    password = '',
    bots: readonly string[] = [],
  ): boolean {
    const state = this.store.getState();
    const creatorUserID = state.session.authenticatedUser?.userID;
    const trimmedName = name.trim();
    const effectiveName = trimmedName || state.session.randomTableName?.trim() || '';
    const exposed = typeof options === 'string' ? {
      variantName: options,
      timed: false,
      timeBase: 0,
      timePerTurn: 0,
      cardCycle: false,
      emptyClues: false,
      oneExtraCard: false,
      oneLessCard: false,
      allOrNothing: false,
    } : options;
    if (
      creatorUserID === undefined
      || effectiveName.length < 1
      || effectiveName.length > 45
      || !Number.isInteger(maxPlayers)
      || maxPlayers < 2
      || maxPlayers > 6
      || !isVariantNameSupported(exposed.variantName)
      || (exposed.oneExtraCard && exposed.oneLessCard)
      || state.room.room.kind !== 'none'
      || state.room.pendingRecovery !== null
      || state.room.pendingSpectateTableID !== null
      || state.room.pendingJoin !== null
      || state.room.pendingCreate !== null
      || state.history.pendingReplayCreate !== null
      || bots.length > maxPlayers - 1
      || new Set(bots.map(normalizedBotName)).size !== bots.length
      || bots.some((name) => !knownBots.some((bot) => normalizedBotName(bot.username) === normalizedBotName(name)
        && (password.length === 0 || bot.passwordJoin)))
    ) return false;

    let frame: string;
    try {
      frame = encodeTableCreateFrame(effectiveName, maxPlayers, exposed, password);
    } catch {
      return false;
    }
    if (!this.sendEncoded(frame)) return false;

    this.saveCreateTablePreferences(maxPlayers, exposed);

    this.store.dispatch(roomActions.createRequested({
      epoch: state.session.connectionEpoch,
      name: effectiveName,
      creatorUserID,
    }));
    this.pendingBotCreate = bots.length === 0 ? null : {
      epoch: state.session.connectionEpoch, name: effectiveName, creatorUserID,
      bots: [...bots], password,
    };
    this.sendEncoded(encodeGetNameFrame());
    return true;
  }

  saveCreateTablePreferences(maxPlayers: number, options: MobileTableOptions): boolean {
    const initial = this.store.getState();
    if (initial.session.phase !== 'ready') return false;
    const desired: CreateTableSetting[] = [
      { name: 'createTableVariant', value: options.variantName },
      { name: 'createTableTimed', value: options.timed },
      ...(options.timed ? [
        { name: 'createTableTimeBaseMinutes' as const, value: options.timeBase / 60 },
        { name: 'createTableTimePerTurnSeconds' as const, value: options.timePerTurn },
      ] : []),
      { name: 'createTableCardCycle', value: options.cardCycle },
      { name: 'createTableEmptyClues', value: options.emptyClues },
      { name: 'createTableOneExtraCard', value: options.oneExtraCard },
      { name: 'createTableOneLessCard', value: options.oneLessCard },
      { name: 'createTableAllOrNothing', value: options.allOrNothing },
      { name: 'createTableMaxPlayers', value: maxPlayers },
    ];
    for (const setting of desired) {
      const state = this.store.getState();
      if (state.session.phase !== 'ready') return false;
      const keyMap = {
        createTableVariant: 'variant', createTableTimed: 'timed',
        createTableTimeBaseMinutes: 'timeBaseMinutes', createTableTimePerTurnSeconds: 'timePerTurnSeconds',
        createTableCardCycle: 'cardCycle', createTableEmptyClues: 'emptyClues',
        createTableOneExtraCard: 'oneExtraCard', createTableOneLessCard: 'oneLessCard',
        createTableAllOrNothing: 'allOrNothing', createTableMaxPlayers: 'maxPlayers',
      } as const;
      const current = state.session.createTablePreferences[keyMap[setting.name]];
      if (current === setting.value) continue;
      let frame: string;
      try {
        frame = encodeCreateTableSettingFrame(setting);
      } catch {
        return false;
      }
      if (!this.sendEncoded(frame)) return false;
      this.store.dispatch(sessionActions.createTablePreferenceUpdated(setting));
    }
    return true;
  }

  inviteBots(tableID: number, names: readonly string[], password = ''): number {
    let sent = 0;
    for (const name of names) {
      const state = this.store.getState();
      const room = state.room.room;
      if (room.kind !== 'pregame' || room.tableID !== tableID || state.session.phase !== 'ready') break;
      const free = freeBotSlots(room.data.maxPlayers, room.data.players.length);
      if (sent >= free) break;
      const bot = knownBots.find((entry) => normalizedBotName(entry.username) === normalizedBotName(name));
      if (bot === undefined || isBotAtTable(name, room.data.players)
        || (room.data.passwordProtected && (!bot.passwordJoin || password.length === 0))
        || !state.lobby.userListReceived) continue;
      const user = findKnownBotUser(name, Object.values(state.lobby.users.entities).filter(
        (entry): entry is NonNullable<typeof entry> => entry !== undefined,
      ));
      if (user?.status !== 0) continue;
      const msg = room.data.passwordProtected ? `/join ${password}` : '/join';
      if (this.sendBotPM({ msg, recipient: user.name, room: `table${tableID}` })) sent += 1;
    }
    return sent;
  }

  finishPendingBotCreate(epoch: number): void {
    const pending = this.pendingBotCreate;
    if (pending === null || pending.epoch !== epoch) return;
    const state = this.store.getState();
    const room = state.room.room;
    if (room.kind === 'pregame' && room.role === 'player'
      && room.data.name === pending.name && room.data.owner === pending.creatorUserID
      && room.data.players.some((player) => player.you)) {
      this.pendingBotCreate = null;
      this.inviteBots(room.tableID, pending.bots, pending.password);
    } else if (state.room.pendingCreate === null) {
      this.pendingBotCreate = null;
    }
  }

  isBotJoinEcho(message: ChatMessage): boolean {
    const username = this.store.getState().session.authenticatedUser?.username;
    return username !== undefined
      && normalizedBotName(message.who) === normalizedBotName(username)
      && /^\/join(?:\s|$)/.test(message.msg)
      && knownBots.some((bot) => normalizedBotName(bot.username) === normalizedBotName(message.recipient));
  }

  startGame(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const ownerUserID = state.session.authenticatedUser?.userID;
    if (
      ownerUserID === undefined
      || room.kind !== 'pregame'
      || room.data.owner !== ownerUserID
      || room.data.players.length < 2
      || state.room.pendingRoleSwitch !== null
      || state.room.pendingStart !== null
      || state.room.pendingLeaveTableID !== null
    ) return false;

    const intendedPlayers = room.data.players.map((player) => player.name);
    let frame: string;
    try {
      frame = encodeTableStartFrame(room.tableID, intendedPlayers);
    } catch {
      return false;
    }
    if (!this.sendEncoded(frame)) return false;

    this.store.dispatch(roomActions.startRequested({
      epoch: state.session.connectionEpoch,
      tableID: room.tableID,
      ownerUserID,
      intendedPlayers,
    }));
    return true;
  }

  updateTable(name: string, maxPlayers: number, changes: MobileTableOptions): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const ownerUserID = state.session.authenticatedUser?.userID;
    if (
      ownerUserID === undefined
      || room.kind !== 'pregame'
      || state.room.pendingRoleSwitch !== null
    ) return false;
    const isOwner = room.data.owner === ownerUserID;
    if (isOwner && state.room.pendingUpdate !== null) return false;
    let frame: string;
    try {
      frame = encodeTableUpdateFrame(
        room.tableID, name, maxPlayers, room.data.options, changes,
      );
    } catch {
      return false;
    }
    if (!this.sendEncoded(frame)) return false;
    if (!isOwner) return true;
    this.store.dispatch(roomActions.updateRequested({
      epoch: state.session.connectionEpoch, tableID: room.tableID, ownerUserID,
      name: name.trim(), maxPlayers, changes,
    }));
    return this.store.getState().room.pendingUpdate?.tableID === room.tableID;
  }

  setTableLeader(name: string): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const requesterUserID = state.session.authenticatedUser?.userID;
    const target = room.kind === 'pregame'
      ? room.data.players.find((player) => player.name === name)
      : undefined;
    if (
      requesterUserID === undefined
      || room.kind !== 'pregame'
      || room.role !== 'player'
      || state.room.pendingRoleSwitch !== null
      || target === undefined
      || room.data.players[0]?.name === name
      || (room.data.owner !== requesterUserID && !target.you)
      || state.room.pendingLeaderName !== null
      || !this.isReadyPregame(room.tableID)
    ) return false;
    if (!this.sendEncoded(encodeTableSetLeaderFrame(room.tableID, name))) return false;
    this.store.dispatch(roomActions.leaderRequested({
      epoch: state.session.connectionEpoch, tableID: room.tableID, requesterUserID, name,
    }));
    return this.store.getState().room.pendingLeaderName === name;
  }

}
