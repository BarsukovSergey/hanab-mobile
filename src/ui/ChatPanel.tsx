import { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';

import { chatRuntime, lobbyRuntime } from '../runtime/application';
import { parseServerTableProposal, tableProposalMatches } from '../protocol/tableProposal';
import { chatActions } from '../store/chatSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { transformChatInput } from './chatInput';
import { chatMessageMetadata } from './chatPresentation';
import { ActionButton, EmptyState, Field, Panel, SectionHeading, useHanabTheme } from './designSystem';

type Props = {
  room: string;
  title: string;
  readActive?: boolean;
  sendEnabled?: boolean;
};

const EMPTY_MESSAGES: readonly never[] = [];

export function ChatPanel({ room, title, readActive = true, sendEnabled = true }: Props) {
  const dispatch = useAppDispatch();
  const { theme } = useHanabTheme();
  const historyRef = useRef<ScrollView>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const ready = useAppSelector((state) => state.session.phase === 'ready');
  const lastPM = useAppSelector((state) => state.chat.lastPM);
  const draft = useAppSelector((state) => state.chat.draftByRoom[room] ?? '');
  const messages = useAppSelector((state) => state.chat.messagesByRoom[room] ?? EMPTY_MESSAGES);
  const pregameRoom = useAppSelector((state) => state.room.room.kind === 'pregame'
    ? state.room.room : null);
  const authenticatedUserID = useAppSelector((state) => state.session.authenticatedUser?.userID);
  const authenticatedUsername = useAppSelector(
    (state) => state.session.authenticatedUser?.username,
  );
  const pendingUpdate = useAppSelector((state) => state.room.pendingUpdate);
  const trimmed = draft.trim();
  const canSend = ready && sendEnabled && trimmed.length > 0;

  const send = () => {
    if (!canSend) return;
    dispatch(chatActions.draftSubmissionFinished({
      room,
      succeeded: chatRuntime.submit(draft),
    }));
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!readActive || !appActive || !ready) return;
    historyRef.current?.scrollToEnd({ animated: false });
  }, [appActive, messages.length, readActive, ready, room]);

  useEffect(() => {
    if (!readActive || !appActive || !ready) return;
    dispatch(chatActions.roomRead({ room }));
    if (/^table[1-9]\d*$/.test(room)) lobbyRuntime.markChatRead(room);
  }, [appActive, dispatch, messages.length, readActive, ready, room]);

  return (
    <Panel>
      <SectionHeading title={title} detail={ready ? 'Connected' : 'Chat reconnecting…'} />
      <ScrollView
        contentContainerStyle={styles.historyContent}
        nestedScrollEnabled
        ref={historyRef}
        style={[styles.history, { backgroundColor: theme.colors.surfaceMuted }]}
      >
        {messages.length === 0 && <EmptyState>No messages yet.</EmptyState>}
        {messages.map((message, index) => {
          const date = new Date(message.datetime);
          const time = Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const metadata = chatMessageMetadata(message, authenticatedUsername);
          const proposal = parseServerTableProposal({ server: message.server, msg: message.rawMsg });
          const isOwnerInThisTable = pregameRoom !== null
            && room === `table${pregameRoom.tableID}`
            && authenticatedUserID === pregameRoom.data.owner;
          const alreadyApplied = proposal !== null && pregameRoom !== null
            && tableProposalMatches(proposal, pregameRoom.data);
          const canApplyProposal = proposal !== null && isOwnerInThisTable
            && pendingUpdate === null && !alreadyApplied;
          return (
            <View key={`${message.datetime}-${index}`} style={styles.messageRow}>
              <Text style={[styles.message, { color: theme.colors.text }]}>
                <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                  {time.length > 0 ? `${time} ` : ''}{metadata} </Text>
                {message.msg}
              </Text>
              {proposal !== null && isOwnerInThisTable && (
                <ActionButton
                  compact
                  disabled={!canApplyProposal}
                  title={alreadyApplied ? 'Already applied' : 'Apply proposal'}
                  onPress={() => {
                    if (canApplyProposal) {
                      lobbyRuntime.updateTable(proposal.name, proposal.maxPlayers, proposal.options);
                    }
                  }}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
      <Field
        editable={ready && sendEnabled}
        maxLength={300}
        multiline
        onChangeText={(value) => dispatch(chatActions.draftChanged({
          room,
          draft: transformChatInput(value, lastPM),
        }))}
        onSubmitEditing={send}
        placeholder={ready ? 'Message' : 'Chat reconnecting…'}
        style={styles.input}
        returnKeyType="send"
        submitBehavior="submit"
        value={draft}
      />
      <View style={styles.footer}>
        <Text style={[styles.counter, { color: theme.colors.textMuted }]}>{draft.length}/300</Text>
        <ActionButton compact disabled={!canSend} title="Send" tone="primary" onPress={send} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  history: { borderRadius: 10, maxHeight: 260, paddingHorizontal: 10 },
  historyContent: { gap: 7, paddingVertical: 10 },
  messageRow: { gap: 6 },
  message: { fontSize: 14, lineHeight: 20 },
  meta: { fontWeight: '800' },
  input: { minHeight: 72, textAlignVertical: 'top' },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  counter: { fontSize: 11 },
});
