import type { AppStore } from '../store/store';
import type { LobbyRuntime } from './LobbyRuntime';
import type { TerminationRuntime } from './terminationRuntime';

export type LocalChatCommandResult =
  | { kind: 'handled-success' }
  | { kind: 'handled-failure' }
  | { kind: 'not-handled' };

const LEADER_COMMANDS = new Set([
  'setleader',
  'setlead',
  'setowner',
  'changeleader',
  'changelead',
  'changeowner',
]);

export class ChatRuntime {
  constructor(
    private readonly lobbyRuntime: Pick<LobbyRuntime, 'sendChat' | 'setTableLeader'>,
    private readonly terminationRuntime: Pick<
      TerminationRuntime,
      'terminateGame' | 'voteForTermination'
    >,
    private readonly store: Pick<AppStore, 'getState'>,
  ) {}

  submit(message: string): boolean {
    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > 300) return false;

    const result = this.routeLocalCommand(trimmed);
    if (result.kind === 'not-handled') return this.lobbyRuntime.sendChat(message);
    return result.kind === 'handled-success';
  }

  routeLocalCommand(message: string): LocalChatCommandResult {
    const trimmed = message.trim();
    if (!trimmed.startsWith('/') || trimmed === '/') return { kind: 'not-handled' };

    const separatorIndex = trimmed.search(/\s/);
    const command = (separatorIndex === -1
      ? trimmed.slice(1)
      : trimmed.slice(1, separatorIndex)).toLowerCase();
    const argument = separatorIndex === -1 ? '' : trimmed.slice(separatorIndex).trim();

    if (command === 'terminate') {
      return this.handled(this.terminationRuntime.terminateGame());
    }
    if (command === 'vote') {
      return this.handled(this.terminationRuntime.voteForTermination());
    }
    if (!LEADER_COMMANDS.has(command)) return { kind: 'not-handled' };

    const room = this.store.getState().room.room;
    const normalizedArgument = argument.toLowerCase();
    const target = room.kind === 'pregame' && normalizedArgument.length > 0
      ? room.data.players.find((player) => player.name.toLowerCase() === normalizedArgument)
      : undefined;
    if (target === undefined) return { kind: 'handled-failure' };
    return this.handled(this.lobbyRuntime.setTableLeader(target.name));
  }

  private handled(success: boolean): LocalChatCommandResult {
    return { kind: success ? 'handled-success' : 'handled-failure' };
  }
}
