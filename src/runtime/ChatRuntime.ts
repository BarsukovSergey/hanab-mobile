import { parseIntSafe } from 'complete-common';

import packageMetadata from '../../package.json';
import { SUPPORTED_VARIANT_NAMES } from '../game/client/supportedVariants';
import { chatActions } from '../store/chatSlice';
import type { AppStore } from '../store/store';
import type { LobbyRuntime } from './LobbyRuntime';
import type { TerminationRuntime } from './terminationRuntime';
import { createReplayExport } from '../game/client/replayExport';
import { HANAB_HTTP_BASE_URL } from '../config/hanab';
import type { ReplayExportActions } from '../platform/replayExportActions';

export type LocalChatCommandResult =
  | { kind: 'handled-success' }
  | { kind: 'handled-failure' }
  | { kind: 'not-handled' };

type CommandHandler = (room: string, args: readonly string[]) => boolean;

const LEADER_COMMANDS = [
  'setleader', 'setlead', 'setowner', 'changeleader', 'changelead', 'changeowner',
] as const;
const PM_COMMANDS = ['pm', 'w', 'whisper', 'msg', 'tell', 't'] as const;
const FRIENDS_COMMANDS = ['f', 'friends', 'friendlist', 'friendslist'] as const;
const VARIANT_COMMANDS = ['sv', 'setvariant', 'changevariant', 'cv'] as const;
const PLAYER_INFO_COMMANDS = ['p', 'playerinfo', 'games', 'stats'] as const;

export class ChatRuntime {
  private readonly commands = new Map<string, CommandHandler>();

  constructor(
    private readonly lobbyRuntime: Pick<LobbyRuntime, 'send' | 'sendChat' | 'setTableLeader'>,
    private readonly terminationRuntime: Pick<
      TerminationRuntime,
      'terminateGame' | 'voteForTermination'
    >,
    private readonly store: Pick<AppStore, 'dispatch' | 'getState'>,
    private readonly now: () => Date = () => new Date(),
    private readonly replayExportActions?: ReplayExportActions,
  ) {
    this.register(PM_COMMANDS, (room, args) => this.privateMessage(room, args));
    this.register(['r'], (room, args) => this.reply(room, args));
    this.register(['friend', 'addfriend'], (room, args) => this.friend(room, args, true));
    this.register(['unfriend'], (room, args) => this.friend(room, args, false));
    this.register(FRIENDS_COMMANDS, (room) => this.listFriends(room));
    this.register(['link'], (room, args) => this.link(room, args, true));
    this.register(['unlink'], (room, args) => this.link(room, args, false));
    this.register(['linked', 'links'], () => this.lobbyRuntime.send('chatLinked', {}));
    this.register(LEADER_COMMANDS, (_room, args) => this.setLeader(args));
    this.register(VARIANT_COMMANDS, (room, args) => this.setVariant(room, args));
    this.register(['suggest'], (room, args) => this.suggest(room, args));
    this.register(['tag'], (room, args) => this.tableMessageCommand(room, args, 'tag'));
    this.register(['tagdelete', 'untag'], (room, args) => (
      this.tableMessageCommand(room, args, 'tagDelete')
    ));
    this.register(['tagsearch'], (room, args) => this.lobbyRuntime.send('tagSearch', {
      msg: args.join(' '), room,
    }));
    this.register(['tagsdeleteall'], (room) => this.tableIDCommand(room, 'tagsDeleteAll'));
    this.register(['terminate'], () => this.terminationRuntime.terminateGame());
    this.register(['vote'], () => this.terminationRuntime.voteForTermination());
    this.register(['copy'], (room) => this.copyReplay(room));
    this.register(PLAYER_INFO_COMMANDS, (_room, args) => this.playerInfo(args));
    this.register(['version'], (room) => {
      this.localMessage(
        room,
        `You are running version <strong>${packageMetadata.version}</strong> of the client.`,
        'info',
      );
      return true;
    });
  }

  submit(message: string): boolean {
    const trimmed = message.trim();
    if (trimmed.length === 0) return false;

    if (this.store.getState().session.muted) return this.mutedError(this.currentRoom());
    if (trimmed.length > 300) return false;

    const result = this.routeLocalCommand(trimmed);
    if (result.kind === 'not-handled') return this.lobbyRuntime.sendChat(message);
    return result.kind === 'handled-success';
  }

  routeLocalCommand(message: string): LocalChatCommandResult {
    const trimmed = message.trim();
    if (!trimmed.startsWith('/') || trimmed === '/') return { kind: 'not-handled' };

    const words = trimmed.split(' ');
    const firstWord = words.shift();
    const command = firstWord?.slice(1).toLowerCase() ?? '';
    const handler = this.commands.get(command);
    if (handler === undefined) return { kind: 'not-handled' };
    return this.handled(handler(this.currentRoom(), words));
  }

