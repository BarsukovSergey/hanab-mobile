import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { AppState, ScrollView } from 'react-native';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { chatRuntime, lobbyRuntime } from '../runtime/application';
import { chatActions } from '../store/chatSlice';
import { roomActions } from '../store/roomSlice';
import { sessionActions } from '../store/sessionSlice';
import { createAppStore, type AppStore } from '../store/store';
import { ChatPanel } from './ChatPanel';
import { ActionButton, Field } from './designSystem';

const { act, create } = require('react-test-renderer');

// Match the existing Conversation harness: real Redux state and observable native scroll refs.
jest.mock('react-redux', () => require('../../node_modules/react-redux/dist/cjs/react-redux.development.cjs'));
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react');
  return { default: React.forwardRef((props: object, ref: unknown) => React.createElement('ScrollView', { ...props, ref })) };
});
jest.mock('../runtime/application', () => ({
  chatRuntime: { submit: jest.fn() },
  lobbyRuntime: { markChatRead: jest.fn(), updateTable: jest.fn() },
}));
jest.mock('./designSystem', () => {
  const React = require('react');
  return {
    useHanabTheme: () => ({ theme: { colors: { text: 'black', textMuted: 'gray', surfaceMuted: 'white' } } }),
    useResponsiveLayout: () => ({ imeOcclusion: 0, systemInsets: { bottom: 0 } }),
    ActionButton: (props: object) => React.createElement('Button', props),
    Field: (props: object) => React.createElement('Field', props),
    EmptyState: (props: object) => React.createElement('Empty', props),
    Panel: (props: object) => React.createElement('Panel', props),
  };
});

describe('chat composer keyboard submission', () => {
  test('uses an explicit send key and submit behavior for the multiline input', () => {
    const source = readFileSync(join(__dirname, 'ChatPanel.tsx'), 'utf8');
    const input = source.match(/<Field([\s\S]*?)\/>/)?.[1] ?? '';

    expect(input).toMatch(/multiline\b/);
    expect(input).toMatch(/returnKeyType="send"/);
    expect(input).toMatch(/submitBehavior="submit"/);
    expect(input).toMatch(/onSubmitEditing=\{send\}/);
    expect(source).toMatch(/onPress=\{send\}/);
    expect(input).not.toMatch(/submitBehavior="newline"/);
  });
});

