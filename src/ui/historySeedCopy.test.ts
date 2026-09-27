import { describe, expect, jest, test } from '@jest/globals';

import type { ClipboardActions } from '../platform/replayInputActions';
import { copyHistorySeed } from './historySeedCopy';

describe('copyHistorySeed', () => {
  test('passes the exact seed string to the injected clipboard writer', async () => {
    const writeClipboard = jest.fn<ClipboardActions['writeClipboard']>().mockResolvedValue(undefined);
    const clipboard: ClipboardActions = { readClipboard: async () => '', writeClipboard };

    await expect(copyHistorySeed('  Exact Seed String  ', clipboard)).resolves.toBe(true);
    expect(writeClipboard).toHaveBeenCalledWith('  Exact Seed String  ');
  });

  test('returns false when clipboard writing fails', async () => {
    const writeClipboard = jest.fn<ClipboardActions['writeClipboard']>().mockRejectedValue(new Error('clipboard unavailable'));
    const clipboard: ClipboardActions = { readClipboard: async () => '', writeClipboard };

    await expect(copyHistorySeed('seed', clipboard)).resolves.toBe(false);
  });
});
