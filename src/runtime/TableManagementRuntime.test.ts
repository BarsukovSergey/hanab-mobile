import { describe, expect, jest, test } from '@jest/globals';

import { knownBots } from '../config/knownBots';
import { pregameGameSchema, type ChatMessage, type MobileTableOptions } from '../protocol/lobbyProtocol';
import { lobbyActions } from '../store/lobbySlice';
import { roomActions } from '../store/roomSlice';
import { sessionActions } from '../store/sessionSlice';
import { createAppStore, type RootState } from '../store/store';
import { TableManagementRuntime, type BotJoinPM } from './TableManagementRuntime';

const options: MobileTableOptions = {
  variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
  cardCycle: false, emptyClues: false, oneExtraCard: false, oneLessCard: false, allOrNothing: false,
};
const welcome = { userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [] };
const secret = 'synthetic-table-secret';

function game(players = ['Ada', 'Bob'], changes: Record<string, unknown> = {}) {
  return pregameGameSchema.parse({
    tableID: 321, name: 'Table', owner: 1, maxPlayers: 5, passwordProtected: false,
    options: { ...options, speedrun: false, deckPlays: false, detrimentalCharacters: false },
    players: players.map((name, index) => ({
      index, name, you: name === 'Ada', present: true,
      stats: { numGames: 0, variant: { numGames: 0, averageScore: 0, numStrikeouts: 0, bestScores: [] } },
    })),
    ...changes,
  });
}

function makeRuntime() {
  const store = createAppStore();
  store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
  store.dispatch(sessionActions.welcomeReceived({ epoch: 1, welcome }));
  const send = jest.fn<(frame: string) => boolean>()
    .mockImplementation(() => store.getState().session.phase === 'ready');
  const sendPM = jest.fn<(message: BotJoinPM) => boolean>()
    .mockImplementation(() => store.getState().session.phase === 'ready');
  const ready = jest.fn<(tableID: number) => boolean>().mockReturnValue(true);
  const runtime = new TableManagementRuntime(store, send, sendPM, ready);
  return { store, send, sendPM, ready, runtime };
}
type Harness = ReturnType<typeof makeRuntime>;

function addBots({ store }: Harness, users = [
  { userID: 7, name: 'jabot1', status: 0 },
  { userID: 8, name: 'jabot2', status: 0 },
  { userID: 9, name: 'jabot3', status: 0 },
]) {
  store.dispatch(lobbyActions.userListReceived({
    epoch: 1, users: users.map((user) => ({ ...user, hyphenated: false, inactive: false })),
  }));
}

function makePregame(players = ['Ada', 'Bob'], changes: Record<string, unknown> = {}, role: 'player' | 'spectator' = 'player') {
  const result = makeRuntime();
  result.store.dispatch(roomActions.joinRequested({ epoch: 1, tableID: 321, role }));
  result.store.dispatch(roomActions.gameReceived({ epoch: 1, game: game(players, changes) }));
  result.store.dispatch(roomActions.joinedReceived({ epoch: 1, joined: { tableID: 321 } }));
  expect(result.store.getState().room.room.kind).toBe('pregame');
  return result;
}

// Inspect ownership here only; the production collaborator exposes no secret getter.
function pendingPassword(runtime: TableManagementRuntime) {
  return (runtime as unknown as { pendingBotCreate: { password: string } | null }).pendingBotCreate?.password;
}

function receive(result: Harness, command: 'game' | 'joined', epoch = 1, data = game(['Ada'], { passwordProtected: true })) {
  if (command === 'game') result.store.dispatch(roomActions.gameReceived({ epoch, game: data }));
  else result.store.dispatch(roomActions.joinedReceived({ epoch, joined: { tableID: data.tableID } }));
  result.runtime.finishPendingBotCreate(epoch);
}

