import { expect, jest, test } from '@jest/globals';
import { ChatRuntime } from './ChatRuntime';

function makeRuntime(muted = false) {
  const sent: string[] = [];
  const messages: unknown[] = [];
  const lobby = {
    send: jest.fn(() => true), sendChat: jest.fn((message: string) => { sent.push(message); return true; }),
    setTableLeader: jest.fn(() => true),
  };
  const store = {
    getState: () => ({ session: { muted, connectionEpoch: 1, authenticatedUser: null, friends: [] },
      room: { room: { kind: 'none' } }, chat: { lastPM: null }, lobby: { users: { entities: {} } } }),
    dispatch: jest.fn((action: unknown) => { messages.push(action); }),
  };
  const runtime = new ChatRuntime(lobby as never, {} as never, store as never, () => new Date('2026-01-01T00:00:00Z'));
  return { runtime, lobby, sent, messages };
}

test('/copy is consumed locally without a WebSocket chat frame and fails outside finished review', () => {
  const { runtime, lobby, sent, messages } = makeRuntime();
  expect(runtime.submit('/copy')).toBe(false);
  expect(lobby.sendChat).not.toHaveBeenCalled();
  expect(sent).toEqual([]);
  expect(messages).toHaveLength(1);
});

test('unknown slash commands retain server chat fallback, and muted typed commands remain blocked first', () => {
  const normal = makeRuntime();
  expect(normal.runtime.submit('/unknown thing')).toBe(true);
  expect(normal.sent).toEqual(['/unknown thing']);
  expect(normal.lobby.sendChat).toHaveBeenCalledTimes(1);

  const muted = makeRuntime(true);
  expect(muted.runtime.submit('/copy')).toBe(false);
  expect(muted.lobby.sendChat).not.toHaveBeenCalled();
  expect(muted.messages).toHaveLength(1);
});