describe('table chat read contract', () => {
  test('reads only when presented, foreground, and session ready', () => {
    const source = readFileSync(join(__dirname, 'ChatPanel.tsx'), 'utf8');
    const effect = source.match(/useEffect\(\(\) => \{\s*if \(!readActive \|\| !appActive \|\| !ready \|\| !atEnd\) return;\s*dispatch\(chatActions\.roomRead\([\s\S]*?\n  \}, \[appActive, atEnd, dispatch, messages, readActive, ready, room\]\);/)?.[0] ?? '';
    expect(source).toContain("useState(AppState.currentState === 'active')");
    expect(source).toContain("AppState.addEventListener('change', (state) => setAppActive(state === 'active'))");
    expect(source).toContain('readActive = true');
    expect(source).toMatch(/if \(!readActive \|\| !appActive \|\| !ready \|\| !atEnd\) return;\s*historyRef\.current\?\.scrollToEnd/);
    expect(effect).toMatch(/dispatch\(chatActions\.roomRead\(\{ room \}\)\)/);
    expect(effect).toMatch(/lobbyRuntime\.markChatRead\(room\)/);
    expect(effect).toMatch(/\^table\[1-9\]/);
    expect(effect).not.toMatch(/render/);
  });

  test('requires session readiness, send permission, and a nonempty draft before submission', () => {
    const source = readFileSync(join(__dirname, 'ChatPanel.tsx'), 'utf8');
    expect(source).toContain('sendEnabled?: boolean;');
    expect(source).toContain('sendEnabled = true');
    expect(source).toContain('const canSend = ready && sendEnabled && trimmed.length > 0;');
    expect(source).toMatch(/const send = \(\) => \{\s*if \(!canSend\) return;\s*const succeeded = chatRuntime\.submit\(draft\);/);
    expect(source).toMatch(/dispatch\(chatActions\.draftSubmissionFinished\(\{\s*room,\s*succeeded,/);
    expect(source).toContain('editable={ready && sendEnabled}');
    expect(source).toContain('disabled={!canSend} title="Send"');
  });
});


test('history reading gates follow and read; New waits for the scroll boundary', () => {
  const source = readFileSync(join(__dirname, 'ChatPanel.tsx'), 'utf8');
  const contentChange = source.slice(source.indexOf('onContentSizeChange='), source.indexOf('onScroll='));
  expect(contentChange).toContain('if (!readActive || !appActive || !ready) return;');
  expect(contentChange).toContain('if (followEnd.current) historyRef.current?.scrollToEnd');
  const scroll = source.slice(source.indexOf('onScroll='), source.indexOf('nestedScrollEnabled'));
  expect(scroll).toContain('if (!readActive || !appActive || !ready) return;');
  expect(scroll).toContain('setAtEnd(end)');
  expect(scroll).toContain('if (end) setNewMessages(false)');
  const jump = source.slice(source.indexOf('{newMessages && !atEnd'), source.indexOf('      <Field'));
  expect(jump).toContain('scrollToEnd');
  expect(jump).not.toMatch(/roomRead|markChatRead/);
  expect(source).toContain('latestMessage !== previousLatestMessage.current');
  expect(source).toContain('historyRef.current?.scrollTo({ y: historyOffset.current, animated: false })');
});

test('local IME avoidance belongs only to the fill Chat task', () => {
  const source = readFileSync(join(__dirname, 'ChatPanel.tsx'), 'utf8');
  expect(source).toContain('fill ? [styles.fill, { paddingBottom: Math.max(0, imeOcclusion - systemInsets.bottom) }]');
  expect(source).toContain('fillHistory: { flex: 1, minHeight: 0, maxHeight: undefined }');
});

describe('chat send scrolling and server proposals', () => {
  let store: AppStore;
  let tree: ReturnType<typeof create>;
  const scrollToEnd = jest.fn();
  const scrollTo = jest.fn();
  const submit = jest.mocked(chatRuntime.submit);
  const options = {
    variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
    speedrun: false, cardCycle: true, deckPlays: false, emptyClues: false,
    oneExtraCard: false, oneLessCard: false, allOrNothing: false, detrimentalCharacters: false,
  };
  const game = {
    tableID: 42, name: 'Current table', owner: 1, players: [], options,
    passwordProtected: false, maxPlayers: 4,
  };

  function observe(msg: string, server = false, who = 'Bob', room = 'table42') {
    store.dispatch(chatActions.messageReceived({
      epoch: 1, defaultRoom: room, authenticatedUsername: 'Ada',
      message: { msg, server, who, room, recipient: '', discord: false, datetime: '2026-10-22T10:00:00Z' },
    }));
  }
  function proposal(variantName = 'No Variant') {
    const payload = { ...options, variantName, tableName: 'Suggested table', maxPlayers: 4 };
    return '<span class="cp"><button class="new-options" data-new-options="'
      + JSON.stringify(payload).replaceAll('"', "'")
      + '">click to apply the suggestion</button></span>';
  }
  function mount(room = 'table42') {
    act(() => {
      tree = create(React.createElement(Provider, { store, children:
        React.createElement(ChatPanel, { room, title: 'Table chat', fill: true }),
      }), { createNodeMock: () => ({ scrollToEnd, scrollTo }) });
    });
  }
  function button(title: string) {
    return tree.root.findAllByType(ActionButton)
      .find((node: { props: { title: string } }) => node.props.title === title);
  }
  function scrollUp() {
    act(() => tree.root.findByType(ScrollView).props.onScroll({ nativeEvent: {
      contentOffset: { y: 50 }, layoutMeasurement: { height: 100 }, contentSize: { height: 500 },
    } }));
    scrollToEnd.mockClear();
    scrollTo.mockClear();
  }
  function growHistory(height = 550) {
    act(() => tree.root.findByType(ScrollView).props.onContentSizeChange(100, height));
  }

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    submit.mockReset();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({ epoch: 1, welcome: {
      username: 'Ada', userID: 1, totalGames: 0, playingAtTables: [],
    } }));
    store.dispatch(roomActions.joinRequested({ epoch: 1, tableID: 42 }));
    store.dispatch(roomActions.joinedReceived({ epoch: 1, joined: { tableID: 42 } }));
    store.dispatch(roomActions.gameReceived({ epoch: 1, game }));
  });
  afterEach(() => {
    if (tree) act(() => tree.unmount());
    jest.restoreAllMocks();
  });

  test('successful send restores follow-to-end, clears draft and New, and follows one authoritative own echo', () => {
    observe('older');
    mount();
    scrollUp();
    act(() => observe('newer'));
    expect(button('New \u2193')).toBeDefined();
    act(() => tree.root.findByType(Field).props.onChangeText('my message'));
    submit.mockReturnValueOnce(true);
    act(() => button('Send').props.onPress());

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith('my message');
    expect(tree.root.findByType(Field).props.value).toBe('');
    expect(button('New \u2193')).toBeUndefined();
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    expect(store.getState().chat.messagesByRoom.table42?.map(({ msg }) => msg)).toEqual(['older', 'newer']);

    scrollToEnd.mockClear();
    act(() => observe('my message', false, 'Ada'));
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    scrollToEnd.mockClear();
    growHistory();
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
    expect(store.getState().chat.messagesByRoom.table42?.map(({ msg }) => msg))
      .toEqual(['older', 'newer', 'my message']);
    expect(button('New \u2193')).toBeUndefined();
  });

  test('failed send preserves draft, New and reading position without following later messages', () => {
    observe('older');
    mount();
    scrollUp();
    act(() => observe('newer'));
    act(() => tree.root.findByType(Field).props.onChangeText('keep this'));
    submit.mockReturnValueOnce(false);
    act(() => tree.root.findByType(Field).props.onSubmitEditing());

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith('keep this');
    expect(tree.root.findByType(Field).props.value).toBe('keep this');
    expect(button('New \u2193')).toBeDefined();
    act(() => observe('unrelated'));
    growHistory();
    expect(scrollToEnd).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(store.getState().chat.messagesByRoom.table42?.map(({ msg }) => msg))
      .toEqual(['older', 'newer', 'unrelated']);
  });

  test('unrelated incoming messages leave older history in place and show New', () => {
    observe('older');
    mount();
    scrollUp();
    act(() => observe('unrelated'));
    growHistory();
    expect(scrollToEnd).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(button('New \u2193')).toBeDefined();
    expect(submit).not.toHaveBeenCalled();
  });

  test('supported proposal shows its exact name and eligible Apply/Already applied action', () => {
    observe(proposal(), true, '');
    mount();
    expect(JSON.stringify(tree.toJSON())).toContain('Suggested variant: No Variant');
    expect(button('Apply proposal').props.disabled).toBe(false);
    act(() => button('Apply proposal').props.onPress());
    const { speedrun, deckPlays, detrimentalCharacters, ...mobileOptions } = options;
    expect(lobbyRuntime.updateTable).toHaveBeenCalledWith('Suggested table', 4, mobileOptions);

    act(() => store.dispatch(roomActions.gameReceived({ epoch: 1, game: { ...game, name: 'Suggested table' } })));
    expect(button('Already applied').props.disabled).toBe(true);
    expect(button('Apply proposal')).toBeUndefined();
  });

  test('unsupported proposal shows its exact name without an Apply action', () => {
    observe(proposal('Clue Starved'), true, '');
    mount();
    expect(JSON.stringify(tree.toJSON())).toContain('Suggested variant: Clue Starved');
    expect(button('Apply proposal')).toBeUndefined();
    expect(button('Already applied')).toBeUndefined();
    expect(lobbyRuntime.updateTable).not.toHaveBeenCalled();
  });

  test.each(['non-owner', 'other-table'])("supported proposal stays read-only for %s", (viewer) => {
    const room = viewer === 'other-table' ? 'table43' : 'table42';
    if (viewer === 'non-owner') store.dispatch(roomActions.gameReceived({ epoch: 1, game: { ...game, owner: 2 } }));
    observe(proposal(), true, '', room);
    mount(room);
    expect(JSON.stringify(tree.toJSON())).toContain('Suggested variant: No Variant');
    expect(button('Apply proposal')).toBeUndefined();
    expect(button('Already applied')).toBeUndefined();
  });

  test.each([
    { server: false, msg: proposal() },
    { server: true, msg: proposal().replace("'variantName':", "'variantName'") },
    { server: true, msg: proposal().replace('class="cp"', 'class="other"') },
  ])('malformed or non-server markup retains safe plain text and cannot offer Apply', ({ msg, server }) => {
    observe(msg, server);
    mount();
    const rendered = JSON.stringify(tree.toJSON());
    expect(rendered).toContain('click to apply the suggestion');
    expect(rendered).not.toContain('Suggested variant:');
    expect(rendered).not.toContain('data-new-options');
    expect(button('Apply proposal')).toBeUndefined();
    expect(button('Already applied')).toBeUndefined();
    expect(lobbyRuntime.updateTable).not.toHaveBeenCalled();
  });
});
