import { describe, expect, test } from '@jest/globals';

import { chatMarkupToPlainText } from '../protocol/chatText';
import { chatActions } from './chatSlice';
import { sessionActions } from './sessionSlice';
import { createAppStore } from './store';

const message = (msg: string, room = 'lobby') => ({
  msg,
  who: 'Ada',
  discord: false,
  server: false,
  datetime: '2026-09-01T10:00:00Z',
  room,
  recipient: '',
});

describe('chat state and plain-text conversion', () => {
  test('removes server markup before decoding escaped user input', () => {
    expect(chatMarkupToPlainText(
      '<span class="red">Notice</span><br>&lt;script&gt;safe&lt;/script&gt; &amp; &#9731;',
    )).toBe(`Notice\n<script>safe</script> & ${String.fromCodePoint(9731)}`);
  });

  test('history replaces its room while incremental messages append', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(chatActions.messageReceived({
      epoch: 1, defaultRoom: 'lobby', message: message('stale'),
    }));
    store.dispatch(chatActions.historyReceived({
      epoch: 1,
      defaultRoom: 'lobby',
      messages: [message('one'), message('two')],
    }));
    store.dispatch(chatActions.messageReceived({
      epoch: 1, defaultRoom: 'lobby', message: message('three'),
    }));
    expect(store.getState().chat.messagesByRoom.lobby?.map((entry) => entry.msg)).toEqual([
      'one', 'two', 'three',
    ]);
  });

  test('actual Go public and server messages become renderable plain text', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(chatActions.historyReceived({
      epoch: 1,
      defaultRoom: 'lobby',
      messages: [
        message('hello &amp; goodbye'),
        { ...message('<strong>Server ready</strong>'), who: '', server: true },
      ],
    }));

    expect(store.getState().chat.messagesByRoom.lobby).toMatchObject([
      { who: 'Ada', recipient: '', server: false, msg: 'hello & goodbye' },
      { who: '', recipient: '', server: true, msg: 'Server ready' },
    ]);
  });

  test('routes blank-room private messages through the supplied current room', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    const privateMessage = { ...message('private'), room: '', recipient: 'Bob' };

    store.dispatch(chatActions.messageReceived({
      epoch: 1, defaultRoom: 'table123', message: privateMessage,
    }));
    store.dispatch(chatActions.historyReceived({
      epoch: 1,
      defaultRoom: 'table123',
      messages: [{ ...privateMessage, msg: 'history private' }],
    }));

    expect(store.getState().chat.messagesByRoom).toEqual({
      table123: [expect.objectContaining({
        msg: 'history private', room: 'table123', who: 'Ada', recipient: 'Bob',
      })],
    });
  });

  test('tracks only the latest incoming PM sender using the canonical payload name', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(chatActions.messageReceived({
      epoch: 1,
      defaultRoom: 'table123',
      authenticatedUsername: 'bOb',
      message: { ...message('incoming'), room: '', recipient: 'Bob' },
    }));
    expect(store.getState().chat.lastPM).toBe('Ada');

    store.dispatch(chatActions.messageReceived({
      epoch: 1,
      defaultRoom: 'table123',
      authenticatedUsername: 'Bob',
      message: {
        ...message('outgoing'), who: 'Bob', room: '', recipient: 'Cy',
      },
    }));
    expect(store.getState().chat.lastPM).toBe('Ada');

    store.dispatch(chatActions.messageReceived({
      epoch: 1,
      defaultRoom: 'lobby',
      authenticatedUsername: 'Bob',
      message: {
        ...message('newer incoming'), who: 'Cy', room: '', recipient: 'BOB',
      },
    }));
    expect(store.getState().chat.lastPM).toBe('Cy');
  });

  test('keeps ordinary room routing and drops unsupported garbage rooms', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(chatActions.messageReceived({
      epoch: 1, defaultRoom: 'table123', message: message('lobby', 'lobby'),
    }));
    store.dispatch(chatActions.messageReceived({
      epoch: 1, defaultRoom: 'lobby', message: message('table', 'table123'),
    }));
    store.dispatch(chatActions.messageReceived({
      epoch: 1, defaultRoom: 'lobby', message: message('garbage', 'somewhere'),
    }));

    expect(store.getState().chat.messagesByRoom.lobby?.map(({ msg }) => msg)).toEqual(['lobby']);
    expect(store.getState().chat.messagesByRoom.table123?.map(({ msg }) => msg)).toEqual(['table']);
    expect(store.getState().chat.messagesByRoom.somewhere).toBeUndefined();
  });

  test('new epochs and explicit signout clear all rooms; stale traffic is ignored', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(chatActions.messageReceived({
      epoch: 1, defaultRoom: 'lobby', message: message('lobby'),
    }));
    store.dispatch(chatActions.messageReceived({
      epoch: 1, defaultRoom: 'table123', message: message('table', 'table123'),
    }));
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    store.dispatch(chatActions.messageReceived({
      epoch: 1, defaultRoom: 'lobby', message: message('late'),
    }));
    expect(store.getState().chat.messagesByRoom).toEqual({});
    store.dispatch(chatActions.messageReceived({
      epoch: 2, defaultRoom: 'lobby', message: message('current'),
    }));
    store.dispatch(sessionActions.signedOut());
    expect(store.getState().chat).toEqual({
      connectionEpoch: 0, lastPM: null, messagesByRoom: {},
    });
  });
});
