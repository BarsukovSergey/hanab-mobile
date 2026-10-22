import type { NetworkSession, NetworkSocket, SessionCheckResult } from '../../network/types';
import type { GameHistory } from '../../protocol/gameProtocol';
import { makeInit } from '../../protocol/gameProtocol.fixtures';

type MessageListener = (event: WebSocketMessageEvent) => void;

export class FakeSocket implements NetworkSocket {
  readyState = 0;
  readonly sent: string[] = [];
  private readonly opens = new Set<() => void>();
  private readonly messages = new Set<MessageListener>();
  private readonly errors = new Set<() => void>();
  private readonly closes = new Set<(event: WebSocketCloseEvent) => void>();

  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: MessageListener): void;
  addEventListener(type: 'error', listener: () => void): void;
  addEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  addEventListener(type: string, listener: never): void {
    if (type === 'open') this.opens.add(listener);
    if (type === 'message') this.messages.add(listener);
    if (type === 'error') this.errors.add(listener);
    if (type === 'close') this.closes.add(listener);
  }

  removeEventListener(type: 'open', listener: () => void): void;
  removeEventListener(type: 'message', listener: MessageListener): void;
  removeEventListener(type: 'error', listener: () => void): void;
  removeEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  removeEventListener(type: string, listener: never): void {
    if (type === 'open') this.opens.delete(listener);
    if (type === 'message') this.messages.delete(listener);
    if (type === 'error') this.errors.delete(listener);
    if (type === 'close') this.closes.delete(listener);
  }

  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; }
  emitOpen(): void {
    this.readyState = 1;
    for (const listener of [...this.opens]) listener();
  }
  emitMessage(data: string): void {
    for (const listener of [...this.messages]) listener({ data } as WebSocketMessageEvent);
  }
  emitClose(): void {
    this.readyState = 3;
    for (const listener of [...this.closes]) listener({ code: 1006 } as WebSocketCloseEvent);
  }
  snapshotMessages(): MessageListener[] { return [...this.messages]; }
}

export class FakeSession implements NetworkSession {
  readonly sockets = [new FakeSocket(), new FakeSocket()] as const;
  private nextSocket = 0;
  checkSession(): Promise<SessionCheckResult> { return Promise.resolve({ kind: 'valid' }); }
  submitLogin(): Promise<void> { return Promise.resolve(); }
  logout(): Promise<void> { return Promise.resolve(); }
  fetchTaggedGames(): Promise<GameHistory> { return Promise.resolve([]); }
  searchTag(): Promise<GameHistory> { return Promise.resolve([]); }
  openSocket(): Promise<NetworkSocket> {
    const socket = this.sockets[this.nextSocket++];
    if (socket === undefined) throw new Error('Unexpected socket attempt');
    return Promise.resolve(socket);
  }
}

export function welcome(socket: FakeSocket, tableID = 123) {
  socket.emitOpen();
  socket.emitMessage(`welcome ${JSON.stringify({
    userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [tableID],
  })}`);
  socket.emitMessage('userList []');
  socket.emitMessage('tableList []');
}

export function history(tableID = 123, sharedReview = false) {
  return { tableID, list: [
    ...Array.from({ length: 5 }, (_, order) => ({
      type: 'draw', playerIndex: 0, order, suitIndex: sharedReview ? 0 : -1, rank: sharedReview ? 1 : -1,
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      type: 'draw', playerIndex: 1, order: index + 5, suitIndex: index, rank: index + 1,
    })),
    { type: 'status', clues: 8, score: 0, maxScore: 25 },
    { type: 'turn', num: 0, currentPlayerIndex: 0 },
  ] };
}

export function bootstrap(socket: FakeSocket, tableID = 123, sharedReview = false) {
  socket.emitMessage(`tableStart ${JSON.stringify({ tableID, replay: sharedReview })}`);
  socket.emitMessage(`init ${JSON.stringify(makeInit({
    tableID,
    ...(sharedReview ? {
      replay: true, sharedReplay: true, databaseID: 77,
      datetimeFinished: '2026-08-31T00:10:00Z', sharedReplayLeader: 'Bob',
    } : {}),
  }))}`);
  socket.emitMessage(`gameActionList ${JSON.stringify(history(tableID, sharedReview))}`);
}
