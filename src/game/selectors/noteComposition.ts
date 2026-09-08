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
  return (noteString.match(/\[[^\]]*]/g) ?? []).join(' ');
}

function isBorderAffecting(variant: Variant, noteString: string): boolean {
  const parsed = parseNote(variant, noteString);
  return parsed.chopMoved || parsed.finessed || parsed.discardPermission;
}

/**
 * Ports Hanabi-Live HanabiCard.updateNote/appendNote for mobile quick-note actions.
 * Upstream appendNote uses keepLast=true, protect=true, stripProse=true.
 */
export function composeQuickNote(
  variantName: string,
  text: string,
  token: QuickNoteToken,
): string {
  const variant = getVariant(variantName);
  const noteText = text.trim();
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
    return text;
  }

  const newNoteText = noteText;
  return `${newNoteText}${newNoteText === '' ? '' : ' | '}${newNoteString}`;
}
