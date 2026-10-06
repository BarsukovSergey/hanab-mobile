import { describe, expect, jest, test } from '@jest/globals';

import type { ChatMessage } from '../protocol/lobbyProtocol';
import { ChatRuntime } from '../runtime/ChatRuntime';
import { sessionPrivateMessages } from '../ui/chatPresentation';
import { sessionConversation, sessionConversationRows, sessionMessageDraft } from '../ui/sessionMessagesPresentation';
import { chatActions } from './chatSlice';
import { lobbyActions } from './lobbySlice';
import { sessionActions } from './sessionSlice';
import { sessionMessagesActions, sessionMessagesSlice } from './sessionMessagesSlice';
import { createAppStore, type AppStore } from './store';

const pm = (who = 'Alice', recipient = 'Ada', msg = 'hello', datetime = 'invalid'): ChatMessage => ({
  who, recipient, msg, datetime, room: '', discord: false, server: false,
});
function welcome(store: AppStore, username = 'Ada', epoch = 1) {
  store.dispatch(sessionActions.welcomeReceived({ epoch, welcome: {
    username, userID: 1, totalGames: 0, playingAtTables: [],
  } }));
}
function ready() {
  const store = createAppStore();
  store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
  welcome(store);
  return store;
}
function observe(store: AppStore, message = pm(), defaultRoom = 'lobby', epoch = 1, authenticatedUsername = 'Ada') {
  store.dispatch(chatActions.messageReceived({ epoch, message, defaultRoom, authenticatedUsername }));
}
const edit = (username = 'Alice', authenticatedUsername = 'Ada') => ({ username, authenticatedUsername });

