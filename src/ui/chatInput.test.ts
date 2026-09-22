import { describe, expect, test } from '@jest/globals';

import { SHRUG_TEXT, transformChatInput } from './chatInput';

describe('chat input transformations', () => {
  test('expands the exact reply shortcut using the canonical last PM sender', () => {
    expect(transformChatInput('/r ', 'Ada')).toBe('/pm Ada ');
    expect(transformChatInput('/r ', null)).toBe('/r ');
  });

  test('expands exact shrug input', () => {
    expect(transformChatInput('/shrug', null)).toBe('¯\\_(ツ)_/¯');
    expect(transformChatInput('/shrug ', null)).toBe('/shrug ');
    expect(SHRUG_TEXT).toBe('¯\\_(ツ)_/¯');
  });

  test('leaves ordinary input unchanged', () => {
    expect(transformChatInput('hello', 'Ada')).toBe('hello');
    expect(transformChatInput('/help', 'Ada')).toBe('/help');
    expect(transformChatInput('/whatever', 'Ada')).toBe('/whatever');
  });
});
