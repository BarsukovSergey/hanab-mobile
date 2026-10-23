import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { composeQuickNote, type QuickNoteToken } from '../../game/selectors/noteComposition';
import { useAppSelector } from '../../store/hooks';
import { ActionButton, Field, useHanabTheme, useResponsiveLayout } from '../designSystem';
import { beginNoteEdit, normalizeSubmittedNote, prependTurnToNote } from './noteEditing';
import { getNotePaneGeometry } from './notePaneGeometry';
import { getHumanTurnNumber } from './c17Temporal';

const QUICK_TOKENS: readonly { label: string; token: QuickNoteToken }[] = [
  { label: 'F', token: 'f' },
  { label: 'CM', token: 'cm' },
  { label: 'PTD', token: 'ptd' },
  { label: 'KT', token: 'kt' },
  { label: 'Fix', token: 'fix' },
  { label: '?', token: '?' },
  { label: '!', token: '!' },
];
const SHEET_CONTENT_BOTTOM_PADDING = 20;

export function NoteEditor({
  title,
  value,
  editable,
  visible,
  presentationVisible = true,
  startEditing = false,
  inlinePane = null,
  backRef,
  onChange,
  onSave,
  onClose,
}: {
  inlinePane?: { width: number; height: number } | null;
  backRef?: RefObject<(() => boolean) | null>;
  title: string;
  value: string;
  editable: boolean;
  visible: boolean;
  presentationVisible?: boolean;
  startEditing?: boolean;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const { theme } = useHanabTheme();
  const insets = useSafeAreaInsets();
  const { imeOcclusion, systemInsets } = useResponsiveLayout();
  const inline = inlinePane !== null;
  const paneGeometry = inlinePane === null ? null : getNotePaneGeometry(inlinePane, imeOcclusion, systemInsets.bottom);
  const [editing, setEditing] = useState(false);
  const [presentationReady, setPresentationReady] = useState(false);
  const [focusOnShow, setFocusOnShow] = useState(false);
  const [draft, setDraft] = useState(value);
  const lastSubmittedNote = useRef('');
  const sessionOpen = useRef(false);
  const sessionSavedValue = useRef(value);
  const gameContext = useAppSelector((state) => (
    state.room.room.kind === 'live_game'
      ? {
        variantName: state.room.room.clientState.metadata.options.variantName,
        turn: getHumanTurnNumber(state.room.room.clientState.ongoingGame.turn.turnNum),
      }
      : null
  ));

  useEffect(() => {
    if (!visible) {
      sessionOpen.current = false;
      setPresentationReady(false);
      setFocusOnShow(false);
      setEditing(false);
      return;
    }
    if (sessionOpen.current) return;

    sessionOpen.current = true;
    const shouldEdit = editable && startEditing;
    sessionSavedValue.current = value;
    const initial = shouldEdit ? beginNoteEdit(sessionSavedValue.current) : sessionSavedValue.current;
    setDraft(initial);
    onChange(initial);
    setEditing(shouldEdit);
    setFocusOnShow(shouldEdit && presentationVisible && !inline);
  }, [editable, inline, onChange, presentationVisible, startEditing, value, visible]);

  useEffect(() => {
    if (presentationVisible) return;
    setPresentationReady(false);
    setFocusOnShow(false);
  }, [presentationVisible]);

  useEffect(() => {
    if (inline) setFocusOnShow(false);
  }, [inline]);

  const setDraftValue = (next: string) => {
    setDraft(next);
    onChange(next);
  };
  const submitValue = (nextValue: string) => {
    if (!visible || !presentationVisible || !editable) return;
    const normalized = normalizeSubmittedNote(nextValue);
    lastSubmittedNote.current = normalized;
    onSave(normalized);
  };
  const submit = () => submitValue(draft);
  const change = (nextValue: string) => {
    if (nextValue.includes('\n') || nextValue.includes('\r')) {
      submitValue(nextValue.replace(/[\r\n]+/g, ''));
      return;
    }
    setDraftValue(nextValue);
  };
  const applyQuickToken = (token: QuickNoteToken) => {
    if (gameContext === null) return;
    const candidate = composeQuickNote(gameContext.variantName, normalizeSubmittedNote(draft), token);
    if (candidate !== draft) setDraftValue(candidate);
  };
  const startEdit = () => {
    const next = beginNoteEdit(sessionSavedValue.current);
    setDraft(next);
    onChange(next);
    setEditing(true);
    setFocusOnShow(!inline);
  };
  const cancelAndClose = () => {
    if (!presentationVisible) return;
    Keyboard.dismiss();
    setDraft(sessionSavedValue.current);
    onChange(sessionSavedValue.current);
    setEditing(false);
    onClose();
  };
  const autofocusReady = !inline && editable && editing && presentationReady && focusOnShow;

  useEffect(() => {
    if (!backRef || !inline || !visible || !presentationVisible) return;
    const handleBack = () => { cancelAndClose(); return true; };
    backRef.current = handleBack;
    return () => { if (backRef.current === handleBack) backRef.current = null; };
  }, [backRef, inline, visible, presentationVisible, cancelAndClose]);

  const sheet = <View style={[styles.sheet, inline && styles.inlineSheet, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
          <ScrollView
            bounces={false}
            style={inline ? styles.inlineScroll : undefined}
            contentContainerStyle={[styles.sheetContent, inline ? { padding: 10, paddingBottom: 10 } : { paddingBottom: SHEET_CONTENT_BOTTOM_PADDING + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>CARD NOTE</Text>
                <Text numberOfLines={2} style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
              </View>
              {!inline && <ActionButton compact title="Close" tone="ghost" onPress={cancelAndClose} />}
            </View>
            {inline && <Text style={[styles.quickHint, { color: theme.colors.textMuted }]}>Save or Cancel before choosing another card.</Text>}
            <Field
              autoFocus={autofocusReady}
              blurOnSubmit={editing}
              editable={editable && editing}
              enterKeyHint={editing ? 'done' : undefined}
              key={autofocusReady ? 'editing-ready' : editing ? 'editing-pending' : 'readonly'}
              maxLength={editing ? 300 : undefined}
              multiline={!editing}
              onChangeText={editable && editing ? change : undefined}
              onSubmitEditing={editable && editing ? submit : undefined}
              placeholder={editing ? 'Add a private note' : 'No saved note on this card'}
              returnKeyType={editing ? 'done' : undefined}
              style={[styles.input, !editing && styles.readOnlyInput]}
              submitBehavior={editing ? 'blurAndSubmit' : 'newline'}
              value={draft}
            />
            {editable && !editing && <View style={styles.actions}>
              <ActionButton title="Edit" tone="primary" onPress={startEdit} />
            </View>}
            {editable && editing && <>
              <View style={styles.quickActions}>
                {QUICK_TOKENS.map(({ label, token }) => <ActionButton
                  compact
                  disabled={gameContext === null}
                  key={token}
                  title={label}
                  tone="ghost"
                  onPress={() => applyQuickToken(token)}
                />)}
                <ActionButton
                  compact
                  disabled={gameContext === null}
                  title="Turn"
                  tone="ghost"
                  onPress={() => {
                    if (gameContext !== null) setDraftValue(prependTurnToNote(draft, gameContext.turn));
                  }}
                />
                <ActionButton
                  compact
                  disabled={lastSubmittedNote.current.length === 0}
                  title="Repeat"
                  tone="ghost"
                  onPress={() => setDraftValue(lastSubmittedNote.current)}
                />
              </View>
              <Text style={[styles.quickHint, { color: theme.colors.textMuted }]}>Quick actions update the draft only.</Text>
              <View style={styles.actions}>
                {!inline && <ActionButton title="Save" tone="primary" onPress={submit} />}
                <ActionButton disabled={draft.length === 0} title="Clear" onPress={() => setDraftValue('')} />
              </View>
            </>}
          </ScrollView>
          {inline && <View testID="note-editor-footer" style={styles.inlineFooter}>
            <ActionButton compact title="Cancel" onPress={cancelAndClose} />
            {editable && editing && <ActionButton compact title="Save" tone="primary" onPress={submit} />}
          </View>}
        </View>;
  if (inline) return visible && presentationVisible && paneGeometry !== null
    ? <View testID="note-editor-pane" style={[styles.inlinePane, paneGeometry]}>{sheet}</View> : null;
  return <Modal
    animationType="slide"
    onRequestClose={cancelAndClose}
    onShow={() => setPresentationReady(true)}
    statusBarTranslucent
    transparent
    visible={visible && presentationVisible}
  >
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoider}>
      <View style={styles.backdrop}>{sheet}</View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  inlinePane: { position: 'absolute', right: 0, top: 0 },
  inlineSheet: { flex: 1, minHeight: 0, borderRadius: 8 },
  inlineScroll: { flex: 1, minHeight: 0 },
  inlineFooter: { flexShrink: 0, flexDirection: 'row', gap: 8, padding: 6 },
  keyboardAvoider: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.58)', flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '100%' },
  sheetContent: { gap: 12, padding: 14, paddingBottom: SHEET_CONTENT_BOTTOM_PADDING },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 17, fontWeight: '900' },
  input: { minHeight: 44 },
  readOnlyInput: { minHeight: 88, textAlignVertical: 'top' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickHint: { fontSize: 10, lineHeight: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
