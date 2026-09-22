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

const emptyNotes = new Map<string, CardNote>();

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

function getEmptyNote(variant: Variant): CardNote {
  const cached = emptyNotes.get(variant.name);
  if (cached !== undefined) return cached;
  const note = parseNote(variant, '');
  emptyNotes.set(variant.name, note);
  return note;
}

/**
 * Mirrors upstream noteEqual: compare parser meaning while ignoring the original text string.
 * The upstream client uses fast-deep-equal; this local comparison avoids adding a UI-only dependency.
 */
export function noteEqual(note1: CardNote, note2: CardNote): boolean {
  if (note1.possibilities.length !== note2.possibilities.length) return false;
  for (const [index, possibility1] of note1.possibilities.entries()) {
    const possibility2 = note2.possibilities[index];
    if (possibility2 === undefined
      || possibility1[0] !== possibility2[0]
      || possibility1[1] !== possibility2[1]) return false;
  }
  return note1.knownTrash === note2.knownTrash
    && note1.needsFix === note2.needsFix
    && note1.questionMark === note2.questionMark
    && note1.exclamationMark === note2.exclamationMark
    && note1.chopMoved === note2.chopMoved
    && note1.finessed === note2.finessed
    && note1.discardPermission === note2.discardPermission
    && note1.blank === note2.blank
    && note1.unclued === note2.unclued
    && note1.clued === note2.clued;
}

/** Mirrors upstream noteHasMeaning. */
export function noteHasMeaning(variant: Variant, note: CardNote): boolean {
  return !noteEqual(note, getEmptyNote(variant));
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
