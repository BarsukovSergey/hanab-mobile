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
    store.dispatch(chatActions.messageReceived({ epoch: 1, message: message('stale') }));
    store.dispatch(chatActions.historyReceived({
      epoch: 1,
      defaultRoom: 'lobby',
      messages: [message('one'), message('two')],
    }));
    store.dispatch(chatActions.messageReceived({ epoch: 1, message: message('three') }));
    expect(store.getState().chat.messagesByRoom.lobby?.map((entry) => entry.msg)).toEqual([
      'one', 'two', 'three',
    ]);
  });

  test('new epochs and explicit signout clear all rooms; stale traffic is ignored', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(chatActions.messageReceived({ epoch: 1, message: message('lobby') }));
    store.dispatch(chatActions.messageReceived({
      epoch: 1, message: message('table', 'table123'),
    }));
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    store.dispatch(chatActions.messageReceived({ epoch: 1, message: message('late') }));
    expect(store.getState().chat.messagesByRoom).toEqual({});
    store.dispatch(chatActions.messageReceived({ epoch: 2, message: message('current') }));
    store.dispatch(sessionActions.signedOut());
    expect(store.getState().chat).toEqual({ connectionEpoch: 0, messagesByRoom: {} });
  });
});
