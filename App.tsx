import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { HANAB_HTTP_BASE_URL, HANAB_PASSWORD_RESET_URL } from './src/config/hanab';
import { createReplayExport } from './src/game/client/replayExport';
import { replayExportActions } from './src/platform/replayExportActions';
import { forgetAccount, getPasswordCredential, listRecentAccounts, rememberAccount, savePasswordCredential } from './src/platform/credentialAccounts';
import { chatRuntime, lobbyRuntime, networkSession } from './src/runtime/application';
import { lobbyActions } from './src/store/lobbySlice';
import { roomActions } from './src/store/roomSlice';
import { useAppDispatch, useAppSelector } from './src/store/hooks';
import { selectLobbyHydrated } from './src/store/store';
import { ChatPanel } from './src/ui/ChatPanel';
import {
  ActionButton,
  Field,
  HanabThemeProvider,
  Notice,
  Panel,
  ResponsiveSurfaceProvider,
  SectionHeading,
  useHanabTheme,
  useResponsiveLayout,
} from './src/ui/designSystem';
import { GameScreen } from './src/ui/game/GameScreen';
import { LastClueNotice } from './src/ui/game/LastClueNotice';
import { TerminationControls } from './src/ui/game/TerminationControls';
import { isC17WorkspaceEligible } from './src/ui/game/c17Workspace';
import {
  backBrowsing,
  createBrowsingPresentation,
  currentBrowsingSurface,
  isBrowsingSettings,
  navigateBrowsing,
  openMoreSurface,
  openBrowsingSettings,
  type BrowsingDestination,
} from './src/ui/browsingNavigationState';
import { getBrowsingBackAction } from './src/ui/navigationPolicy';
import { reconcilePresentationFocus, type PresentationFocusMemory } from './src/ui/presentationFocus';
import { HistoryScreen } from './src/ui/screens/HistoryScreen';
import { BrowsingNavigation } from './src/ui/BrowsingNavigation';
import { BrowsingAppBar } from './src/ui/BrowsingAppBar';
import { getFocusedRoomBackDecision, getRoomReturnPresentation, isOwnOngoingRewind } from './src/ui/roomReturnPresentation';
import { LobbyScreen } from './src/ui/screens/LobbyScreen';
import { CreateTableScreen, type SpecificSeedCreatePrefill } from './src/ui/screens/CreateTableScreen';
import { MoreScreen } from './src/ui/screens/MoreScreen';
import { PeopleScreen } from './src/ui/screens/PeopleScreen';
import { PregameScreen } from './src/ui/screens/PregameScreen';
import { SettingsScreen } from './src/ui/screens/SettingsScreen';
import { UserContextActions } from './src/ui/UserContextActions';
import { getServerStatusNoticeMessage } from './src/ui/serverStatusNotice';

type ProbeStatus = 'checking' | 'valid' | 'missing' | 'indeterminate';
type LiveSheet = 'menu' | 'chat' | 'settings' | 'tag' | 'replay-export' | null;