describe('TableManagementRuntime create and preferences', () => {
  test('records intent after tableCreate and keeps its password outside Redux', () => {
    const { runtime, store, send } = makeRuntime();
    const before = store.getState().room;
    send.mockImplementationOnce(() => {
      expect(store.getState().room).toBe(before);
      return true;
    });
    expect(runtime.createTable(' Table ', 5, 'No Variant', secret, ['jabot1'])).toBe(true);
    expect(send.mock.calls[0]![0]).toMatch(/^tableCreate /);
    expect(JSON.parse(send.mock.calls[0]![0].slice('tableCreate '.length))).toMatchObject({ name: 'Table', password: secret });
    expect(store.getState().room.pendingCreate).toMatchObject({ name: 'Table', creatorUserID: 1 });
    expect(store.getState().room.room).toBe(before.room);
    expect(pendingPassword(runtime)).toBe(secret);
    expect(JSON.stringify(store.getState())).not.toContain(secret);
  });

  test.each<[string, string, number, MobileTableOptions, readonly string[]]>([
    ['empty name', '', 5, options, []],
    ['long name', 'x'.repeat(46), 5, options, []],
    ['too few players', 'Table', 1, options, []],
    ['too many players', 'Table', 7, options, []],
    ['fractional players', 'Table', 2.5, options, []],
    ['unsupported variant', 'Table', 5, { ...options, variantName: 'Unsupported' }, []],
    ['conflicting cards', 'Table', 5, { ...options, oneExtraCard: true, oneLessCard: true }, []],
    ['invalid timer', 'Table', 5, { ...options, timeBase: -1 }, []],
    ['too many bots', 'Table', 2, options, ['jabot1', 'jabot2']],
    ['duplicate bots', 'Table', 5, options, ['jabot1', 'JaBoT1']],
    ['unknown bot', 'Table', 5, options, ['unknown']],
  ])('rejects %s before sending or recording intent', (_label, name, maxPlayers, input, bots) => {
    const { runtime, store, send } = makeRuntime();
    const before = store.getState();
    expect(runtime.createTable(name, maxPlayers, input, '', bots)).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
    expect(pendingPassword(runtime)).toBeUndefined();
  });

  test('empty name uses the current server-provided random name', () => {
    const { runtime, store, send } = makeRuntime();
    const state = store.getState();
    jest.spyOn(store, 'getState').mockReturnValue({ ...state, session: { ...state.session, randomTableName: ' Random ' } });
    expect(runtime.createTable(' ', 5, 'No Variant')).toBe(true);
    expect(JSON.parse(send.mock.calls[0]![0].slice('tableCreate '.length)).name).toBe('Random');
  });

  test.each(['pendingRecovery', 'pendingSpectateTableID', 'pendingJoin', 'pendingCreate'] as const)(
    'create rejects existing %s', (key) => {
      const { runtime, store, send } = makeRuntime();
      const state = store.getState();
      // Only non-null presence is read by this gate.
      jest.spyOn(store, 'getState').mockReturnValue({ ...state, room: { ...state.room, [key]: {} } } as RootState);
      expect(runtime.createTable('Table', 5, options)).toBe(false);
      expect(send).not.toHaveBeenCalled();
    },
  );

  test('create rejects occupied room, missing identity, and pending replay', () => {
    const occupied = makePregame();
    expect(occupied.runtime.createTable('Table', 5, options)).toBe(false);
    expect(occupied.send).not.toHaveBeenCalled();
    for (const missingIdentity of [true, false]) {
      const { runtime, store, send } = makeRuntime();
      const state = store.getState();
      jest.spyOn(store, 'getState').mockReturnValue(missingIdentity
        ? { ...state, session: { ...state.session, authenticatedUser: null } }
        : { ...state, history: { ...state.history, pendingReplayCreate: { connectionEpoch: 1, source: 'id', visibility: 'solo', databaseID: 10 } } });
      expect(runtime.createTable('Table', 5, options)).toBe(false);
      expect(send).not.toHaveBeenCalled();
    }
  });

  test('failed tableCreate never stores intent or a password', () => {
    const { runtime, store, send } = makeRuntime();
    send.mockReturnValue(false);
    expect(runtime.createTable('Table', 5, options, secret, ['jabot1'])).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(store.getState().room.pendingCreate).toBeNull();
    expect(pendingPassword(runtime)).toBeUndefined();
  });

  test('preferences commit only successful settings and create survives partial failure', () => {
    const { runtime, store, send } = makeRuntime();
    const preferences = store.getState().session.createTablePreferences;
    send.mockImplementation((frame) => {
      if (frame.includes('createTableCardCycle')) {
        expect(store.getState().session.createTablePreferences.cardCycle).toBe(false);
        return true;
      }
      if (frame.includes('createTableEmptyClues')) {
        expect(store.getState().session.createTablePreferences.cardCycle).toBe(true);
        expect(store.getState().session.createTablePreferences.emptyClues).toBe(false);
        return false;
      }
      return true;
    });
    expect(runtime.createTable('Table', 4, { ...options, cardCycle: true, emptyClues: true }, secret, ['jabot1'])).toBe(true);
    expect(send.mock.calls.map(([frame]) => frame.split(' ')[0])).toEqual(['tableCreate', 'setting', 'setting', 'getName']);
    expect(store.getState().session.createTablePreferences).toEqual({ ...preferences, cardCycle: true });
    expect(store.getState().room.pendingCreate).not.toBeNull();
    expect(pendingPassword(runtime)).toBe(secret);
  });

  test('failed getName refresh leaves successful create and bot flow intact', () => {
    const result = makeRuntime();
    addBots(result);
    result.send.mockImplementation((frame) => !frame.startsWith('getName'));
    expect(result.runtime.createTable('Table', 5, options, secret, ['jabot1'])).toBe(true);
    expect(result.store.getState().room.pendingCreate).not.toBeNull();
    expect(pendingPassword(result.runtime)).toBe(secret);
    receive(result, 'game');
    receive(result, 'joined');
    expect(result.sendPM).toHaveBeenCalledWith({ msg: `/join ${secret}`, recipient: 'jabot1', room: 'table321' });
  });

  test('unchanged settings send nothing; timed seconds persist as fractional minutes', () => {
    const { runtime, store, send } = makeRuntime();
    expect(runtime.saveCreateTablePreferences(5, options)).toBe(true);
    expect(send).not.toHaveBeenCalled();
    expect(runtime.saveCreateTablePreferences(5, { ...options, timed: true, timeBase: 90, timePerTurn: 20 })).toBe(true);
    expect(send.mock.calls.map(([frame]) => frame)).toContain('setting {"name":"createTableTimeBaseMinutes","setting":"1.5"}');
    expect(store.getState().session.createTablePreferences).toMatchObject({ timed: true, timeBaseMinutes: 1.5, timePerTurnSeconds: 20 });
    send.mockClear();
    expect(runtime.saveCreateTablePreferences(5, options)).toBe(true);
    expect(send.mock.calls).toEqual([['setting {"name":"createTableTimed","setting":"false"}']]);
    expect(store.getState().session.createTablePreferences.timeBaseMinutes).toBe(1.5);
  });
});

