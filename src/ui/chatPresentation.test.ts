import { describe, expect, test } from '@jest/globals';

import { chatMessageMetadata, sessionPrivateMessages } from './chatPresentation';
import type { ReadableChatMessage } from '../store/chatSlice';

const pm = (who: string, recipient: string, msg: string, datetime: string, room = 'lobby', source: 'live' | 'history' = 'live'): ReadableChatMessage => ({
  who, recipient, msg, rawMsg: msg, datetime, room, discord: false, server: false, source,
});

describe('chat message presentation', () => {
  test('selects both directions for the selected user, excludes unrelated and ordinary chat, and sorts chronologically', () => {
    const messages = {
      lobby: [
        pm('ADA', 'BOb', 'later', '2026-09-01T11:00:00Z'),
        pm('Cy', 'Bob', 'other user', '2026-09-01T09:00:00Z'),
        { ...pm('Ada', '', 'room chat', '2026-09-01T08:00:00Z'), source: 'live' as const },
        pm('Bob', 'Ada', 'earlier', '2026-09-01T10:00:00Z', 'table4'),
        pm('Bob', 'Ada', 'bootstrap', '2026-09-01T07:00:00Z', 'lobby', 'history'),
      ],
    };
    expect(sessionPrivateMessages(messages, 'ada', 'bob').map(({ msg }) => msg))
      .toEqual(['earlier', 'later']);
  });

  test('labels outgoing private messages with their recipient', () => {
    expect(chatMessageMetadata({ who: 'Ada', recipient: 'Bob', server: false }, 'Ada'))
      .toBe('[PM to Bob]');
  });

  test('labels incoming private messages with their sender', () => {
    expect(chatMessageMetadata({ who: 'Ada', recipient: 'Bob', server: false }, 'bob'))
      .toBe('[PM from Ada]');
  });

  test('keeps the existing author format for ordinary messages', () => {
    expect(chatMessageMetadata({ who: 'Ada', recipient: '', server: false }, 'Bob'))
      .toBe('Ada:');
    expect(chatMessageMetadata({ who: '', recipient: '', server: true }, 'Bob'))
      .toBe('Server:');
  });
});
