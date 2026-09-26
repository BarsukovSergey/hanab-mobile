import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { CredentialResult, HanabCredentialsModule, SaveCredentialResult } from '../../modules/hanab-credentials';

const nativeModule = Platform.OS === 'android'
  ? requireOptionalNativeModule<HanabCredentialsModule>('HanabCredentials')
  : null;

export async function listRecentAccounts(): Promise<string[]> {
  try { return nativeModule === null ? [] : await nativeModule.listRecentAccounts(); }
  catch { return []; }
}

export async function rememberAccount(username: string): Promise<string[]> {
  try { return nativeModule === null ? [] : await nativeModule.rememberAccount(username); }
  catch { return []; }
}

export async function forgetAccount(username: string): Promise<string[]> {
  try { return nativeModule === null ? [] : await nativeModule.forgetAccount(username); }
  catch { return []; }
}

export async function getPasswordCredential(username: string): Promise<CredentialResult> {
  try { return nativeModule === null ? { kind: 'unavailable' } : await nativeModule.getPasswordCredential(username); }
  catch { return { kind: 'error' }; }
}

export async function savePasswordCredential(username: string, password: string): Promise<SaveCredentialResult> {
  try { return nativeModule === null ? { kind: 'unavailable' } : await nativeModule.savePasswordCredential(username, password); }
  catch { return { kind: 'error' }; }
}
