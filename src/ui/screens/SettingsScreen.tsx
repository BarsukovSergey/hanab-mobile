import { useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, Text, View } from 'react-native';

import { HANAB_PASSWORD_RESET_URL } from '../../config/hanab';
import { savePasswordCredential } from '../../platform/credentialAccounts';
import { lobbyRuntime, networkSession } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { ActionButton, Field, Notice, Panel, SectionHeading, ThemeSwitcher, useHanabTheme } from '../designSystem';
import { GameplayScenarioGallery } from '../game/scenarios/GameplayScenarioGallery';

type AccountNotice = { tone: 'error' | 'success'; message: string };

export function SettingsScreen({ onBack, onSignOut }: { onBack: () => void; onSignOut: () => void }) {
  const [scenarioGalleryOpen, setScenarioGalleryOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordPending, setPasswordPending] = useState(false);
  const [accountNotice, setAccountNotice] = useState<AccountNotice | null>(null);
  const presentation = useAppSelector((state) => state.session.cardPresentationSettings);
  const hyphenatedConventions = useAppSelector((state) => state.session.hyphenatedConventions);
  const realLifeMode = useAppSelector((state) => state.session.realLifeMode);
  const showTimerInUntimed = useAppSelector((state) => state.session.showTimerInUntimed);
  const authenticatedUsername = useAppSelector((state) => state.session.authenticatedUser?.username ?? null);
  const { theme } = useHanabTheme();

  const clearPasswordFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const submitPasswordChange = async () => {
    if (authenticatedUsername === null) {
      setAccountNotice({ tone: 'error', message: 'Your authenticated username is unavailable.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setAccountNotice({ tone: 'error', message: 'New passwords do not match.' });
      return;
    }

    setPasswordPending(true);
    setAccountNotice(null);
    try {
      await networkSession.submitLogin(authenticatedUsername, currentPassword, newPassword);
      try {
        await savePasswordCredential(authenticatedUsername, newPassword);
      } catch {
        // Credential Manager is best-effort and must not change password-change success.
      }
      clearPasswordFields();
      setChangePasswordOpen(false);
      setAccountNotice({ tone: 'success', message: 'Password changed.' });
    } catch (error) {
      clearPasswordFields();
      setAccountNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Password change failed.',
      });
    } finally {
      setPasswordPending(false);
    }
  };

  const openPasswordReset = async () => {
    try {
      await Linking.openURL(HANAB_PASSWORD_RESET_URL);
    } catch (error) {
      setAccountNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not open the password reset page.',
      });
    }
  };

  const confirmSignOut = () => {
    if (authenticatedUsername === null) return;
    Alert.alert('Sign out?', `Are you sure you want to sign out of ${authenticatedUsername}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onSignOut },
    ], { cancelable: false });
  };

  if (__DEV__ && scenarioGalleryOpen) {
    return <GameplayScenarioGallery onBack={() => setScenarioGalleryOpen(false)} />;
  }

  const passwordMismatch = confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;
  const passwordChangeDisabled = passwordPending
    || currentPassword.length === 0
    || newPassword.length === 0
    || confirmNewPassword.length === 0
    || passwordMismatch;

  return <View style={styles.screen}>
    <View style={styles.header}>
      <ActionButton compact title="Back" onPress={onBack} />
      <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings</Text>
    </View>
    <Panel>
      <SectionHeading
        title="Account"
        detail={authenticatedUsername === null ? 'Account security.' : `Signed in as ${authenticatedUsername}. Hanab Mobile does not store your account password. Saved passwords are handled by your system password manager.`}
      />
      {accountNotice !== null && <Notice tone={accountNotice.tone}>{accountNotice.message}</Notice>}
      {authenticatedUsername !== null && <ActionButton title="Sign out" tone="danger" onPress={confirmSignOut} />}
      {changePasswordOpen ? <>
        <Notice>Use a new, unique password for hanab.live. Do not reuse one of your existing or previous passwords.</Notice>
        <Field autoCapitalize="none" autoCorrect={false} onChangeText={setCurrentPassword} placeholder="Current password" secureTextEntry value={currentPassword} />
        <Field autoCapitalize="none" autoCorrect={false} onChangeText={setNewPassword} placeholder="New password" secureTextEntry value={newPassword} />
        <Field autoCapitalize="none" autoCorrect={false} onChangeText={setConfirmNewPassword} placeholder="Confirm new password" secureTextEntry value={confirmNewPassword} />
        {passwordMismatch && <Notice tone="error">New passwords do not match.</Notice>}
        <ActionButton disabled={passwordChangeDisabled} title={passwordPending ? 'Changing password…' : 'Change password'} tone="primary" onPress={() => void submitPasswordChange()} />
        <ActionButton disabled={passwordPending} title="Cancel" tone="ghost" onPress={() => {
          clearPasswordFields();
          setAccountNotice(null);
          setChangePasswordOpen(false);
        }} />
      </> : <>
        <ActionButton title="Change password" onPress={() => {
          setAccountNotice(null);
          setChangePasswordOpen(true);
        }} />
        <ActionButton title="Forgot password?" tone="ghost" onPress={() => void openPasswordReset()} />
      </>}
    </Panel>
    <Panel>
      <SectionHeading title="Appearance" detail="Choose how Hanab follows the device theme." />
      <ThemeSwitcher />
    </Panel>
    <Panel>
      <SectionHeading
        title="Card appearance"
        detail="Colorblind mode takes presentation precedence when both options are enabled."
      />
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Colorblind mode</Text>
        <Switch
          accessibilityLabel="Colorblind mode"
          accessibilityRole="switch"
          onValueChange={(enabled) => {
            lobbyRuntime.setCardPresentationSetting('colorblindMode', enabled);
          }}
          value={presentation.colorblindMode}
        />
      </View>
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Styled card numbers</Text>
        <Switch
          accessibilityLabel="Styled card numbers"
          accessibilityRole="switch"
          onValueChange={(enabled) => {
            lobbyRuntime.setCardPresentationSetting('styleNumbers', enabled);
          }}
          value={presentation.styleNumbers}
        />
      </View>
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Reverse hand direction</Text>
        <Switch
          accessibilityLabel="Reverse hand direction"
          accessibilityRole="switch"
          onValueChange={(enabled) => {
            lobbyRuntime.setCardPresentationSetting('reverseHands', enabled);
          }}
          value={presentation.reverseHands}
        />
      </View>
    </Panel>
    <Panel>
      <SectionHeading title="Gameplay presentation" />
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Show turn timers in untimed games</Text>
        <Switch
          accessibilityLabel="Show turn timers in untimed games"
          accessibilityRole="switch"
          onValueChange={(enabled) => {
            lobbyRuntime.setGameplayPresentationSetting('showTimerInUntimed', enabled);
          }}
          value={showTimerInUntimed}
        />
      </View>
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.text }]}>H-group features</Text>
        <Switch
          accessibilityLabel="H-group features"
          accessibilityRole="switch"
          onValueChange={(enabled) => {
            lobbyRuntime.setGameplayPresentationSetting('hyphenatedConventions', enabled);
          }}
          value={hyphenatedConventions}
        />
      </View>
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Real-life mode</Text>
        <Switch
          accessibilityLabel="Real-life mode"
          accessibilityRole="switch"
          onValueChange={(enabled) => {
            lobbyRuntime.setGameplayPresentationSetting('realLifeMode', enabled);
          }}
          value={realLifeMode}
        />
      </View>
    </Panel>
    {__DEV__ && <Panel>
      <SectionHeading title="Developer" detail="Render canonical gameplay states without joining a live table." />
      <ActionButton title="Gameplay scenarios" onPress={() => setScenarioGalleryOpen(true)} />
    </Panel>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'flex-start' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  settingLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  settingRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', minHeight: 44 },
});
