import { noteEqual, noteHasMeaning, parseNote } from '../client/reducers/notesReducer';
import { getVariant } from '../upstream/gameData';
import type { Variant } from '../upstream/interfaces/Variant';

export type QuickNoteToken = 'f' | 'cm' | 'ptd' | 'kt' | 'fix' | '?' | '!';

function protectedNote(variant: Variant, noteString: string): string {
  const currentNote = parseNote(variant, noteString);
  const bracketNoteString = `[${noteString}]`;
  if (
    noteHasMeaning(variant, currentNote)
    && noteEqual(currentNote, parseNote(variant, bracketNoteString))
  ) {
    return bracketNoteString;
  }
  return noteString;
}

function stripProse(noteString: string): string {
  const brackets = noteString.match(/\[[^\]]*]/g) ?? [];
  return brackets.join(' ');
}

function isBorderAffecting(variant: Variant, noteString: string): boolean {
  const parsed = parseNote(variant, noteString);
  return parsed.chopMoved || parsed.finessed || parsed.discardPermission;
}

/**
 * Exact mobile adapter for Hanabi-Live HanabiCard.appendNote.
 *
 * The web shortcut path calls appendNote(token), which calls updateNote with:
 * keepLast=true, protect=true, stripProse=true. Keep this structure in sync with
 * the pinned card-presentation source instead of inventing mobile note grammar.
 */
export function composeQuickNote(
  variantName: string,
  existingNote: string,
  token: QuickNoteToken,
): string {
  const variant = getVariant(variantName);
  const noteText = existingNote.trim();
  const note = protectedNote(variant, token);
  const lastPipe = noteText.lastIndexOf('|');
  const currentNoteString = noteText.slice(lastPipe + 1).trim();
  const noteString = protectedNote(variant, currentNoteString);
  const currentNote = parseNote(variant, noteString);
  let newNoteString = `${noteString} ${note}`;

  newNoteString = stripProse(newNoteString);
  if (isBorderAffecting(variant, note)) {
    newNoteString = newNoteString
      .split(/(?<=])\s+(?=\[)/)
      .filter((candidate) => candidate === note || !isBorderAffecting(variant, candidate))
      .join(' ');
  }

  if (
    noteHasMeaning(variant, parseNote(variant, note))
    && noteEqual(currentNote, parseNote(variant, newNoteString))
  ) {
    return existingNote;
  }

  return `${noteText}${noteText === '' ? '' : ' | '}${newNoteString}`;
}