describe('TableManagementRuntime bot flow and transient secret', () => {
  test.each(['game-first', 'joined-first'])('waits for both authoritative events, invites once, and releases the secret: %s', (order) => {
    const result = makeRuntime();
    addBots(result);
    expect(result.runtime.createTable('Table', 5, options, secret, ['jabot1'])).toBe(true);
    const first = order === 'game-first' ? 'game' : 'joined';
    const second = order === 'game-first' ? 'joined' : 'game';
    receive(result, first);
    expect(result.sendPM).not.toHaveBeenCalled();
    expect(pendingPassword(result.runtime)).toBe(secret);
    result.sendPM.mockImplementation(() => {
      expect(pendingPassword(result.runtime)).toBeUndefined();
      return true;
    });
    receive(result, second);
    receive(result, first);
    receive(result, second);
    expect(result.sendPM.mock.calls).toEqual([[{ msg: `/join ${secret}`, recipient: 'jabot1', room: 'table321' }]]);
    expect(JSON.stringify(result.store.getState())).not.toContain(secret);
  });

  test('unmatched game and stale notifications cannot finish the current flow', () => {
    const result = makeRuntime();
    addBots(result);
    result.runtime.createTable('Table', 5, options, secret, ['jabot1']);
    receive(result, 'game', 1, game(['Ada'], { name: 'Other' }));
    receive(result, 'joined', 0);
    result.runtime.finishPendingBotCreate(0);
    expect(result.sendPM).not.toHaveBeenCalled();
    expect(pendingPassword(result.runtime)).toBe(secret);
    receive(result, 'game');
    receive(result, 'joined');
    expect(result.sendPM).toHaveBeenCalledTimes(1);
  });

  test('rejected create releases the secret before pending intent is cleared', () => {
    const result = makeRuntime();
    result.runtime.createTable('Table', 5, options, secret, ['jabot1']);
    result.runtime.clearRejectedCreate();
    expect(result.store.getState().room.pendingCreate).not.toBeNull();
    expect(pendingPassword(result.runtime)).toBeUndefined();
    result.store.dispatch(roomActions.commandPendingCleared({ epoch: 1 }));
    receive(result, 'game');
    receive(result, 'joined');
    expect(result.sendPM).not.toHaveBeenCalled();
  });

  test('unrelated rejection without pendingCreate does not discard transient state', () => {
    const result = makeRuntime();
    result.runtime.createTable('Table', 5, options, secret, ['jabot1']);
    result.store.dispatch(roomActions.commandPendingCleared({ epoch: 1 }));
    result.runtime.clearRejectedCreate();
    expect(pendingPassword(result.runtime)).toBe(secret);
    result.runtime.finishPendingBotCreate(1);
    expect(pendingPassword(result.runtime)).toBeUndefined();
  });

  test('connection/session cleanup is idempotent and cannot replay invitations', () => {
    const result = makeRuntime();
    addBots(result);
    result.runtime.createTable('Table', 5, options, secret, ['jabot1']);
    result.runtime.clearTransientState();
    result.runtime.clearTransientState();
    expect(pendingPassword(result.runtime)).toBeUndefined();
    result.store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    result.store.dispatch(sessionActions.welcomeReceived({ epoch: 2, welcome }));
    result.store.dispatch(roomActions.joinRequested({ epoch: 2, tableID: 321 }));
    receive(result, 'game', 2);
    receive(result, 'joined', 2);
    result.runtime.finishPendingBotCreate(1);
    expect(result.sendPM).not.toHaveBeenCalled();
  });

  test('failed bot send is attempted once and does not block the next eligible bot', () => {
    const result = makeRuntime();
    addBots(result);
    result.sendPM.mockReturnValueOnce(false);
    result.runtime.createTable('Table', 5, options, secret, ['jabot1', 'jabot2']);
    receive(result, 'game');
    receive(result, 'joined');
    receive(result, 'game');
    expect(result.sendPM.mock.calls.map(([pm]) => pm.recipient)).toEqual(['jabot1', 'jabot2']);
    expect(pendingPassword(result.runtime)).toBeUndefined();
  });

  test('skips unknown, seated, busy, and offline bots and preserves selection order', () => {
    const result = makePregame(['Ada', 'jabot1'], { maxPlayers: 4 });
    addBots(result, [
      { userID: 7, name: 'jabot1', status: 0 },
      { userID: 8, name: 'jabot2', status: 3 },
      { userID: 9, name: 'JaBoT3', status: 0 },
      { userID: 10, name: 'jabot4', status: 0 },
    ]);
    expect(result.runtime.inviteBots(321, ['unknown', 'jabot1', 'jabot2', 'ser1_bot', 'jabot4', 'jabot3'])).toBe(2);
    expect(result.sendPM.mock.calls.map(([pm]) => pm.recipient)).toEqual(['jabot4', 'JaBoT3']);
    expect(result.sendPM.mock.calls.every(([pm]) => pm.msg === '/join')).toBe(true);
  });

  test('rechecks authoritative capacity after each PM', () => {
    const result = makePregame(['Ada'], { maxPlayers: 3 });
    addBots(result);
    result.sendPM.mockImplementationOnce(() => {
      result.store.dispatch(roomActions.gameReceived({ epoch: 1, game: game(['Ada', 'Bob', 'Cy'], { maxPlayers: 3 }) }));
      return true;
    });
    expect(result.runtime.inviteBots(321, ['jabot1', 'jabot2', 'jabot3'])).toBe(1);
    expect(result.sendPM).toHaveBeenCalledTimes(1);
  });

  test('rechecks user availability after each PM', () => {
    const result = makePregame(['Ada']);
    addBots(result);
    result.sendPM.mockImplementationOnce(() => {
      result.store.dispatch(lobbyActions.userLeft({ epoch: 1, userID: 8 }));
      return true;
    });
    expect(result.runtime.inviteBots(321, ['jabot1', 'jabot2', 'jabot3'])).toBe(2);
    expect(result.sendPM.mock.calls.map(([pm]) => pm.recipient)).toEqual(['jabot1', 'jabot3']);
  });

  test('requires matching pregame, hydrated users, password, and bot capability', () => {
    const result = makePregame(['Ada'], { passwordProtected: true });
    expect(result.runtime.inviteBots(321, ['jabot1'], secret)).toBe(0);
    addBots(result);
    expect(result.runtime.inviteBots(999, ['jabot1'], secret)).toBe(0);
    expect(result.runtime.inviteBots(321, ['jabot1'])).toBe(0);
    const bot = knownBots.find((entry) => entry.username === 'jabot1')!;
    const original = bot.passwordJoin;
    bot.passwordJoin = false;
    try {
      expect(result.runtime.inviteBots(321, ['jabot1', 'jabot2'], secret)).toBe(1);
      const create = makeRuntime();
      expect(create.runtime.createTable('Table', 5, options, secret, ['jabot1'])).toBe(false);
      expect(create.send).not.toHaveBeenCalled();
    } finally {
      bot.passwordJoin = original;
    }
    expect(result.sendPM.mock.calls).toEqual([[{ msg: `/join ${secret}`, recipient: 'jabot2', room: 'table321' }]]);
    expect(JSON.stringify(result.store.getState())).not.toContain(secret);
  });

  test('bot /join echo recognition is scoped to our messages and known recipients', () => {
    const { runtime } = makeRuntime();
    const echo: ChatMessage = {
      msg: `/join ${secret}`, who: 'aDa', recipient: 'JaBoT1', room: '',
      discord: false, server: false, datetime: '2026-09-01T10:00:00Z',
    };
    expect(runtime.isBotJoinEcho(echo)).toBe(true);
    expect(runtime.isBotJoinEcho({ ...echo, msg: '/join' })).toBe(true);
    expect(runtime.isBotJoinEcho({ ...echo, who: 'Bob' })).toBe(false);
    expect(runtime.isBotJoinEcho({ ...echo, recipient: 'Bob' })).toBe(false);
    expect(runtime.isBotJoinEcho({ ...echo, msg: '/joining' })).toBe(false);
  });
});