  sendPrivateMessage(recipient: string, message: string, room = 'lobby'): boolean {
    if (this.store.getState().session.muted) return this.mutedError(room);
    const normalizedRecipient = recipient.trim();
    const msg = message.trim();
    if (normalizedRecipient === '' || msg === '' || msg.length > 300) {
      this.localMessage(
        room,
        'The format of a private message is: <code>/w Alice hello</code>',
        'info',
      );
      return false;
    }

    const username = this.store.getState().session.authenticatedUser?.username;
    if (
      username !== undefined
      && normalizedRecipient.toLowerCase() === username.toLowerCase()
    ) {
      this.localMessage(room, 'You cannot send a private message to yourself.', 'error');
      return false;
    }

    const matchingUser = Object.values(this.store.getState().lobby.users.entities).find(
      (user) => user?.name.toLowerCase() === normalizedRecipient.toLowerCase(),
    );
    if (matchingUser === undefined) {
      this.localMessage(
        room,
        `User "${normalizedRecipient}" is not currently online.`,
        'error',
      );
      return false;
    }
    return this.lobbyRuntime.send('chatPM', { msg, recipient: matchingUser.name, room });
  }

  setFriend(name: string, add: boolean, room = 'lobby'): boolean {
    const normalizedName = name.trim();
    const command = add ? 'friend' : 'unfriend';
    if (normalizedName === '') {
      this.localMessage(
        room,
        `The format of the /${command} command is: <code>/${command} Alice</code>`,
        'info',
      );
      return false;
    }
    const username = this.store.getState().session.authenticatedUser?.username;
    if (username !== undefined && normalizedName.toLowerCase() === username.toLowerCase()) {
      this.localMessage(room, `You cannot ${command} yourself.`, 'error');
      return false;
    }
    return this.lobbyRuntime.send(
      add ? 'chatFriend' : 'chatUnfriend',
      { name: normalizedName },
    );
  }

  private register(commands: readonly string[], handler: CommandHandler): void {
    for (const command of commands) this.commands.set(command, handler);
  }

  private privateMessage(room: string, args: readonly string[]): boolean {
    const [recipient, ...msgArray] = args;
    return this.sendPrivateMessage(recipient ?? '', msgArray.join(' '), room);
  }

  private reply(room: string, args: readonly string[]): boolean {
    const lastPM = this.store.getState().chat.lastPM;
    if (lastPM === null) {
      this.localMessage(
        room,
        'No-one has sent you a private message yet, so you cannot reply.',
        'info',
      );
      return false;
    }
    return this.sendPrivateMessage(lastPM, args.join(' '), room);
  }

  private friend(room: string, args: readonly string[], add: boolean): boolean {
    return this.setFriend(args.join(' '), add, room);
  }

  private listFriends(room: string): boolean {
    const friends = this.store.getState().session.friends;
    const msg = friends.length === 0
      ? 'Currently, you do not have any friends on your friends list.'
      : `Current friends: ${friends.join(', ')}`;
    this.localMessage(room, msg, 'info');
    return true;
  }

  private link(room: string, args: readonly string[], add: boolean): boolean {
    const command = add ? 'link' : 'unlink';
    if (args.length === 0) {
      this.localMessage(
        room,
        `The format of the /${command} command is: <code>/${command} Alice</code>`,
        'info',
      );
      return false;
    }
    const name = args.join(' ');
    const username = this.store.getState().session.authenticatedUser?.username;
    if (username !== undefined && name.toLowerCase() === username.toLowerCase()) {
      this.localMessage(room, `You cannot ${command} yourself.`, 'error');
    }
    return this.lobbyRuntime.send(add ? 'chatLink' : 'chatUnlink', { name });
  }

  private setLeader(args: readonly string[]): boolean {
    const room = this.store.getState().room.room;
    const normalizedName = args.join(' ').toLowerCase();
    const target = room.kind === 'pregame'
      ? room.data.players.find((player) => player.name.toLowerCase() === normalizedName)
      : undefined;
    return target !== undefined && this.lobbyRuntime.setTableLeader(target.name);
  }

  private setVariant(room: string, args: readonly string[]): boolean {
    const tableID = this.currentTableID();
    if (tableID === null) return this.notAtTable(room, 'setvariant');
    const variantName = getVariantNameFromPartial(getVariantFromArgs(args));
    if (variantName === '') {
      this.localMessage(room, `The variant of "${args.join(' ')}" is not valid.`, 'error');
      return false;
    }
    return this.lobbyRuntime.send('tableSetVariant', {
      tableID,
      options: { variantName },
    });
  }