describe('session Messages observation and local policy', () => {
  test('fresh store is empty and first current welcome binds the owner', () => {
    const store = createAppStore();
    expect(store.getState().sessionMessages).toEqual({
      connectionEpoch: 0, ownerUsername: null, ownerConfirmed: false,
      nextSequence: 1, conversations: {}, drafts: {},
    });
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    welcome(store, 'wrong', 0);
    expect(store.getState().sessionMessages.ownerConfirmed).toBe(false);
    welcome(store);
    expect(store.getState().sessionMessages).toMatchObject({ ownerUsername: 'Ada', ownerConfirmed: true });
  });

  test('combines both live directions across rooms with case-insensitive identity and plain text', () => {
    const store = ready();
    observe(store, pm('Alice', 'aDA', '<b>hello</b> &amp; hi', '2026-10-06T12:00:00Z'));
    observe(store, pm('ADA', 'aLiCe', 'reply', '2026-10-06T11:00:00Z'), 'table4', 1, 'ada');
    const state = store.getState().sessionMessages;
    expect(Object.keys(state.conversations)).toEqual(['alice']);
    expect(sessionConversation(state, 'ADA', 'ALICE')).toEqual({
      username: 'aLiCe', unread: 1, hasReconnectGap: false, messages: [
        { sequence: 1, direction: 'incoming', who: 'Alice', recipient: 'aDA', msg: 'hello & hi', datetime: '2026-10-06T12:00:00Z' },
        { sequence: 2, direction: 'outgoing', who: 'ADA', recipient: 'aLiCe', msg: 'reply', datetime: '2026-10-06T11:00:00Z' },
      ],
    });
    // The legacy Dialog recognizes exactly these two directions, though it sorts by time.
    expect(sessionPrivateMessages(store.getState().chat.messagesByRoom, 'Ada', 'alice')
      .map(({ msg }) => msg).sort()).toEqual(state.conversations.alice!.messages.map(({ msg }) => msg).sort());
  });

  test('excludes unrelated PMs, public chat, stale epochs and mismatched or absent action identity', () => {
    const store = ready();
    observe(store, pm('Alice', 'Bob'));
    observe(store, pm('Alice', ''));
    observe(store, pm(), 'lobby', 0);
    observe(store, pm(), 'lobby', 1, 'Bob');
    store.dispatch(chatActions.messageReceived({ epoch: 1, defaultRoom: 'lobby', message: pm() }));
    expect(store.getState().sessionMessages.conversations).toEqual({});
    expect(store.getState().sessionMessages.nextSequence).toBe(1);
  });

  test('history and local room messages never backfill session PMs', () => {
    const store = ready();
    store.dispatch(chatActions.historyReceived({ epoch: 1, defaultRoom: 'lobby', messages: [pm()] }));
    store.dispatch(chatActions.localMessageAdded({ epoch: 1, room: 'lobby', msg: 'sent', type: 'info', datetime: 'invalid' }));
    expect(store.getState().sessionMessages.conversations).toEqual({});
  });

  test('rows use observation order, expose last message and metadata, and exclude drafts', () => {
    const store = ready();
    observe(store, pm('Alice', 'Ada', 'first', '2099-01-01'));
    observe(store, pm('Bob', 'Ada', 'second', 'invalid'));
    observe(store, pm('Ada', 'Alice', 'third', '2000-01-01'));
    store.dispatch(sessionMessagesActions.draftChanged({ ...edit('Carol'), draft: 'draft only' }));
    expect(sessionConversationRows(store.getState().sessionMessages, 'Ada')).toEqual([
      { username: 'Alice', lastMessage: expect.objectContaining({ sequence: 3, msg: 'third' }), unread: 1, hasReconnectGap: false },
      { username: 'Bob', lastMessage: expect.objectContaining({ sequence: 2, msg: 'second' }), unread: 1, hasReconnectGap: false },
    ]);
    expect(sessionConversation(store.getState().sessionMessages, 'Ada', 'Carol')).toBeNull();
  });

  test('incoming increments unread, own echo does not, and local read changes only PM unread', () => {
    const store = ready();
    observe(store);
    observe(store);
    observe(store, pm('Ada', 'Alice'));
    observe(store, pm('Bob'));
    const roomChat = store.getState().chat;
    expect(store.getState().sessionMessages.conversations.alice!.unread).toBe(2);
    store.dispatch(sessionMessagesActions.conversationRead(edit('ALICE')));
    expect(store.getState().sessionMessages.conversations.alice!.unread).toBe(0);
    expect(store.getState().sessionMessages.conversations.bob!.unread).toBe(1);
    expect(store.getState().chat).toBe(roomChat);
  });

  test('normalized drafts are independent; failure preserves and success clears only the submitted draft', () => {
    const store = ready();
    store.dispatch(sessionMessagesActions.draftChanged({ ...edit(), draft: 'one' }));
    store.dispatch(sessionMessagesActions.draftChanged({ ...edit('Bob'), draft: 'two' }));
    store.dispatch(sessionMessagesActions.draftChanged({ ...edit('ALICE'), draft: 'changed' }));
    store.dispatch(sessionMessagesActions.draftSubmissionFinished({ ...edit(), succeeded: false }));
    expect(sessionMessageDraft(store.getState().sessionMessages, 'ada', 'ALICE')).toBe('changed');
    store.dispatch(sessionMessagesActions.draftSubmissionFinished({ ...edit(), succeeded: true }));
    expect(store.getState().sessionMessages.drafts).toEqual({ bob: 'two' });
    expect(store.getState().sessionMessages.conversations).toEqual({});
  });

  test('local runtime send acceptance alone creates no transcript', () => {
    const store = ready();
    store.dispatch(lobbyActions.userListReceived({ epoch: 1, users: [{
      userID: 2, name: 'Alice', status: 0, hyphenated: false, inactive: false,
    }] }));
    const send = jest.fn(() => true);
    const runtime = new ChatRuntime({ send, sendChat: () => true, setTableLeader: () => true },
      { terminateGame: () => true, voteForTermination: () => true }, store);
    store.dispatch(sessionMessagesActions.draftChanged({ ...edit(), draft: 'hello' }));
    const succeeded = runtime.sendPrivateMessage('Alice', 'hello');
    expect(succeeded).toBe(true);
    expect(send).toHaveBeenCalledWith('chatPM', { msg: 'hello', recipient: 'Alice', room: 'lobby' });
    store.dispatch(sessionMessagesActions.draftSubmissionFinished({ ...edit(), succeeded }));
    expect(store.getState().sessionMessages.conversations).toEqual({});
    observe(store, pm('Ada', 'Alice'));
    expect(store.getState().sessionMessages.conversations.alice!.messages).toHaveLength(1);
  });
});

