import { afterEach, describe, expect, jest, test } from '@jest/globals';

import { HanabNetworkSession } from './NetworkSession';
import { NetworkRequestError } from './types';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function mockHungFetch() {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(
    (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
    }),
  );
}

describe('HanabNetworkSession HTTP timeouts', () => {
  test('a hung session probe becomes an indeterminate transport failure', async () => {
    jest.useFakeTimers();
    mockHungFetch();
    const result = new HanabNetworkSession().checkSession();

    await jest.advanceTimersByTimeAsync(10_000);

    await expect(result).resolves.toEqual({
      kind: 'indeterminate',
      error: { kind: 'transport', message: 'Request timed out' },
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each([
    ['login', (session: HanabNetworkSession) => session.submitLogin('user', 'password')],
    ['logout', (session: HanabNetworkSession) => session.logout()],
  ])('a hung %s becomes a transport failure', async (_name, request) => {
    jest.useFakeTimers();
    mockHungFetch();
    const result = request(new HanabNetworkSession()).catch((error: unknown) => error);

    await jest.advanceTimersByTimeAsync(10_000);

    const error = await result;
    expect(error).toBeInstanceOf(NetworkRequestError);
    expect(error).toMatchObject({ message: 'Request timed out' });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a successful request clears its timeout timer', async () => {
    jest.useFakeTimers();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response);

    await expect(new HanabNetworkSession().checkSession()).resolves.toEqual({ kind: 'valid' });

    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('HanabNetworkSession login', () => {
  test('sends the normal login payload without a new password', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response);

    await new HanabNetworkSession().submitLogin('user name', 'old pass');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hanab.live/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: 'username=user+name&password=old+pass&version=bot',
      }),
    );
  });

  test('adds newPassword only for an explicit password change', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response);

    await new HanabNetworkSession().submitLogin('user', 'old password', 'new password');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hanab.live/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: 'username=user&password=old+password&version=bot&newPassword=new+password',
      }),
    );
  });
});

describe('HanabNetworkSession logout', () => {
  test('uses credentialed GET and allows the caller to verify the missing session', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    const session = new HanabNetworkSession();

    await session.logout();
    await expect(session.checkSession()).resolves.toEqual({ kind: 'missing' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://hanab.live/logout',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://hanab.live/test-cookie',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });
});

describe('HanabNetworkSession tag discovery', () => {
  const validItem = {
    id: 1, options: { numPlayers: 2, startingPlayer: 0, variantID: 0, variantName: 'No Variant',
      timed: false, timeBase: 0, timePerTurn: 0, speedrun: false, cardCycle: false, deckPlays: false,
      emptyClues: false, oneExtraCard: false, oneLessCard: false, allOrNothing: false,
      detrimentalCharacters: false },
    seed: 's', score: 1, numTurns: 1, endCondition: 1, datetimeStarted: 'start', datetimeFinished: 'end',
    numGamesOnThisSeed: 1, playerNames: ['Ada'], incrementNumGames: true, tags: 'a,b',
  };

  test('sends encoded authenticated GET paths and validates schema', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: async () => [validItem],
    } as Response);
    const session = new HanabNetworkSession();
    await expect(session.fetchTaggedGames('A/B')).resolves.toEqual([validItem]);
    await expect(session.searchTag('tag / ?')).resolves.toEqual([validItem]);
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://hanab.live/api/v1/tags/A%2FB',
      expect.objectContaining({ method: 'GET', credentials: 'include' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://hanab.live/api/v1/tag/tag%20%2F%20%3F',
      expect.objectContaining({ method: 'GET', credentials: 'include' }));
  });

  test('rejects HTTP and malformed response failures', async () => {
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ tags: 7 }] } as Response);
    const session = new HanabNetworkSession();
    await expect(session.fetchTaggedGames('Ada')).rejects.toMatchObject({ detail: { kind: 'http', status: 404 } });
    await expect(session.searchTag('x')).rejects.toMatchObject({ message: 'Invalid game history response' });
  });
});