  private suggest(room: string, args: readonly string[]): boolean {
    const tableID = this.currentTableID();
    if (tableID === null) return this.notAtTable(room, 'suggest');
    if (args.length === 0) {
      this.localMessage(
        room,
        'The format of the /suggest command is: <code>/suggest [turn]</code>',
        'info',
      );
      return false;
    }
    const segment = parseIntSafe(args[0] ?? '');
    if (segment === undefined) {
      this.localMessage(room, 'The [turn] argument must be a valid number', 'info');
      return false;
    }
    return this.lobbyRuntime.send('tableSuggest', { tableID, segment });
  }

  private tableMessageCommand(
    room: string,
    args: readonly string[],
    command: 'tag' | 'tagDelete',
  ): boolean {
    const tableID = this.currentTableID();
    if (tableID === null) return this.notAtTable(room, command === 'tag' ? 'tag' : 'tagdelete');
    return this.lobbyRuntime.send(command, { tableID, msg: args.join(' ') });
  }

  private tableIDCommand(room: string, command: 'tagsDeleteAll'): boolean {
    const tableID = this.currentTableID();
    if (tableID === null) return this.notAtTable(room, 'tagsdeleteall');
    return this.lobbyRuntime.send(command, { tableID });
  }

  private playerInfo(args: readonly string[]): boolean {
    const names = args.length > 0 ? args : this.defaultPlayerInfoNames();
    let sent = names.length > 0;
    for (const name of names) {
      if (!this.lobbyRuntime.send('chatPlayerInfo', { name })) sent = false;
    }
    return sent;
  }

  private copyReplay(room: string): boolean {
    const state = this.store.getState();
    if (state.room.room.kind !== 'live_game' || !state.room.room.clientState.finished) {
      this.localMessage(room, 'Replay export is available only during finished game review.', 'error');
      return false;
    }
    const result = createReplayExport(state.room.room.clientState, HANAB_HTTP_BASE_URL);
    if (!result.ok) { this.localMessage(room, result.error, 'error'); return false; }
    if (this.replayExportActions === undefined) {
      this.localMessage(room, 'Replay export is unavailable on this platform.', 'error');
      return false;
    }
    void this.replayExportActions.copy(result.url).then(() => {
      this.localMessage(room, 'Replay link copied to clipboard.', 'info');
    }).catch(() => this.localMessage(room, 'Could not copy replay link.', 'error'));
    return true;
  }

  private defaultPlayerInfoNames(): readonly string[] {
    const state = this.store.getState();
    return state.room.room.kind === 'live_game'
      ? state.room.room.clientState.metadata.playerNames
      : state.session.authenticatedUser === null
        ? []
        : [state.session.authenticatedUser.username];
  }

  private currentTableID(): number | null {
    const room = this.store.getState().room.room;
    return room.kind === 'none' ? null : room.tableID;
  }

  private currentRoom(): string {
    const tableID = this.currentTableID();
    return tableID === null ? 'lobby' : `table${tableID}`;
  }

  private notAtTable(room: string, command: string): false {
    this.localMessage(
      room,
      `You are not currently at a table, so you cannot use the <code>/${command}</code> command.`,
      'error',
    );
    return false;
  }

  private localMessage(room: string, msg: string, type: 'info' | 'error'): void {
    const epoch = this.store.getState().session.connectionEpoch;
    this.store.dispatch(chatActions.localMessageAdded({
      epoch,
      room,
      msg,
      type,
      datetime: this.now().toISOString(),
    }));
  }

  private mutedError(room: string): false {
    this.localMessage(room, 'You have been muted by an administrator.', 'error');
    return false;
  }

  private handled(success: boolean): LocalChatCommandResult {
    return { kind: success ? 'handled-success' : 'handled-failure' };
  }
}

export function getVariantFromArgs(args: readonly string[]): string {
  return args
    .filter((arg) => arg !== '')
    .map((arg) => capitalize(arg))
    .join(' ')
    .replaceAll(/ *\( */g, ' (')
    .replaceAll(/ *\) */g, ') ')
    .replaceAll(/ *- */g, '-')
    .replaceAll(/ *& */g, ' & ')
    .replaceAll(/ {2,}/g, ' ')
    .trim();
}

function capitalize(input: string): string {
  return input.toLowerCase().replaceAll(/(^|[ &()-])(\w)/g, (value) => value.toUpperCase());
}

export function getVariantNameFromPartial(search: string): string {
  return SUPPORTED_VARIANT_NAMES.find((variantName) => variantName.startsWith(search)) ?? '';
}
