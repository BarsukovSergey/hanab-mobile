import { describe, expect, test } from '@jest/globals';

import type { GameMetadata } from '../../upstream/interfaces/GameMetadata';
import { getVariant } from '../../upstream/gameData';
import { cardOrder } from '../../upstream/types/CardOrder';
import type { NotesState } from '../types/NotesState';
import { notesReducer, parseNote } from './notesReducer';

const metadata = {
  ourUsername: 'Ada',
  options: { variantName: 'No Variant' },
} as GameMetadata;

const emptyNotes: NotesState = {
  ourNotes: [],
  allNotes: [],
  efficiencyModifier: 0,
};

describe('pinned client notes reducer', () => {
  test('parses pinned bracket, pipe, compact, positive, and negative syntax', () => {
    const variant = getVariant('No Variant');
    expect(parseNote(variant, 'r,!2,!3').possibilities).toEqual([
      [0, 1], [0, 4], [0, 5],
    ]);
    expect(parseNote(variant, '[r1]').possibilities).toEqual([[0, 1]]);
    expect(parseNote(variant, 'remember this | y2').possibilities).toEqual([[1, 2]]);
    expect(parseNote(variant, 'ry12').possibilities).toEqual([
      [0, 1], [1, 1], [0, 2], [1, 2],
    ]);
    expect(parseNote(variant, '[r][1]').possibilities).toEqual([[0, 1]]);
    expect(parseNote(variant, 'context | kt')).toMatchObject({
      knownTrash: true,
      possibilities: expect.any(Array),
    });
  });

  test('classifies local note identities and reserved note meanings', () => {
    const identity = notesReducer(emptyNotes, {
      type: 'editNote', order: cardOrder.parse(0), text: 'R1',
    }, metadata, true, false);
    expect(identity.ourNotes[0]).toMatchObject({ text: 'R1', possibilities: [[0, 1]] });

    const trash = notesReducer(identity, {
      type: 'editNote', order: cardOrder.parse(1), text: 'kt',
    }, metadata, true, false);
    expect(trash.ourNotes[1]).toMatchObject({ knownTrash: true });
    expect(trash.ourNotes[1]?.possibilities).toHaveLength(25);
  });

  test('loads player and spectator notes without a deep-equality dependency', () => {
    const listed = notesReducer(emptyNotes, {
      type: 'noteList',
      names: ['Ada', 'Cy'],
      noteTextLists: [['r1', ''], ['', 'kt']],
      isSpectators: [false, true],
    }, metadata, false, false);
    expect(listed.ourNotes[0]?.text).toBe('r1');
    expect(listed.allNotes).toEqual([
      [
        { name: 'Ada', text: 'r1', isSpectator: false },
        { name: 'Cy', text: '', isSpectator: true },
      ],
      [
        { name: 'Ada', text: '', isSpectator: false },
        { name: 'Cy', text: 'kt', isSpectator: true },
      ],
    ]);

    const received = notesReducer(listed, {
      type: 'receiveNote',
      order: cardOrder.parse(0),
      notes: [{ name: 'Cy', text: '?', isSpectator: true }],
    }, metadata, false, false);
    expect(received.allNotes[0]).toEqual([{ name: 'Cy', text: '?', isSpectator: true }]);
    expect(received.ourNotes[0]?.text).toBe('r1');

    const edited = notesReducer(listed, {
      type: 'editNote', order: cardOrder.parse(0), text: 'y2',
    }, metadata, false, false);
    expect(edited.allNotes[0]?.find((note) => note.name === 'Ada')?.text).toBe('y2');

    const finishedEdit = notesReducer(listed, {
      type: 'editNote', order: cardOrder.parse(0), text: 'b3',
    }, metadata, false, true);
    expect(finishedEdit.ourNotes[0]?.text).toBe('b3');
    expect(finishedEdit.allNotes[0]?.find((note) => note.name === 'Ada')?.text).toBe('r1');
  });

  test('combined lists hydrate our notes only for an ongoing spectator', () => {
    const action = {
      type: 'noteList' as const,
      names: ['Ada'],
      noteTextLists: [['r1']],
      isSpectators: [true],
    };
    expect(notesReducer(emptyNotes, action, metadata, false, false).ourNotes[0]?.text)
      .toBe('r1');
    expect(notesReducer(emptyNotes, action, metadata, true, false).ourNotes).toEqual([]);
    expect(notesReducer(emptyNotes, action, metadata, false, true).ourNotes).toEqual([]);
  });

  test('loads our private list and efficiency modifier', () => {
    const loaded = notesReducer(emptyNotes, {
      type: 'noteListPlayer', texts: ['r1', 'kt'],
    }, metadata, true, false);
    const modified = notesReducer(
      loaded,
      { type: 'setEffMod', mod: -2 },
      metadata,
      true,
      false,
    );
    expect(modified.ourNotes.map((note) => note.text)).toEqual(['r1', 'kt']);
    expect(modified.efficiencyModifier).toBe(-2);
  });
});
