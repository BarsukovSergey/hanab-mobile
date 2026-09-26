import { readFileSync } from 'node:fs';

const app = readFileSync(`${process.cwd()}/App.tsx`, 'utf8');
const settings = readFileSync(`${process.cwd()}/src/ui/screens/SettingsScreen.tsx`, 'utf8');
const wrapper = readFileSync(`${process.cwd()}/src/platform/credentialAccounts.ts`, 'utf8');
const native = readFileSync(`${process.cwd()}/modules/hanab-credentials/android/src/main/java/live/hanab/mobile/credentials/HanabCredentialsModule.kt`, 'utf8');

describe('account chooser security boundary', () => {
  test('only presents the chooser when remembered accounts exist and offers a blank manual form', () => {
    expect(app).toContain("recentAccounts.length > 0 && !showManualLogin");
    expect(app).toContain('title="Choose account"');
    expect(app).toContain('title="Use another account"');
    expect(app).toContain("setUsername(''); setPassword(''); setStatusMessage(''); setShowManualLogin(true)");
  });

  test('passes a retrieved password directly into login without assigning it to password state', () => {
    expect(app).toContain('await submitCredentials(result.username, result.password, false)');
    expect(app).not.toMatch(/setPassword\(result\.password\)/);
    expect(app).toContain("setShowManualLogin(true);");
    expect(app).toContain('const chooseRecentAccount');
  });

  test('remembers manual usernames only after authoritative validation and credential save is best-effort', () => {
    const validation = app.indexOf("if (result.kind === 'valid') {");
    const remember = app.indexOf('await rememberAccount(loginUsername)');
    expect(validation).toBeGreaterThanOrEqual(0);
    expect(remember).toBeGreaterThan(validation);
    expect(app).toContain('await savePasswordCredential(loginUsername, loginPassword)');
    expect(wrapper).toContain("catch { return { kind: 'error' }; }");
  });

  test('sign out preserves recent accounts and forgetting mutates only the username list', () => {
    const signOut = app.slice(app.indexOf('const signOut ='), app.indexOf('if (signOutPending)'));
    expect(signOut).not.toContain('forgetAccount(');
    expect(app).toContain('forgetAccount(account)');
    expect(native).toContain('val updated = recentAccounts().filterNot { it == username }');
    expect(native).not.toContain('deleteCredential');
  });

  test('password change offers the new password best-effort, then clears fields and keeps success', () => {
    const request = settings.indexOf('await networkSession.submitLogin(authenticatedUsername, currentPassword, newPassword)');
    const save = settings.indexOf('await savePasswordCredential(authenticatedUsername, newPassword)');
    const clear = settings.indexOf('clearPasswordFields();', save);
    expect(save).toBeGreaterThan(request);
    expect(clear).toBeGreaterThan(save);
    expect(settings).toContain("message: 'Password changed.'");
    expect(settings).toContain('Hanab Mobile does not store your account password.');
  });

  test('native storage contains ordered usernames only and retrieval accepts PasswordCredential only', () => {
    expect(native).toContain('preferences.edit().putString(KEY_USERNAMES, JSONArray(accounts).toString()).apply()');
    expect(native).toContain('const val KEY_USERNAMES = "recent_usernames"');
    expect(native).toContain('GetPasswordOption(allowedUserIds = setOf(username), isAutoSelectAllowed = true)');
    expect(native).toContain('credential is PasswordCredential');
    expect(native).toContain('CreatePasswordRequest(username, password)');
    expect(native).toContain('GetCredentialCancellationException');
    expect(native).toContain('NoCredentialException');
    expect(native).not.toContain('Log.');
    expect(native).not.toContain('putString("password"');
  });
});

function loadCredentialAccounts(platform, nativeModule) {
  jest.resetModules();
  const requireOptionalNativeModule = jest.fn(() => nativeModule);
  jest.doMock('react-native', () => ({ Platform: { OS: platform } }));
  jest.doMock('expo-modules-core', () => ({ requireOptionalNativeModule }));
  return { ...require('./credentialAccounts'), requireOptionalNativeModule };
}

describe('optional credential module', () => {
  test('keeps manual login available when Android native support is missing', async () => {
    const accounts = loadCredentialAccounts('android', null);
    expect(await accounts.listRecentAccounts()).toEqual([]);
    expect(await accounts.getPasswordCredential('test-user')).toEqual({ kind: 'unavailable' });
    expect(await accounts.savePasswordCredential('test-user', 'test-only-placeholder')).toEqual({ kind: 'unavailable' });
  });

  test('does not load the Android module on other platforms', async () => {
    const accounts = loadCredentialAccounts('ios', null);
    expect(await accounts.listRecentAccounts()).toEqual([]);
    expect(accounts.requireOptionalNativeModule).not.toHaveBeenCalled();
  });

  test('passes a selected username to native retrieval and contains save failures', async () => {
    const nativeModule = {
      getPasswordCredential: jest.fn(async (username) => ({
        kind: 'credential', username, password: 'test-only-placeholder',
      })),
      savePasswordCredential: jest.fn(async () => { throw new Error('provider unavailable'); }),
    };
    const accounts = loadCredentialAccounts('android', nativeModule);
    expect(await accounts.getPasswordCredential('test-user')).toEqual({
      kind: 'credential', username: 'test-user', password: 'test-only-placeholder',
    });
    expect(nativeModule.getPasswordCredential).toHaveBeenCalledWith('test-user');
    expect(await accounts.savePasswordCredential('test-user', 'test-only-placeholder')).toEqual({ kind: 'error' });
  });
});
