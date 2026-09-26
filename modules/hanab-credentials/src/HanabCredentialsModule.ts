export type CredentialResult =
  | { kind: 'credential'; username: string; password: string }
  | { kind: 'none' | 'cancelled' | 'unavailable' | 'error' };

export type SaveCredentialResult = { kind: 'saved' | 'cancelled' | 'unavailable' | 'error' };

export type HanabCredentialsModule = {
  listRecentAccounts(): Promise<string[]>;
  rememberAccount(username: string): Promise<string[]>;
  forgetAccount(username: string): Promise<string[]>;
  getPasswordCredential(username: string): Promise<CredentialResult>;
  savePasswordCredential(username: string, password: string): Promise<SaveCredentialResult>;
};
