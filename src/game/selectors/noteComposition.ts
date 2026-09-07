import { parseNote } from '../client/reducers/notesReducer';
import { getVariant } from '../upstream/gameData';
import type { CardNote } from '../upstream/interfaces/CardNote';

export type QuickNoteToken = 'f' | 'cm' | 'ptd' | 'kt' | 'fix' | '?' | '!';

type BooleanNoteField =
  | 'chopMoved'
  | 'finessed'
  | 'discardPermission'
  | 'knownTrash'
  | 'needsFix'
  | 'questionMark'
  | 'exclamationMark'
  | 'blank'
  | 'unclued'
  | 'clued';

const BOOLEAN_FIELDS: readonly BooleanNoteField[] = [
  'chopMoved',
  'finessed',
  'discardPermission',
  'knownTrash',
  'needsFix',
  'questionMark',
  'exclamationMark',
  'blank',
  'unclued',
  'clued',
];

const TOKEN_FIELD: Readonly<Record<QuickNoteToken, BooleanNoteField>> = {
  f: 'finessed',
  cm: 'chopMoved',
  ptd: 'discardPermission',
  kt: 'knownTrash',
  fix: 'needsFix',
  '?': 'questionMark',
  '!': 'exclamationMark',
};

export function composeQuickNote(
  variantName: string,
  text: string,
  token: QuickNoteToken,
): string | null {
  const variant = getVariant(variantName);
  const before = parseNote(variant, text);
  const empty = parseNote(variant, '');
  const targetField = TOKEN_FIELD[token];
  if (before[targetField]) return text;

  const pipeIndex = text.lastIndexOf('|');
  const prefix = pipeIndex >= 0 ? text.slice(0, pipeIndex + 1) : '';
  const active = text.slice(pipeIndex + 1).trim();
  if (!hasBalancedSquareBrackets(active)) return null;

  let nextActive: string;
  if (active.length === 0) {
    nextActive = `[${token}]`;
  } else if (active.includes('[')) {
    nextActive = `${active} [${token}]`;
  } else if (noteHasSemantics(before, empty)) {
    nextActive = `[${active}] [${token}]`;
  } else {
    nextActive = `${active} [${token}]`;
  }

  const candidate = prefix.length > 0 ? `${prefix} ${nextActive}` : nextActive;
  const after = parseNote(variant, candidate);
  if (!preservesSemantics(before, after, targetField)) return null;
  return candidate;
}

function noteHasSemantics(note: CardNote, empty: CardNote): boolean {
  return JSON.stringify(note.possibilities) !== JSON.stringify(empty.possibilities)
    || BOOLEAN_FIELDS.some((field) => note[field]);
}

function preservesSemantics(
  before: CardNote,
  after: CardNote,
  targetField: BooleanNoteField,
): boolean {
  if (!after[targetField]) return false;
  if (JSON.stringify(after.possibilities) !== JSON.stringify(before.possibilities)) return false;
  return BOOLEAN_FIELDS.every((field) => (
    field === targetField ? after[field] : after[field] === before[field]
  ));
}

function hasBalancedSquareBrackets(text: string): boolean {
  let open = false;
  for (const character of text) {
    if (character === '[') {
      if (open) return false;
      open = true;
    } else if (character === ']') {
      if (!open) return false;
      open = false;
    }
  }
  return !open;
}