const commands = ['start', 'update', 'leader'] as const;
type Command = typeof commands[number];
function invoke(runtime: TableManagementRuntime, command: Command) {
  if (command === 'start') return runtime.startGame();
  if (command === 'update') return runtime.updateTable('Changed', 4, { ...options, cardCycle: true });
  return runtime.setTableLeader('Bob');
}

describe('TableManagementRuntime start/update/leader', () => {
  test.each(commands)('%s records intent after a successful send without changing authoritative room', (command) => {
    const { runtime, store, send } = makePregame();
    const before = store.getState().room;
    send.mockImplementationOnce(() => {
      expect(store.getState().room).toBe(before);
      return true;
    });
    expect(invoke(runtime, command)).toBe(true);
    expect(invoke(runtime, command)).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(store.getState().room.room).toBe(before.room);
    if (command === 'start') {
      expect(send).toHaveBeenCalledWith('tableStart {"tableID":321,"intendedPlayers":["Ada","Bob"]}');
      expect(store.getState().room.pendingStart).toEqual({ tableID: 321, intendedPlayers: ['Ada', 'Bob'] });
    } else if (command === 'update') {
      expect(store.getState().room.pendingUpdate).toMatchObject({ tableID: 321, name: 'Changed', maxPlayers: 4, cardCycle: true });
    } else {
      expect(send).toHaveBeenCalledWith('tableSetLeader {"tableID":321,"name":"Bob"}');
      expect(store.getState().room.pendingLeaderName).toBe('Bob');
    }
  });

  test.each(commands)('%s send failure leaves no pending intent', (command) => {
    const { runtime, store, send } = makePregame();
    const before = store.getState();
    send.mockReturnValue(false);
    expect(invoke(runtime, command)).toBe(false);
    expect(store.getState()).toBe(before);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test.each(commands)('%s rejects missing identity, non-pregame, and role switch', (command) => {
    const missingRoom = makeRuntime();
    expect(invoke(missingRoom.runtime, command)).toBe(false);
    expect(missingRoom.send).not.toHaveBeenCalled();
    for (const missingIdentity of [true, false]) {
      const { runtime, store, send } = makePregame();
      const state = store.getState();
      jest.spyOn(store, 'getState').mockReturnValue(missingIdentity
        ? { ...state, session: { ...state.session, authenticatedUser: null } }
        : { ...state, room: { ...state.room, pendingRoleSwitch: {
          tableID: 321, targetRole: 'spectator', leaveSent: false, spectateSent: false,
          rejected: false, leftConfirmed: false, joinedConfirmed: false, stagedGame: null,
        } } });
      expect(invoke(runtime, command)).toBe(false);
      expect(send).not.toHaveBeenCalled();
    }
  });

  test('start rejects non-owner, solo table, and pending leave', () => {
    const leaving = makePregame();
    leaving.store.dispatch(roomActions.leaveRequested({ epoch: 1, tableID: 321 }));
    for (const result of [makePregame(['Ada', 'Bob'], { owner: 2 }), makePregame(['Ada']), leaving]) {
      const { runtime, store, send } = result;
      const before = store.getState();
      expect(runtime.startGame()).toBe(false);
      expect(send).not.toHaveBeenCalled();
      expect(store.getState()).toBe(before);
    }
  });

  test('non-owner update sends a proposal without pendingUpdate or optimistic changes', () => {
    const { runtime, store, send } = makePregame(['Ada', 'Bob'], { owner: 2 });
    const before = store.getState();
    expect(invoke(runtime, 'update')).toBe(true);
    expect(store.getState()).toBe(before);
    expect(store.getState().room.pendingUpdate).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('invalid update payload fails before sending', () => {
    const { runtime, send } = makePregame();
    expect(runtime.updateTable('Changed', 1, options)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  test('leader requires a player target, permission, and current pregame readiness', () => {
    const result = makePregame();
    expect(result.runtime.setTableLeader('Unknown')).toBe(false);
    expect(result.runtime.setTableLeader('Ada')).toBe(false);
    result.ready.mockReturnValue(false);
    expect(result.runtime.setTableLeader('Bob')).toBe(false);
    expect(result.ready).toHaveBeenCalledWith(321);
    expect(result.send).not.toHaveBeenCalled();
    const spectator = makePregame(['Ada', 'Bob'], {}, 'spectator');
    expect(spectator.runtime.setTableLeader('Bob')).toBe(false);
    const nonOwner = makePregame(['Bob', 'Ada', 'Cy'], { owner: 2 });
    expect(nonOwner.runtime.setTableLeader('Cy')).toBe(false);
    expect(nonOwner.runtime.setTableLeader('Ada')).toBe(true);
    expect(nonOwner.send).toHaveBeenCalledTimes(1);
  });

  test('all sends remain READY-gated and are never replayed on a later connection', () => {
    const result = makePregame();
    addBots(result);
    const state = result.store.getState();
    const stateSpy = jest.spyOn(result.store, 'getState').mockReturnValue({
      ...state, session: { ...state.session, phase: 'closed' },
    });
    for (const command of commands) expect(invoke(result.runtime, command)).toBe(false);
    expect(result.runtime.inviteBots(321, ['jabot1'])).toBe(0);
    expect(result.store.getState().room).toBe(state.room);
    stateSpy.mockRestore();
    result.store.dispatch(sessionActions.connectionClosed({ epoch: 1, error: null }));
    for (const command of commands) expect(invoke(result.runtime, command)).toBe(false);
    expect(result.runtime.createTable('Table', 5, options, secret, ['jabot1'])).toBe(false);
    expect(result.runtime.saveCreateTablePreferences(4, options)).toBe(false);
    expect(result.runtime.inviteBots(321, ['jabot1'])).toBe(0);
    result.runtime.clearTransientState();
    result.send.mockClear();
    result.store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    result.store.dispatch(sessionActions.welcomeReceived({ epoch: 2, welcome }));
    result.runtime.finishPendingBotCreate(2);
    expect(result.send).not.toHaveBeenCalled();
    expect(result.sendPM).not.toHaveBeenCalled();
    expect(result.store.getState().room.pendingStart).toBeNull();
    expect(result.store.getState().room.pendingUpdate).toBeNull();
    expect(result.store.getState().room.pendingLeaderName).toBeNull();
  });
});
