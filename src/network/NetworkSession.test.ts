import { afterEach, describe, expect, jest, test } from '@jest/globals';

import { HanabNetworkSession } from './NetworkSession';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('HanabNetworkSession logout', () => {
  test('uses credentialed GET and allows the caller to verify the missing session', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    const session = new HanabNetworkSession();

    await session.logout();
    await expect(session.checkSession()).resolves.toEqual({ kind: 'missing' });

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://hanab.live/logout', {
      method: 'GET', credentials: 'include',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://hanab.live/test-cookie', {
      method: 'GET', credentials: 'include',
    });
  });
});
