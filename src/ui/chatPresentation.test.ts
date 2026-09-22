import { describe, expect, test } from '@jest/globals';

import { chatMessageMetadata } from './chatPresentation';

describe('chat message presentation', () => {
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
