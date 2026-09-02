import { describe, expect, test } from '@jest/globals';

import type { GameMetadata } from '../../upstream/interfaces/GameMetadata';
import { cardOrder } from '../../upstream/types/CardOrder';
import type { NotesState } from '../types/NotesState';
import { notesReducer } from './notesReducer';

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
  test('classifies local note identities and reserved note meanings', () => {
    const identity = notesReducer(emptyNotes, {
      type: 'editNote', order: cardOrder.parse(0), text: 'R1',
    }, metadata);
    expect(identity.ourNotes[0]).toMatchObject({ text: 'R1', possibilities: [[0, 1]] });

    const trash = notesReducer(identity, {
      type: 'editNote', order: cardOrder.parse(1), text: 'kt',
    }, metadata);
    expect(trash.ourNotes[1]).toMatchObject({ knownTrash: true, possibilities: [] });
  });

  test('loads player and spectator notes without a deep-equality dependency', () => {
    const listed = notesReducer(emptyNotes, {
      type: 'noteList',
      names: ['Ada', 'Cy'],
      noteTextLists: [['r1', ''], ['', 'kt']],
      isSpectators: [false, true],
    }, metadata);
    expect(listed.ourNotes[0]?.text).toBe('r1');
    expect(listed.allNotes).toEqual([
      [{ name: 'Ada', text: 'r1', isSpectator: false }],
      [{ name: 'Cy', text: 'kt', isSpectator: true }],
    ]);

    const received = notesReducer(listed, {
      type: 'receiveNote',
      order: cardOrder.parse(0),
      notes: [{ name: 'Cy', text: '?', isSpectator: true }],
    }, metadata);
    expect(received.allNotes[0]).toEqual([{ name: 'Cy', text: '?', isSpectator: true }]);
    expect(received.ourNotes[0]?.text).toBe('');
  });

  test('loads our private list and efficiency modifier', () => {
    const loaded = notesReducer(emptyNotes, {
      type: 'noteListPlayer', texts: ['r1', 'kt'],
    }, metadata);
    const modified = notesReducer(loaded, { type: 'setEffMod', mod: -2 }, metadata);
    expect(modified.ourNotes.map((note) => note.text)).toEqual(['r1', 'kt']);
    expect(modified.efficiencyModifier).toBe(-2);
  });
});
