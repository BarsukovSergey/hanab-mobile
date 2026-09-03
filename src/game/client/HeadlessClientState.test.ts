import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

import { gameActionListSchema, gameInitSchema } from '../../protocol/gameProtocol';
import { makeInit } from '../../protocol/gameProtocol.fixtures';
import { roomActions } from '../../store/roomSlice';
import { sessionActions } from '../../store/sessionSlice';
import { createAppStore } from '../../store/store';
import { GameBootstrapCoordinator } from '../bootstrap/GameBootstrapCoordinator';
import { stateReducer } from './reducers/stateReducer';
import { cardOrder } from '../upstream/types/CardOrder';

describe('pinned upstream headless client state', () => {
  test('bootstrap history owns upstream replay states and visible state', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({
      epoch: 1,
      welcome: { userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [] },
    }));
    store.dispatch(roomActions.joinRequested({ epoch: 1, tableID: 123 }));
    store.dispatch(roomActions.tableStartReceived({
      epoch: 1,
      tableStart: { tableID: 123, replay: false },
    }));

    const coordinator = new GameBootstrapCoordinator(store, () => true);
    coordinator.startFromAuthoritativeRoom(1);
    coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit({ pauseQueued: true })));
    coordinator.receiveHistory(1, 1, gameActionListSchema.parse({
      tableID: 123,
      list: [
        ...Array.from({ length: 5 }, (_, order) => ({
          type: 'draw', playerIndex: 0, order, suitIndex: -1, rank: -1,
        })),
        ...Array.from({ length: 5 }, (_, index) => ({
          type: 'draw',
          playerIndex: 1,
          order: index + 5,
          suitIndex: index,
          rank: index + 1,
        })),
        { type: 'turn', num: 0, currentPlayerIndex: 0 },
        {
          type: 'clue',
          clue: { type: 1, value: 1 },
          giver: 0,
          list: [5],
          target: 1,
          turn: 0,
        },
        { type: 'turn', num: 1, currentPlayerIndex: 1 },
      ],
    }));

    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live game');
    expect(room.clientState.replay.states.flatMap((state, segment) => (
      state === undefined ? [] : [segment]
    ))).toEqual([0, 1]);
    expect(room.clientState.replay.actions.at(-2)).toMatchObject({
      type: 'clue',
      ignoreNegative: false,
    });
    expect(room.clientState.visibleState).toBe(room.clientState.ongoingGame);
    expect(room.clientState.pause).toEqual({ active: false, playerIndex: 0, queued: true });
    const paused = stateReducer(room.clientState, {
      type: 'pause', active: true, playerIndex: 1,
    });
    expect(paused.pause).toEqual({ active: true, playerIndex: 1, queued: false });
    expect(stateReducer(paused, {
      type: 'pauseQueue', queued: true,
    }).pause.queued).toBe(true);
  });

  test('no parallel replay timeline or duplicated room game fields remain', () => {
    const projectRoot = process.cwd();
    expect(fs.existsSync(path.join(
      projectRoot,
      'src',
      'game',
      'replay',
      'ReplayTimeline.ts',
    ))).toBe(false);

    const roomSlice = fs.readFileSync(
      path.join(projectRoot, 'src', 'store', 'roomSlice.ts'),
      'utf8',
    );
    expect(roomSlice).not.toMatch(/\bactionHistory:/);
    expect(roomSlice).not.toMatch(/\breviewSegment:/);
    expect(roomSlice).not.toMatch(/\bpostgame:/);
  });

  test('note actions stay out of replay history and recompute note-dependent player state', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({
      epoch: 1,
      welcome: { userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [] },
    }));
    store.dispatch(roomActions.joinRequested({ epoch: 1, tableID: 123 }));
    store.dispatch(roomActions.tableStartReceived({
      epoch: 1,
      tableStart: { tableID: 123, replay: false },
    }));
    const coordinator = new GameBootstrapCoordinator(store, () => true);
    coordinator.startFromAuthoritativeRoom(1);
    coordinator.receiveInit(1, 1, gameInitSchema.parse(makeInit()));
    coordinator.receiveHistory(1, 1, gameActionListSchema.parse({
      tableID: 123,
      list: [
        ...Array.from({ length: 5 }, (_, order) => ({
          type: 'draw', playerIndex: 0, order, suitIndex: -1, rank: -1,
        })),
        ...Array.from({ length: 5 }, (_, index) => ({
          type: 'draw', playerIndex: 1, order: index + 5, suitIndex: index, rank: index + 1,
        })),
        { type: 'turn', num: 0, currentPlayerIndex: 0 },
      ],
    }));
    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live game');
    const initial = room.clientState;
    const replayLength = initial.replay.actions.length;

    const combined = stateReducer(initial, {
      type: 'noteList',
      names: ['Ada'],
      noteTextLists: [['clued']],
      isSpectators: [false],
    });
    expect(combined.ongoingGame).toBe(initial.ongoingGame);
    expect(combined.replay.actions).toHaveLength(replayLength);

    const received = stateReducer(combined, {
      type: 'receiveNote',
      order: cardOrder.parse(0),
      notes: [{ name: 'Cy', text: 'r1', isSpectator: true }],
    });
    expect(received.ongoingGame).toBe(combined.ongoingGame);
    expect(received.replay.actions).toHaveLength(replayLength);

    const recomputed = stateReducer(received, {
      type: 'noteListPlayer',
      texts: ['clued'],
    });
    expect(recomputed.ongoingGame).not.toBe(received.ongoingGame);
    expect(recomputed.ongoingGame.stats.cardsGottenByNotes).toBe(1);
    expect(recomputed.replay.actions).toHaveLength(replayLength);

    const edited = stateReducer(recomputed, {
      type: 'editNote', order: cardOrder.parse(0), text: 'unclued',
    });
    expect(edited.ongoingGame.stats.cardsGottenByNotes).toBe(0);
    expect(edited.replay.actions).toHaveLength(replayLength);
    const modified = stateReducer(edited, { type: 'setEffMod', mod: 2 });
    expect(modified.notes.efficiencyModifier).toBe(2);
    expect(modified.ongoingGame).not.toBe(edited.ongoingGame);
    expect(modified.replay.actions).toHaveLength(replayLength);
  });
});
