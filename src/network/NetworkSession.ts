import { HANAB_HTTP_BASE_URL, HANAB_WEBSOCKET_URL } from '../config/hanab';
import {
  NetworkRequestError,
  type NetworkSession,
  type NetworkSocket,
  type SessionCheckResult,
} from './types';

const HTTP_REQUEST_TIMEOUT_MS = 10_000;

async function boundedFetch(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, HTTP_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function encodeForm(fields: Readonly<Record<string, string>>): string {
  return Object.entries(fields)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%20/g, '+')}`,
    )
    .join('&');
}

function transportMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown transport failure';
}

export class HanabNetworkSession implements NetworkSession {
  async checkSession(): Promise<SessionCheckResult> {
    try {
      const response = await boundedFetch(`${HANAB_HTTP_BASE_URL}/test-cookie`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.status === 200) {
        return { kind: 'valid' };
      }
      if (response.status === 204) {
        return { kind: 'missing' };
      }
      return {
        kind: 'indeterminate',
        error: {
          kind: 'http',
          status: response.status,
          message: `Session probe returned HTTP ${response.status}`,
        },
      };
    } catch (error) {
      return {
        kind: 'indeterminate',
        error: { kind: 'transport', message: transportMessage(error) },
      };
    }
  }

  async submitLogin(username: string, password: string): Promise<void> {
    let response: Response;
    try {
      response = await boundedFetch(`${HANAB_HTTP_BASE_URL}/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encodeForm({ username, password, version: 'bot' }),
      });
    } catch (error) {
      throw new NetworkRequestError({
        kind: 'transport',
        message: transportMessage(error),
      });
    }

    if (!response.ok) {
      throw new NetworkRequestError({
        kind: 'http',
        status: response.status,
        message: `Login returned HTTP ${response.status}`,
      });
    }
  }

  async logout(): Promise<void> {
    let response: Response;
    try {
      response = await boundedFetch(`${HANAB_HTTP_BASE_URL}/logout`, {
        method: 'GET',
        credentials: 'include',
      });
    } catch (error) {
      throw new NetworkRequestError({
        kind: 'transport',
        message: transportMessage(error),
      });
    }

    if (!response.ok) {
      throw new NetworkRequestError({
        kind: 'http',
        status: response.status,
        message: `Logout returned HTTP ${response.status}`,
      });
    }
  }

  async openSocket(): Promise<NetworkSocket> {
    return new WebSocket(HANAB_WEBSOCKET_URL);
  }
}
