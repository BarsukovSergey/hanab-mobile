import type { Draft } from 'immer';
import { castDraft, produce } from 'immer';

import {
  BLANK_NOTES,
  CHOP_MOVED_NOTES,
  CLUED_NOTES,
  DISCARD_PERMISSION_NOTES,
  EXCLAMATION_MARK_NOTES,
  FINESSED_NOTES,
  KNOWN_TRASH_NOTES,
  NEEDS_FIX_NOTES,
  QUESTION_MARK_NOTES,
  UNCLUED_NOTES,
} from '../../upstream/abbreviations';
import { getVariant } from '../../upstream/gameData';
import type { CardNote } from '../../upstream/interfaces/CardNote';
import type { GameMetadata } from '../../upstream/interfaces/GameMetadata';
import type { Variant } from '../../upstream/interfaces/Variant';
import type { NoteAction } from '../../upstream/types/gameActions';
import type { NotesState } from '../types/NotesState';
import { getPossibilitiesFromKeywords } from './noteIdentity';

export const notesReducer = produce(notesReducerFunction, {} as NotesState);

function notesReducerFunction(
  notes: Draft<NotesState>,
  action: NoteAction,
  metadata: GameMetadata,
  playing: boolean,
  finished: boolean,
): void {
  const variant = getVariant(metadata.options.variantName);
  switch (action.type) {
    case 'setEffMod':
      notes.efficiencyModifier = action.mod;
      break;
    case 'editNote': {
      notes.ourNotes[action.order] = castDraft(parseNote(variant, action.text));
      if (!playing && !finished) {
        const combined = notes.allNotes[action.order];
        if (combined !== undefined) {
          for (const note of combined) {
            if (note.name === metadata.ourUsername) note.text = action.text;
          }
        }
      }
      break;
    }
    case 'noteListPlayer':
      for (const [order, text] of action.texts.entries()) {
        notes.ourNotes[order] = castDraft(parseNote(variant, text));
      }
      break;
    case 'receiveNote':
      notes.allNotes[action.order] = castDraft(action.notes);
      break;
    case 'noteList': {
      const combinedNotes = Array.from(
        { length: Math.max(0, ...action.noteTextLists.map((texts) => texts.length)) },
        () => [] as Array<{ name: string; text: string; isSpectator: boolean }>,
      );
      for (const [personIndex, texts] of action.noteTextLists.entries()) {
        const name = action.names[personIndex];
        const isSpectator = action.isSpectators[personIndex];
        if (name === undefined || isSpectator === undefined) continue;
        if (name === metadata.ourUsername && !playing && !finished) {
          for (const [order, text] of texts.entries()) {
            notes.ourNotes[order] = castDraft(parseNote(variant, text));
          }
        }
        for (const [order, text] of texts.entries()) {
          const combined = combinedNotes[order];
          if (combined !== undefined) combined.push({ name, text, isSpectator });
        }
      }
      notes.allNotes = castDraft(combinedNotes);
      break;
    }
  }
}

function getNoteKeywords(note: string): readonly string[] {
  const regexp = /\[(.*?)]|\|([^[|]*$)|(^[^[|]+$)/g;
  const keywords: string[] = [];
  let match = regexp.exec(note);
  while (match !== null) {
    const keyword = match[1] ?? match[2] ?? match[3];
    if (keyword !== undefined) keywords.push(keyword.trim());
    match = regexp.exec(note);
  }
  return keywords;
}

function hasKeyword(patterns: readonly string[], keywords: readonly string[]): boolean {
  return keywords.some((keyword) => patterns.includes(keyword));
}

export function parseNote(variant: Variant, text: string): CardNote {
  const fullNote = text.slice(text.lastIndexOf('|') + 1).toLowerCase().trim();
  const keywords = getNoteKeywords(fullNote);
  return {
    possibilities: getPossibilitiesFromKeywords(variant, keywords),
    chopMoved: hasKeyword(CHOP_MOVED_NOTES, keywords),
    finessed: hasKeyword(FINESSED_NOTES, keywords),
    discardPermission: hasKeyword(DISCARD_PERMISSION_NOTES, keywords),
    knownTrash: hasKeyword(KNOWN_TRASH_NOTES, keywords),
    needsFix: hasKeyword(NEEDS_FIX_NOTES, keywords),
    questionMark: hasKeyword(QUESTION_MARK_NOTES, keywords),
    exclamationMark: hasKeyword(EXCLAMATION_MARK_NOTES, keywords),
    blank: hasKeyword(BLANK_NOTES, keywords),
    unclued: hasKeyword(UNCLUED_NOTES, keywords),
    clued: hasKeyword(CLUED_NOTES, keywords),
    text,
  };
}
