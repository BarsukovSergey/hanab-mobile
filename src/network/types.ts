export type NetworkOrHttpError = {
  kind: 'http' | 'transport';
  message: string;
  status?: number;
};

export type SessionCheckResult =
  | { kind: 'valid' }
  | { kind: 'missing' }
  | { kind: 'indeterminate'; error: NetworkOrHttpError };

export interface NetworkSocket {
  readonly readyState: number;
  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: WebSocketMessageEvent) => void): void;
  addEventListener(type: 'error', listener: () => void): void;
  addEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  removeEventListener(type: 'open', listener: () => void): void;
  removeEventListener(type: 'message', listener: (event: WebSocketMessageEvent) => void): void;
  removeEventListener(type: 'error', listener: () => void): void;
  removeEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface NetworkSession {
  checkSession(): Promise<SessionCheckResult>;
  submitLogin(username: string, password: string): Promise<void>;
  openSocket(): Promise<NetworkSocket>;
}

export class NetworkRequestError extends Error {
  readonly detail: NetworkOrHttpError;

  constructor(detail: NetworkOrHttpError) {
    super(detail.message);
    this.name = 'NetworkRequestError';
    this.detail = detail;
  }
}
