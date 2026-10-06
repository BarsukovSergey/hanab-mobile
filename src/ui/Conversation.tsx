import { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';

import { chatRuntime } from '../runtime/application';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { sessionMessagesActions, sessionMessagesOwnedBy } from '../store/sessionMessagesSlice';
import { sessionConversation, sessionMessageDraft } from './sessionMessagesPresentation';
import { ActionButton, EmptyState, Field, Notice, useHanabTheme } from './designSystem';

export function Conversation({ username, room = 'lobby', visible }: {
  username: string;
  room?: string;
  visible: boolean;
}) {
  const dispatch = useAppDispatch();
  const { theme } = useHanabTheme();
  const session = useAppSelector((state) => state.session);
  const messages = useAppSelector((state) => state.sessionMessages);
  const authenticatedUsername = session.authenticatedUser?.username;
  const conversation = sessionConversation(messages, authenticatedUsername, username);
  const draft = sessionMessageDraft(messages, authenticatedUsername, username);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const active = visible && appActive && session.phase === 'ready'
    && messages.connectionEpoch === session.connectionEpoch
    && sessionMessagesOwnedBy(messages, authenticatedUsername);
  const transcriptRef = useRef<ScrollView>(null);
  const followEnd = useRef(true);
  const offset = useRef(0);
  const [newMessages, setNewMessages] = useState(false);
  const latestSequence = conversation?.messages.at(-1)?.sequence;
  const previousSequence = useRef(latestSequence);
  const [submission, setSubmission] = useState<boolean | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  // Transient scroll/send feedback belongs to this identity, never the next account.
  useEffect(() => {
    followEnd.current = true;
    offset.current = 0;
    previousSequence.current = latestSequence;
    setNewMessages(false);
    setSubmission(null);
  }, [messages.ownerUsername, username]);

  useEffect(() => {
    if (!active || !authenticatedUsername) return;
    dispatch(sessionMessagesActions.conversationRead({ authenticatedUsername, username }));
  }, [active, authenticatedUsername, dispatch, latestSequence, username]);

  useEffect(() => {
    // Hiding retained data during owner confirmation is not a new observation.
    if (latestSequence === undefined) return;
    if (previousSequence.current !== undefined && latestSequence > previousSequence.current && !followEnd.current) {
      setNewMessages(true);
    }
    previousSequence.current = latestSequence;
  }, [latestSequence]);

  useEffect(() => {
    if (!active) return;
    if (followEnd.current) transcriptRef.current?.scrollToEnd({ animated: false });
    else transcriptRef.current?.scrollTo({ y: offset.current, animated: false });
  }, [active]);

  const send = () => {
    if (!active || !authenticatedUsername || draft.trim().length === 0 || draft.length > 300) return;
    const succeeded = chatRuntime.sendPrivateMessage(username, draft, room);
    dispatch(sessionMessagesActions.draftSubmissionFinished({ authenticatedUsername, username, succeeded }));
    setSubmission(succeeded);
  };

  return <View style={styles.root}>
    <Text style={{ color: theme.colors.textMuted }}>This client/session</Text>
    {!active && <Notice>Conversation unavailable until the session is confirmed.</Notice>}
    {conversation?.hasReconnectGap && <Notice>Messages may be missing after reconnect. Only messages observed by this client are shown.</Notice>}
    <ScrollView ref={transcriptRef} style={styles.transcript} contentContainerStyle={styles.messages}
      keyboardShouldPersistTaps="handled" scrollEventThrottle={16}
      onLayout={() => {
        if (active && !followEnd.current) transcriptRef.current?.scrollTo({ y: offset.current, animated: false });
      }}
      onContentSizeChange={() => {
        if (active && followEnd.current) transcriptRef.current?.scrollToEnd({ animated: false });
      }}
      onScroll={({ nativeEvent }) => {
        if (!active) return;
        offset.current = nativeEvent.contentOffset.y;
        const atEnd = offset.current + nativeEvent.layoutMeasurement.height >= nativeEvent.contentSize.height - 24;
        followEnd.current = atEnd;
        if (atEnd) setNewMessages(false);
      }}>
      {!conversation?.messages.length && <EmptyState>No messages observed yet.</EmptyState>}
      {conversation?.messages.map((message) => <View key={message.sequence} style={styles.message}>
        <Text style={{ color: theme.colors.textMuted }}>{message.direction === 'outgoing' ? `To ${message.recipient}` : `From ${message.who}`} {'\u00b7'} {message.datetime}</Text>
        <Text style={{ color: theme.colors.text }}>{message.msg}</Text>
      </View>)}
    </ScrollView>
    {newMessages && <ActionButton compact title={'New \u2193'} onPress={() => {
      if (!active) return;
      followEnd.current = true;
      setNewMessages(false);
      transcriptRef.current?.scrollToEnd({ animated: false });
    }} />}
    {submission !== null && <Notice>{submission
      ? 'Send requested. Delivery is unconfirmed; the transcript updates only from observed messages.'
      : 'Send could not be confirmed. Draft retained; check the connection and recipient before sending again.'}</Notice>}
    <Field editable={active} multiline maxLength={300} placeholder={`Message ${username}`}
      style={styles.input} value={draft} onChangeText={(value) => {
        if (!active || !authenticatedUsername) return;
        setSubmission(null);
        dispatch(sessionMessagesActions.draftChanged({ authenticatedUsername, username, draft: value }));
      }} />
    <View style={styles.footer}>
      <Text style={{ color: theme.colors.textMuted }}>{draft.length}/300</Text>
      <ActionButton compact title="Send" tone="primary" disabled={!active || draft.trim().length === 0 || draft.length > 300} onPress={send} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, gap: 8, padding: 8 },
  transcript: { flex: 1, minHeight: 0 },
  messages: { gap: 10, paddingVertical: 8 },
  message: { gap: 3 },
  input: { minHeight: 40, maxHeight: 80 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
