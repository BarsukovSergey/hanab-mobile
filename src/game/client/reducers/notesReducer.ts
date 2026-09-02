import { assertDefined } from 'complete-common';
import type { Draft } from 'immer';
import { castDraft, produce } from 'immer';

import { getVariant } from '../../upstream/gameData';
import type { GameMetadata } from '../../upstream/interfaces/GameMetadata';
import type { SpectatorNote } from '../../upstream/interfaces/SpectatorNote';
import type { NoteAction } from '../../upstream/types/gameActions';
import type { NotesState } from '../types/NotesState';
import { noteIdentity } from './noteIdentity';

export const notesReducer = produce(notesReducerFunction, {} as NotesState);

function notesReducerFunction(
  state: Draft<NotesState>,
  action: NoteAction,
  metadata: GameMetadata,
): void {
  const variant = getVariant(metadata.options.variantName);
  switch (action.type) {
    case 'editNote':
      state.ourNotes[action.order] = castDraft(noteIdentity(action.text, variant));
      break;
    case 'noteListPlayer':
      state.ourNotes = castDraft(action.texts.map((text) => noteIdentity(text, variant)));
      break;
    case 'noteList': {
      const allNotes: SpectatorNote[][] = [];
      for (const [personIndex, noteTexts] of action.noteTextLists.entries()) {
        const name: string | undefined = action.names[personIndex];
        const isSpectator: boolean | undefined = action.isSpectators[personIndex];
        assertDefined(name, `Missing note-list name at index: ${personIndex}`);
        assertDefined(isSpectator, `Missing note-list role at index: ${personIndex}`);
        for (const [order, text] of noteTexts.entries()) {
          if (text.length === 0) continue;
          (allNotes[order] ??= []).push({ name, text, isSpectator });
        }
        if (name === metadata.ourUsername) {
          state.ourNotes = castDraft(noteTexts.map((text) => noteIdentity(text, variant)));
        }
      }
      state.allNotes = castDraft(allNotes);
      break;
    }
    case 'receiveNote': {
      state.allNotes[action.order] = castDraft(action.notes);
      const ours = action.notes.find((note) => note.name === metadata.ourUsername);
      state.ourNotes[action.order] = castDraft(noteIdentity(ours?.text ?? '', variant));
      break;
    }
    case 'setEffMod':
      state.efficiencyModifier = action.mod;
      break;
  }
}