export default function App() {
  return (
    <SafeAreaProvider>
      <ResponsiveSurfaceProvider>
        <HanabThemeProvider>
          <AppContent />
        </HanabThemeProvider>
      </ResponsiveSurfaceProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const dispatch = useAppDispatch();
  const { theme } = useHanabTheme();
  const { contentMaxWidth, width, height, windowClass } = useResponsiveLayout();
  const landscapePhone = width > height && height < 700;
  const [probe, setProbe] = useState<ProbeStatus>('checking');
  const [statusMessage, setStatusMessage] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recentAccounts, setRecentAccounts] = useState<string[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [showManualLogin, setShowManualLogin] = useState(false);
  const [browsing, setBrowsing] = useState(() => createBrowsingPresentation());
  const [passwordTaskOpen, setPasswordTaskOpen] = useState(false);
  const browsingScrollRef = useRef<ScrollView>(null);
  const navigate = (destination: BrowsingDestination) => {
    browsingScrollRef.current?.scrollTo({ y: 0, animated: browsing.destination === destination });
    setBrowsing((state) => navigateBrowsing(state, destination));
  };
  const [specificSeedCreatePrefill, setSpecificSeedCreatePrefill] = useState<SpecificSeedCreatePrefill | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const createBackRef = useRef<(() => void) | null>(null);
  const [gameLinkRequest, setGameLinkRequest] = useState(0);
  const closeCreateTask = useCallback(() => {
    setCreateTaskOpen(false);
    setSpecificSeedCreatePrefill(null);
  }, []);
  const [liveSheet, setLiveSheet] = useState<LiveSheet>(null);
  const settingsBackRef = useRef<(() => void) | null>(null);
  const historyBackRef = useRef<(() => void) | null>(null);
  const pregameBackRef = useRef<(() => void) | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [exportFeedback, setExportFeedback] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);
  const session = useAppSelector((state) => state.session);
  const hydrated = useAppSelector(selectLobbyHydrated);
  const lobbyNotice = useAppSelector((state) => state.lobby.notice);
  const roomState = useAppSelector((state) => state.room);
  const browsingRoomOccupied =
    roomState.room.kind !== 'none'
    || roomState.pendingRecovery !== null
    || roomState.rematchTransition !== null;
  const [presentationFocus, setPresentationFocus] = useState<'room' | 'browsing'>('browsing');
  const presentationFocusMemory = useRef<PresentationFocusMemory>({
    previousConnectionEpoch: session.connectionEpoch,
    previousRoomKind: 'none',
    preserveNextRoomEntry: false,
  });
  const stableNoOwnedRoom =
    session.phase === 'ready'
    && hydrated
    && roomState.room.kind === 'none'
    && roomState.pendingRecovery === null
    && roomState.rematchTransition === null;
  const recoveringRoom = roomState.pendingRecovery !== null || (
    session.phase !== 'ready'
    && (roomState.room.kind !== 'none'
      || presentationFocusMemory.current.preserveNextRoomEntry
      || (presentationFocusMemory.current.previousRoomKind !== 'none'
        && presentationFocusMemory.current.previousConnectionEpoch !== session.connectionEpoch))
  );
  const returnPresentation = getRoomReturnPresentation(roomState.room, recoveringRoom);
  const browseFromRoom = () => {
    setPresentationFocus('browsing');
  };
  const homeFromLive = () => {
    setBrowsing((state) => navigateBrowsing(state, 'home'));
    setPresentationFocus('browsing');
  };
  const exitOwnRewind = () => {
    if (!isOwnOngoingRewind(roomState.room) || roomState.room.kind !== 'live_game') return;
    dispatch(roomActions.reviewSegmentSelected({
      tableID: roomState.room.tableID,
      gameLoadEpoch: roomState.room.gameLoadEpoch,
      segment: null,
    }));
  };
  const returnToRoom = () => {
    if (returnPresentation === null) return;
    if (returnPresentation.behavior === 'return-live') exitOwnRewind();
    setPresentationFocus('room');
  };
  const backFromBrowsing = () => {
    if (browsing.destination === 'history' && currentBrowsingSurface(browsing).kind === 'root'
      && historyBackRef.current !== null) {
      historyBackRef.current();
      return;
    }
    setBrowsing((state) => backBrowsing(state));
  };
  useLayoutEffect(() => {
    const result = reconcilePresentationFocus(presentationFocus, presentationFocusMemory.current, {
      connectionEpoch: session.connectionEpoch,
      roomKind: roomState.room.kind,
      roomMigrationPending: roomState.rematchTransition !== null,
      stableNoOwnedRoom,
    });
    presentationFocusMemory.current = result.memory;
    if (result.focus !== presentationFocus) setPresentationFocus(result.focus);
    if (result.enteredRoom) closeCreateTask();
  }, [closeCreateTask, presentationFocus, roomState.room.kind, roomState.rematchTransition,
    session.connectionEpoch, stableNoOwnedRoom]);
  const liveChatUnreadCount = useAppSelector((state) => state.room.room.kind === 'live_game'
    ? state.chat.unreadByRoom[`table${state.room.room.tableID}`] ?? 0
    : 0);
  const serverStatusMessage = session.authenticatedUser === null
    ? null : getServerStatusNoticeMessage(session.serverStatus);

  const runProbe = useCallback(async () => {
    setProbe('checking');
    setStatusMessage('');
    const result = await lobbyRuntime.checkSession();
    if (result.kind === 'valid') {
      setProbe('valid');
      void lobbyRuntime.connect();
    } else if (result.kind === 'missing') {
      setProbe('missing');
    } else {
      setProbe('indeterminate');
      setStatusMessage(result.error.message);
    }
  }, []);

  useEffect(() => { void runProbe(); }, [runProbe]);

  useEffect(() => {
    let active = true;
    void listRecentAccounts().then((accounts) => {
      if (!active) return;
      setRecentAccounts(accounts);
      setShowManualLogin(accounts.length === 0);
      setAccountsLoaded(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    lobbyRuntime.setAppActive(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      lobbyRuntime.setAppActive(state === 'active');
    });
    return () => {
      subscription.remove();
      lobbyRuntime.disconnect();
    };
  }, []);

  useEffect(() => {
    if (roomState.room.kind !== 'live_game') setLiveSheet(null);
  }, [roomState.room.kind]);

  useEffect(() => {
    if (presentationFocus !== 'room') setLiveSheet(null);
  }, [presentationFocus]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const authenticated = probe === 'valid' && session.phase === 'ready' && hydrated;
      if (presentationFocus === 'browsing') {
        if (isBrowsingSettings(browsing)) {
          settingsBackRef.current?.();
          return true;
        }
        if (createTaskOpen) {
          createBackRef.current?.();
          return true;
        }
        if (getBrowsingBackAction(browsing, authenticated) === 'back') {
          backFromBrowsing();
          return true;
        }
        return false;
      }
      if (liveSheet === 'settings') {
        settingsBackRef.current?.();
        return true;
      }
      if (liveSheet !== null) {
        setLiveSheet(null);
        return true;
      }
      if (roomState.room.kind === 'pregame') {
        pregameBackRef.current?.();
        return true;
      }
      if (roomState.room.kind === 'live_game') {
        const decision = getFocusedRoomBackDecision(roomState.room);
        if (decision === 'return-live') exitOwnRewind();
        if (decision === 'browse-origin') setPresentationFocus('browsing');
      }
      return true;
    });
    return () => subscription.remove();
  }, [
    browsing, createTaskOpen, hydrated, liveSheet, presentationFocus, probe,
    roomState.room, session.phase,
  ]);

  const openPasswordReset = async () => {
    try {
      await Linking.openURL(HANAB_PASSWORD_RESET_URL);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not open the password reset page.');
    }
  };

  const submitCredentials = async (loginUsername: string, loginPassword: string, offerCredentialSave: boolean) => {
    setLoginPending(true);
    setStatusMessage('');
    try {
      await networkSession.submitLogin(loginUsername, loginPassword);
      setPassword('');
      const result = await lobbyRuntime.checkSession();
      if (result.kind === 'valid') {
        if (offerCredentialSave) {
          const accounts = await rememberAccount(loginUsername);
          if (accounts.length > 0) setRecentAccounts(accounts);
          await savePasswordCredential(loginUsername, loginPassword);
        }
        setProbe('valid');
        setBrowsing(createBrowsingPresentation('home'));
        void lobbyRuntime.connect();
      } else {
        setProbe(result.kind === 'missing' ? 'missing' : 'indeterminate');
        setShowManualLogin(true);
        setStatusMessage(result.kind === 'indeterminate'
          ? result.error.message
          : 'Login was not accepted. Check your username and password.');
      }
    } catch (error) {
      setPassword('');
      setShowManualLogin(true);
      setStatusMessage(error instanceof Error ? error.message : 'Login request failed');
    } finally {
      setLoginPending(false);
    }
  };

  const submitManualLogin = () => submitCredentials(username, password, true);

  const chooseRecentAccount = async (account: string) => {
    setUsername(account);
    setPassword('');
    setStatusMessage('');
    setLoginPending(true);
    const result = await getPasswordCredential(account);
    if (result.kind === 'credential') {
      await submitCredentials(result.username, result.password, false);
      return;
    }
    setLoginPending(false);
    setShowManualLogin(true);
  };

  const signOut = async () => {
    setSignOutPending(true);
    setStatusMessage('');
    const result = await lobbyRuntime.signOut();
    if (result.kind === 'signedOut') {
      setProbe('missing');
      setBrowsing(createBrowsingPresentation('home'));
      setPresentationFocus('browsing');
      presentationFocusMemory.current = {
        previousConnectionEpoch: session.connectionEpoch,
        previousRoomKind: 'none',
        preserveNextRoomEntry: false,
      };
      setLiveSheet(null);
      setUsername('');
      setPassword('');
      setShowManualLogin(recentAccounts.length === 0);
    } else {
      setProbe(result.sessionValid ? 'valid' : 'indeterminate');
      setStatusMessage(result.message);
    }
    setSignOutPending(false);
  };

  if (signOutPending) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Panel style={styles.centerCard}>
          <SectionHeading title="Signing out…" detail="Closing the realtime session and clearing local game data." />
        </Panel>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
      </View>
    );
  }

  let focusedRoomPresentation: ReactNode = null;
  const roomPresentationVisible =
    ((probe === 'valid' && roomState.room.kind === 'live_game') || roomState.room.kind === 'pregame')
    && presentationFocus === 'room';
  if (probe === 'valid' && roomState.room.kind === 'live_game') {
    const liveTableID = roomState.room.tableID;
    const authenticatedUsername = session.authenticatedUser?.username;
    const renderLiveUser = (name: string, key: string) => {
      const isAuthenticatedUser = authenticatedUsername !== undefined
        && name.toLocaleLowerCase() === authenticatedUsername.toLocaleLowerCase();
      const isFriend = session.friends.some((friend) => friend.toLocaleLowerCase() === name.toLocaleLowerCase());
      return (
        <View key={key} style={styles.liveUserRow}>
          <Text style={{ color: theme.colors.text }}>{name}</Text>
          {!isAuthenticatedUser && (
            <UserContextActions username={name} isFriend={isFriend} room={`table${liveTableID}`} />
          )}
        </View>
      );
    };
    const liveClientState = roomState.room.clientState;
    const perspectiveEligible = roomState.room.role === 'spectator'
      && !roomState.room.sharedReplay
      && liveClientState.replay.shared === null
      && !liveClientState.finished
      && liveClientState.replay.databaseID === null
      && liveClientState.ongoingGame.turn.currentPlayerIndex !== null;
    const currentPerspective = liveClientState.shadowing
      ? liveClientState.metadata.ourPlayerIndex : -1;
    const liveConnectionProblem = session.phase === 'failed' || session.phase === 'closed';
    const pauseEligible = session.phase === 'ready'
      && roomState.room.role === 'player'
      && !roomState.room.sharedReplay
      && !liveClientState.finished
      && !liveClientState.replay.active
      && liveClientState.ongoingGame.turn.currentPlayerIndex !== null
      && liveClientState.metadata.options.timed;
    const pauseLabel = liveClientState.pause.active
      ? 'Unpause'
      : liveClientState.ongoingGame.turn.currentPlayerIndex === liveClientState.metadata.ourPlayerIndex
        ? 'Pause'
        : liveClientState.pause.queued ? 'Cancel queued pause' : 'Queue pause';
    const c17Workspace = isC17WorkspaceEligible({
      isLiveParticipant: true,
      playerCount: roomState.room.clientState.metadata.playerNames.length,
      portrait: true,
      finished: roomState.room.clientState.finished,
      replayActive: roomState.room.clientState.replay.active,
      sharedReplay: roomState.room.sharedReplay,
    });
    const gameRootScrollable = !c17Workspace;
    focusedRoomPresentation = (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.flex, { backgroundColor: theme.colors.background }]}
      >
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        <View style={[
          styles.gameBar,
          landscapePhone && styles.gameBarLandscape,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}>
          <View style={[styles.headerActions, styles.flex, landscapePhone && styles.headerActionsLandscape]}>
            <ActionButton compact title="Home" tone="secondary" style={styles.liveHeaderAction} onPress={homeFromLive} />
            <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.gameIdentity, styles.flex, { color: theme.colors.text }]}>{liveClientState.metadata.options.variantName}</Text>
            <ActionButton
              compact
              title={liveChatUnreadCount === 0 ? 'Chat' : `Chat (${liveChatUnreadCount})`}
              tone="secondary"
              style={styles.liveHeaderAction}
              onPress={() => setLiveSheet('chat')}
            />
            <ActionButton compact title="Menu" tone="secondary" style={styles.liveHeaderAction} onPress={() => setLiveSheet('menu')} />
          </View>
        </View>
        {liveConnectionProblem && (
          <View style={styles.liveConnectionNotice}>
            <Notice tone="error">{session.error ?? 'Connection lost. Game actions are disabled until the realtime session reconnects.'}</Notice>
            <ActionButton compact title="Reconnect" tone="primary" onPress={() => void lobbyRuntime.connect()} />
          </View>
        )}
        {serverStatusMessage !== null && (
          <View style={styles.liveConnectionNotice}>
            <Notice>{serverStatusMessage}</Notice>
          </View>
        )}
        <SafeAreaView edges={['bottom']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
          styles.gameContainer,
          landscapePhone && styles.gameContainerLandscape,
          c17Workspace && styles.gameContainerC17,
          { maxWidth: contentMaxWidth },
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={gameRootScrollable}
        >
          {!c17Workspace && <LastClueNotice />}
          <View style={c17Workspace ? [styles.gameWorkspace, styles.gameWorkspaceC17] : undefined}>
            <GameScreen presentationVisible={roomPresentationVisible} />
          </View>
        </ScrollView>
        </SafeAreaView>
        <Modal animationType="fade" onRequestClose={() => {
          if (liveSheet === 'settings') settingsBackRef.current?.();
          else setLiveSheet(null);
        }} statusBarTranslucent transparent visible={roomPresentationVisible && liveSheet !== null}>
          <Pressable onPress={() => {
            if (liveSheet === 'settings') settingsBackRef.current?.();
            else setLiveSheet(null);
          }} style={styles.sheetBackdrop}>
            <Pressable onPress={(event) => event.stopPropagation()} style={[styles.sheet, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
              {liveSheet === 'menu'
                ? <>
                  <SectionHeading title="Game menu" detail="Secondary controls stay off the gameplay surface." />
                  <ScrollView style={styles.menuScroll} contentContainerStyle={styles.menuActions}>
                    <ActionButton title="Add tag" onPress={() => {
                      setTagDraft('');
                      setLiveSheet('tag');
                    }} />
                    <ActionButton title="Show tags" onPress={() => chatRuntime.submit('/tags')} />
                    {liveClientState.finished && <ActionButton title="Export replay" onPress={() => {
                      setExportFeedback(null);
                      setLiveSheet('replay-export');
                    }} />}
                    <SectionHeading title={`Players (${liveClientState.metadata.playerNames.length})`} />
                    {liveClientState.metadata.playerNames.map((name, index) => renderLiveUser(name, `player-${index}-${name}`))}
                    <SectionHeading
                      title={`Spectators (${liveClientState.spectators.length})`}
                    />
                    {liveClientState.spectators.length === 0
                      ? <Text style={{ color: theme.colors.textMuted }}>No spectators</Text>
                      : liveClientState.spectators.map((spectator, index) => renderLiveUser(spectator.name, `spectator-${index}-${spectator.name}`))}
                    {perspectiveEligible && <>
                      <SectionHeading
                        title="Perspective"
                        detail={currentPerspective === -1
                          ? 'All hands'
                          : `Viewing as ${liveClientState.metadata.playerNames[currentPerspective]}`}
                      />
                      <View style={styles.perspectiveChoices}>
                        {[-1, ...liveClientState.metadata.playerNames.map((_, index) => index)].map((index) => (
                          <ActionButton
                            key={index}
                            compact
                            disabled={index === currentPerspective}
                            tone={index === currentPerspective ? 'primary' : 'secondary'}
                            title={index === -1 ? 'All hands' : liveClientState.metadata.playerNames[index] ?? ''}
                            onPress={() => {
                              if (lobbyRuntime.setSpectatorPerspective(index)) setLiveSheet(null);
                            }}
                          />
                        ))}
                      </View>
                    </>}
                    <ActionButton
                      disabled={roomState.pendingUnattendTableID !== null}
                      title={roomState.pendingUnattendTableID === null ? 'Lobby' : 'Leaving...'}
                      onPress={() => {
                        setLiveSheet(null);
                        lobbyRuntime.unattendLiveGame(liveTableID);
                      }}
                    />
                    {pauseEligible && <ActionButton title={pauseLabel} onPress={() => lobbyRuntime.pauseGame()} />}
                    <TerminationControls />
                    <ActionButton title="Settings" onPress={() => setLiveSheet('settings')} />
                  </ScrollView>
                  <ActionButton title="Close" tone="ghost" onPress={() => setLiveSheet(null)} />
                </>
                : liveSheet === 'chat'
                  ? <>
                    <ChatPanel room={`table${liveTableID}`} title="Table chat" readActive={roomPresentationVisible && liveSheet === 'chat'} />
                    <ActionButton title="Back" onPress={() => setLiveSheet(null)} />
                  </>
                  : liveSheet === 'settings'
                    ? <SettingsScreen onBack={() => setLiveSheet('menu')} onSignOut={() => void signOut()}
                        backRef={settingsBackRef} />
                    : liveSheet === 'replay-export'
                      ? <>
                        <SectionHeading title="Export replay" detail="Copy or share this finished replay." />
                        {exportFeedback !== null && <Notice tone={exportFeedback.tone}>{exportFeedback.message}</Notice>}
                        <ActionButton title="Copy link" onPress={() => {
                          const result = createReplayExport(liveClientState, HANAB_HTTP_BASE_URL);
                          if (!result.ok) { setExportFeedback({ message: result.error, tone: 'error' }); return; }
                          void replayExportActions.copy(result.url).then(() => setExportFeedback({ message: 'Replay link copied.', tone: 'success' })).catch(() => setExportFeedback({ message: 'Could not copy replay link.', tone: 'error' }));
                        }} />
                        <ActionButton title="Share link" onPress={() => {
                          const result = createReplayExport(liveClientState, HANAB_HTTP_BASE_URL);
                          if (!result.ok) { setExportFeedback({ message: result.error, tone: 'error' }); return; }
                          void replayExportActions.share(result.url).then(() => setExportFeedback({ message: 'Share sheet opened.', tone: 'success' })).catch(() => setExportFeedback({ message: 'Could not share replay link.', tone: 'error' }));
                        }} />
                        <ActionButton title="Copy JSON" onPress={() => {
                          const result = createReplayExport(liveClientState, HANAB_HTTP_BASE_URL);
                          if (!result.ok) { setExportFeedback({ message: result.error, tone: 'error' }); return; }
                          void replayExportActions.copy(result.json).then(() => setExportFeedback({ message: 'Replay JSON copied.', tone: 'success' })).catch(() => setExportFeedback({ message: 'Could not copy replay JSON.', tone: 'error' }));
                        }} />
                        <ActionButton title="Back" onPress={() => setLiveSheet('menu')} />
                      </>
                    : liveSheet === 'tag'
                      ? <>
                        <SectionHeading title="Add tag" detail="Tags are attached to this game." />
                        <Field autoCapitalize="none" autoCorrect={false} onChangeText={setTagDraft}
                          onSubmitEditing={() => {
                            if (tagDraft.trim() !== '' && chatRuntime.submit(`/tag ${tagDraft.trim()}`)) {
                              setTagDraft('');
                              setLiveSheet(null);
                            }
                          }}
                          placeholder="Tag" returnKeyType="send" value={tagDraft} />
                        <ActionButton
                          disabled={tagDraft.trim() === ''}
                          title="Add tag"
                          tone="primary"
                          onPress={() => {
                            if (chatRuntime.submit(`/tag ${tagDraft.trim()}`)) {
                              setTagDraft('');
                              setLiveSheet(null);
                            }
                          }}
                        />
                        <ActionButton title="Back" onPress={() => setLiveSheet('menu')} />
                      </>
                    : null}
            </Pressable>
          </Pressable>
        </Modal>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  if (roomState.room.kind === 'pregame') {
    const pregameReady = session.phase === 'ready' && hydrated;
    const pregameConnectionStatus = probe === 'indeterminate'
      ? <Panel><SectionHeading title="Unable to check session" detail="The server could not confirm your current session." />
        <Notice tone="error">{statusMessage || 'Network request failed.'}</Notice>
        <ActionButton title="Retry" tone="primary" onPress={() => void runProbe()} /></Panel>
      : session.phase === 'failed' || session.phase === 'closed'
        ? <Panel><SectionHeading title="Connection lost" detail="Reconnect to continue using the table." />
          {session.error !== null && <Notice tone="error">{session.error}</Notice>}
          <ActionButton title="Retry" tone="primary" onPress={() => { lobbyRuntime.disconnect(); void runProbe(); }} /></Panel>
        : probe === 'missing'
          ? <Panel><SectionHeading title="Session unavailable" detail="Reconnect to continue using the table." />
            <ActionButton title="Retry" tone="primary" onPress={() => void runProbe()} /></Panel>
          : probe === 'checking'
            ? <Panel><SectionHeading title="Checking session…" detail="Looking for an existing hanab.live session." /></Panel>
            : <Panel><SectionHeading title="Connecting to lobby…" detail="Synchronizing tables and chat." /></Panel>;
    focusedRoomPresentation = <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.flex}>
        <View style={styles.focusedRoomShell}>
          {serverStatusMessage !== null && <Notice>{serverStatusMessage}</Notice>}
          {pregameReady ? <PregameScreen backRef={pregameBackRef} onBrowse={browseFromRoom} presentationVisible={roomPresentationVisible} /> : pregameConnectionStatus}
        </View>
        {lobbyNotice !== null && <View pointerEvents="box-none" style={styles.lobbyNoticeOverlay}>
          <View style={[styles.lobbyNoticeContainer, { maxWidth: contentMaxWidth }]}>
            <Notice tone={lobbyNotice.kind === 'error' ? 'error' : 'neutral'}>{lobbyNotice.message}</Notice>
            <ActionButton compact title="Dismiss" tone="ghost" onPress={() => dispatch(lobbyActions.noticeDismissed())} />
          </View>
        </View>}
      </SafeAreaView>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </KeyboardAvoidingView>;
  }

  let content: ReactNode;
  if (presentationFocus === 'room' && focusedRoomPresentation === null && roomState.pendingRecovery !== null) {
    content = <Panel><SectionHeading title="Reconnecting…" detail="Recovering the current room." /></Panel>;
  } else if (presentationFocus === 'room' && focusedRoomPresentation === null && roomState.room.kind === 'awaiting_game_bootstrap') {
    content = <Panel><SectionHeading title="Loading game…" detail="Receiving the authoritative game state." /></Panel>;
  } else if (presentationFocus === 'room' && focusedRoomPresentation === null && roomState.rematchTransition !== null) {
    content = <Panel><SectionHeading title="Starting rematch…" detail="Waiting for the new authoritative room state." /></Panel>;
  } else if (probe === 'checking') {
    content = <Panel><SectionHeading title="Checking session…" detail="Looking for an existing hanab.live session." /></Panel>;
  } else if (probe === 'missing') {
    content = (
      <Panel style={styles.loginCard}>
        <View style={styles.loginIntro}>
          <Text style={[styles.loginEyebrow, { color: theme.colors.accent }]}>HANAB</Text>
          <Text style={[styles.loginTitle, { color: theme.colors.text }]}>Sign in or create account</Text>
          <Text style={[styles.loginDetail, { color: theme.colors.textMuted }]}>Use an existing hanab.live username, or enter a new username to create an account automatically.</Text>
        </View>
        {statusMessage.length > 0 && <Notice tone="error">{statusMessage}</Notice>}
        {!accountsLoaded ? <SectionHeading title="Loading accounts…" /> : recentAccounts.length > 0 && !showManualLogin ? <>
          <SectionHeading title="Choose account" />
          {recentAccounts.map((account) => <View key={account} style={styles.accountChoice}>
            <ActionButton disabled={loginPending} title={account} onPress={() => void chooseRecentAccount(account)} style={styles.accountName} />
            <ActionButton compact disabled={loginPending} title="Forget" onPress={() => {
              void forgetAccount(account).then((accounts) => {
                setRecentAccounts(accounts);
                if (accounts.length === 0) setShowManualLogin(true);
              });
            }} />
          </View>)}
          <ActionButton disabled={loginPending} title="Use another account" onPress={() => {
            setUsername(''); setPassword(''); setStatusMessage(''); setShowManualLogin(true);
          }} />
        </> : <>
        <Notice>Use a new, unique password for hanab.live. Do not reuse one of your existing or previous passwords.</Notice>
        <Field autoCapitalize="none" autoCorrect={false} onChangeText={setUsername} placeholder="Username" value={username} />
        <Field autoCapitalize="none" autoCorrect={false} onChangeText={setPassword} placeholder="Password" secureTextEntry value={password} />
        <ActionButton disabled={loginPending || username.trim().length === 0 || password.length === 0}
          title={loginPending ? 'Logging in…' : 'Login'} tone="primary" onPress={() => void submitManualLogin()} />
        <ActionButton title="Forgot password?" tone="ghost" onPress={() => void openPasswordReset()} />
        {recentAccounts.length > 0 && <ActionButton title="Back to accounts" tone="ghost" onPress={() => {
          setUsername(''); setPassword(''); setStatusMessage(''); setShowManualLogin(false);
        }} />}
        </>}
      </Panel>
    );
  } else if (probe === 'indeterminate') {
    content = <Panel><SectionHeading title="Unable to check session" detail="The server could not confirm your current session." />
      <Notice tone="error">{statusMessage || 'Network request failed.'}</Notice>
      <ActionButton title="Retry" tone="primary" onPress={() => void runProbe()} /></Panel>;
  } else if (session.phase === 'failed' || session.phase === 'closed') {
    content = <Panel><SectionHeading title="Connection lost" detail="Reconnect to continue using the lobby." />
      {session.error !== null && <Notice tone="error">{session.error}</Notice>}
      <ActionButton title="Retry" tone="primary" onPress={() => { lobbyRuntime.disconnect(); void runProbe(); }} /></Panel>;
  } else if (session.phase !== 'ready' || !hydrated) {
    content = <Panel><SectionHeading title="Connecting to lobby…" detail="Synchronizing tables and chat." /></Panel>;
  } else if (browsing.destination === 'history' && !isBrowsingSettings(browsing)) {
    content = <HistoryScreen roomOccupied={browsingRoomOccupied} showEmbeddedBack={false}
      backRef={historyBackRef} onBack={() => navigate('home')}
      onPlaySeed={(prefill) => {
        setSpecificSeedCreatePrefill(prefill);
        navigate('home');
        setCreateTaskOpen(true);
      }}
      onWatchReplay={(databaseID, visibility) => { lobbyRuntime.watchHistoricalGame(databaseID, visibility); }}
      onWatchJSONReplay={(gameJSON, visibility) => { lobbyRuntime.watchJSONReplay(gameJSON, visibility); }}
      onWatchReplayInput={(request) => {
        if (request.kind === 'id') {
          lobbyRuntime.watchReplayByID(request.databaseID, request.visibility);
        } else {
          lobbyRuntime.watchJSONReplay(request.gameJSON, request.visibility);
        }
      }} />;
  } else if (createTaskOpen) {
    content = <CreateTableScreen onBack={closeCreateTask} backRef={createBackRef}
      specificSeedCreatePrefill={specificSeedCreatePrefill} />;
  } else if (isBrowsingSettings(browsing)) {
    content = <SettingsScreen onBack={() => setBrowsing((state) => backBrowsing(state))} onSignOut={() => void signOut()}
      onPasswordTaskChange={setPasswordTaskOpen} backRef={settingsBackRef} showEmbeddedBack={false} />;
  } else if (browsing.destination === 'people') {
    content = <PeopleScreen onBack={() => navigate('home')} roomOccupied={browsingRoomOccupied} showEmbeddedBack={false} />;
  } else if (browsing.destination === 'more') {
    const surface = currentBrowsingSurface(browsing);
    content = <MoreScreen surface={surface.kind === 'tools' || surface.kind === 'about' ? surface.kind : 'root'}
      username={session.authenticatedUser?.username ?? ''}
      showEmbeddedBack={false}
      onBack={() => setBrowsing((state) => backBrowsing(state))}
      onSettings={() => setBrowsing((state) => openBrowsingSettings(state))}
      onTools={() => setBrowsing((state) => openMoreSurface(state, 'tools'))}
      onAbout={() => setBrowsing((state) => openMoreSurface(state, 'about'))}
      onHomeTools={() => {
        navigate('home');
        setGameLinkRequest((request) => request + 1);
      }}
      onHistoryTools={() => navigate('history')} />;
  } else {
    content = <LobbyScreen
      roomOccupied={browsingRoomOccupied}
      openGameLinkRequest={gameLinkRequest}
      onCreate={() => setCreateTaskOpen(true)}
    />;
  }

  const showBrowsingNavigation = presentationFocus === 'browsing'
    && probe === 'valid' && session.phase === 'ready' && hydrated
    && session.authenticatedUser !== null
    && !passwordTaskOpen && !createTaskOpen;
  const railNavigation = showBrowsingNavigation && windowClass !== 'compact';
  const browsingSurface = currentBrowsingSurface(browsing);
  const browsingTitle = browsingSurface.kind === 'root'
    ? { home: 'Home', history: 'History', people: 'People', more: 'More' }[browsingSurface.destination]
    : { settings: 'Settings', tools: 'Tools', about: 'About' }[browsingSurface.kind];
  const browsingAuthenticated = probe === 'valid' && session.phase === 'ready' && hydrated;
  const showBrowsingAppBar =
    presentationFocus === 'browsing'
    && (probe === 'valid' || returnPresentation !== null);
  const appBarBack = isBrowsingSettings(browsing)
    ? () => settingsBackRef.current?.()
    : createTaskOpen ? () => createBackRef.current?.()
      : getBrowsingBackAction(browsing, browsingAuthenticated) === 'back'
        ? backFromBrowsing : undefined;

  const browsingPresentation = (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      {/* Browsing owns system insets here; descendants use the measured available window. */}
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.flex}>
      <View style={styles.browsingBody}>
      {railNavigation && <BrowsingNavigation destination={browsing.destination} onNavigate={navigate} />}
      <View style={styles.browsingMain}>
      {showBrowsingAppBar && <BrowsingAppBar title={browsingTitle} username={session.authenticatedUser?.username ?? null}
        onBack={appBarBack} returnPresentation={returnPresentation} onReturn={returnToRoom} />}
      <ScrollView ref={browsingScrollRef} style={styles.flex} contentContainerStyle={[styles.container, { maxWidth: contentMaxWidth }]} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        {probe === 'valid' && serverStatusMessage !== null && <Notice>{serverStatusMessage}</Notice>}
        {content}
      </ScrollView>
      </View>
      </View>
      {showBrowsingNavigation && !railNavigation && <BrowsingNavigation destination={browsing.destination} onNavigate={navigate} />}
      {lobbyNotice !== null && (
        <View pointerEvents="box-none" style={styles.lobbyNoticeOverlay}>
            <View style={[styles.lobbyNoticeContainer, { maxWidth: contentMaxWidth }]}>
              <Notice tone={lobbyNotice.kind === 'error' ? 'error' : 'neutral'}>{lobbyNotice.message}</Notice>
              <ActionButton compact title="Dismiss" tone="ghost" onPress={() => dispatch(lobbyActions.noticeDismissed())} />
            </View>
        </View>
      )}
      </SafeAreaView>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </KeyboardAvoidingView>
  );

  return <>
    {focusedRoomPresentation !== null && <View
      style={[styles.flex, !roomPresentationVisible && { display: 'none' }]}
      pointerEvents={roomPresentationVisible ? 'auto' : 'none'}
      accessibilityElementsHidden={!roomPresentationVisible}
      importantForAccessibility={roomPresentationVisible ? 'auto' : 'no-hide-descendants'}>
      {focusedRoomPresentation}
    </View>}
    {(focusedRoomPresentation === null || presentationFocus === 'browsing') && browsingPresentation}
  </>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  browsingBody: { flex: 1, flexDirection: 'row' },
  browsingMain: { flex: 1, minWidth: 0 },
  focusedRoomShell: { flex: 1, gap: 8, maxWidth: 1280, paddingHorizontal: 12, paddingTop: 8, alignSelf: 'center', width: '100%' },
  container: { alignSelf: 'center', gap: 16, paddingBottom: 36, paddingHorizontal: 16, paddingTop: 16, width: '100%' },
  lobbyNoticeOverlay: { elevation: 10, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 10 },
  lobbyNoticeContainer: { alignSelf: 'center', gap: 4, paddingHorizontal: 16, paddingTop: 6, width: '100%' },
  gameContainer: { alignSelf: 'center', flexGrow: 1, gap: 10, paddingBottom: 18, paddingHorizontal: 10, paddingTop: 9, width: '100%' },
  gameContainerC17: { flex: 1, paddingBottom: 0 },
  gameContainerLandscape: { gap: 4, paddingBottom: 10, paddingHorizontal: 8, paddingTop: 4 },
  gameWorkspace: { alignSelf: 'center', flex: 1, paddingBottom: 10, paddingHorizontal: 10, paddingTop: 7, width: '100%' },
  gameWorkspaceC17: { paddingBottom: 0, paddingHorizontal: 0 },
  liveConnectionNotice: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingTop: 8 },
  centered: { flex: 1, justifyContent: 'center', padding: 20 },
  centerCard: { alignSelf: 'center', maxWidth: 520, width: '100%' },
  gameBar: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'space-between', paddingBottom: 7, paddingHorizontal: 10, paddingTop: 9 },
  gameBarLandscape: { minHeight: 34, paddingBottom: 3, paddingHorizontal: 8, paddingTop: 5 },
  brandCopy: { flexShrink: 1, gap: 1, minWidth: 0 },
  gameIdentity: { fontSize: 18, fontWeight: '800', minWidth: 0 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'flex-end' },
  headerActionsLandscape: { flex: 1, justifyContent: 'flex-end' },
  liveHeaderAction: { justifyContent: 'center', minHeight: 40, paddingHorizontal: 12 },
  menuActions: { gap: 7 },
  liveUserRow: { alignItems: 'flex-start', gap: 4, paddingVertical: 2 },
  menuScroll: { flexGrow: 0, flexShrink: 1 },
  perspectiveChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  loginCard: { alignSelf: 'center', maxWidth: 520, width: '100%' },
  accountChoice: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  accountName: { flex: 1 },
  loginIntro: { gap: 4, marginBottom: 4 },
  loginEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  loginTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -0.6 },
  loginDetail: { fontSize: 14, lineHeight: 20 },
  sheetBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.58)', flex: 1, justifyContent: 'center', padding: 14 },
  sheet: { borderRadius: 16, borderWidth: 1, gap: 10, maxHeight: '90%', maxWidth: 720, padding: 10, width: '100%' },
});