describe('session Messages reconnect and account privacy', () => {
  function retained() {
    const store = ready();
    observe(store);
    observe(store, pm('Ada', 'Bob'));
    store.dispatch(sessionMessagesActions.draftChanged({ ...edit(), draft: 'unsent' }));
    store.dispatch(sessionMessagesActions.draftChanged({ ...edit('Carol'), draft: 'draft only' }));
    store.dispatch(chatActions.draftChanged({ room: 'lobby', draft: 'room draft' }));
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    return store;
  }

  test('reconnect retains PMs/drafts/unread/order and marks every observed conversation, while room chat resets', () => {
    const store = retained();
    const state = store.getState().sessionMessages;
    expect(state).toMatchObject({ connectionEpoch: 2, ownerUsername: 'Ada', ownerConfirmed: false, nextSequence: 3,
      drafts: { alice: 'unsent', carol: 'draft only' } });
    expect(state.conversations.alice).toMatchObject({ unread: 1, hasReconnectGap: true, messages: [expect.objectContaining({ sequence: 1 })] });
    expect(state.conversations.bob).toMatchObject({ unread: 0, hasReconnectGap: true, messages: [expect.objectContaining({ sequence: 2 })] });
    expect(Object.keys(state.conversations)).toEqual(['alice', 'bob']);
    expect(store.getState().chat).toMatchObject({ messagesByRoom: {}, unreadByRoom: {}, lastPM: null, draftByRoom: { lobby: 'room draft' } });
  });

  test('pending confirmation hides retained data and rejects PM observation and edits', () => {
    const store = retained();
    const before = store.getState().sessionMessages;
    for (const owner of ['Ada', 'Bob', null, undefined]) {
      expect(sessionConversationRows(before, owner)).toEqual([]);
      expect(sessionConversation(before, owner, 'Alice')).toBeNull();
      expect(sessionMessageDraft(before, owner, 'Alice')).toBe('');
    }
    observe(store, pm(), 'lobby', 2);
    store.dispatch(sessionMessagesActions.draftChanged({ ...edit(), draft: 'overwrite' }));
    store.dispatch(sessionMessagesActions.conversationRead(edit()));
    store.dispatch(sessionMessagesActions.draftSubmissionFinished({ ...edit(), succeeded: true }));
    welcome(store, 'Ada', 1);
    expect(store.getState().sessionMessages).toBe(before);
  });

  test('same account restores visibility and keeps gaps through successful and repeated reconnects', () => {
    const store = retained();
    welcome(store, 'ADA', 2);
    expect(sessionConversationRows(store.getState().sessionMessages, 'ada')).toHaveLength(2);
    expect(sessionMessageDraft(store.getState().sessionMessages, 'ada', 'alice')).toBe('unsent');
    observe(store, pm(), 'table9', 1);
    observe(store, pm(), 'table9', 2, 'ada');
    expect(store.getState().sessionMessages.conversations.alice).toMatchObject({ hasReconnectGap: true, unread: 2 });
    store.dispatch(sessionActions.connectionStarted({ epoch: 3 }));
    welcome(store, 'Ada', 3);
    expect(store.getState().sessionMessages.conversations.alice!.messages.map(({ sequence }) => sequence)).toEqual([1, 3]);
  });

  test.each([false, true])('account change clears all previous data (reconnect=%s)', (reconnect) => {
    const store = retained();
    welcome(store, 'Ada', 2);
    if (reconnect) store.dispatch(sessionActions.connectionStarted({ epoch: 3 }));
    welcome(store, 'Bob', reconnect ? 3 : 2);
    expect(store.getState().sessionMessages).toEqual({ connectionEpoch: reconnect ? 3 : 2,
      ownerUsername: 'Bob', ownerConfirmed: true, nextSequence: 1, conversations: {}, drafts: {} });
    observe(store, pm('Alice', 'Bob'), 'lobby', reconnect ? 3 : 2, 'Bob');
    const before = store.getState().sessionMessages;
    expect(sessionConversationRows(before, 'Ada')).toEqual([]);
    expect(sessionConversation(before, 'Ada', 'Alice')).toBeNull();
    expect(sessionMessageDraft(before, 'Ada', 'Alice')).toBe('');
    store.dispatch(sessionMessagesActions.draftChanged({ ...edit(), draft: 'stale A' }));
    store.dispatch(sessionMessagesActions.conversationRead(edit()));
    expect(store.getState().sessionMessages).toBe(before);
    expect(before.conversations.alice!.messages[0]!.sequence).toBe(1);
  });

  test('signout clears retained data and a cold store has no recovery', () => {
    const store = retained();
    expect(createAppStore().getState().sessionMessages.conversations).toEqual({});
    store.dispatch(sessionActions.signedOut());
    expect(store.getState().sessionMessages).toEqual(createAppStore().getState().sessionMessages);
  });

  test('draft-only reconnect does not create a conversation or gap', () => {
    const store = ready();
    store.dispatch(sessionMessagesActions.draftChanged({ ...edit(), draft: 'unsent' }));
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    welcome(store, 'Ada', 2);
    expect(sessionConversationRows(store.getState().sessionMessages, 'Ada')).toEqual([]);
    expect(sessionMessageDraft(store.getState().sessionMessages, 'Ada', 'Alice')).toBe('unsent');
  });

  test('caps transcripts at 1000 without resetting observation sequence or unread', () => {
    let state = ready().getState().sessionMessages;
    for (let index = 0; index < 1005; index++) {
      state = sessionMessagesSlice.reducer(state, chatActions.messageReceived({
        epoch: 1, authenticatedUsername: 'Ada', defaultRoom: 'lobby', message: pm(),
      }));
    }
    expect(state.conversations.alice!.messages).toHaveLength(1000);
    expect(state.conversations.alice!.messages[0]!.sequence).toBe(6);
    expect(state.conversations.alice!.messages[999]!.sequence).toBe(1005);
    expect(state.conversations.alice!.unread).toBe(1005);
    expect(state.nextSequence).toBe(1006);
  });
});
