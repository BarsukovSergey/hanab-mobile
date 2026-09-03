import type { CardNote } from '../upstream/interfaces/CardNote';

export type CardNoteVisual = {
  hasText: boolean;
  clued: boolean;
  unclued: boolean;
  chopMoved: boolean;
  finessed: boolean;
  discardPermission: boolean;
  knownTrash: boolean;
  needsFix: boolean;
  questionMark: boolean;
  exclamationMark: boolean;
};

export function getCardNoteVisual(note: CardNote | undefined): CardNoteVisual {
  return {
    hasText: (note?.text.trim().length ?? 0) > 0,
    clued: note?.clued ?? false,
    unclued: note?.unclued ?? false,
    chopMoved: note?.chopMoved ?? false,
    finessed: note?.finessed ?? false,
    discardPermission: note?.discardPermission ?? false,
    knownTrash: note?.knownTrash ?? false,
    needsFix: note?.needsFix ?? false,
    questionMark: note?.questionMark ?? false,
    exclamationMark: note?.exclamationMark ?? false,
  };
}

export function getHandCardBorderColor(hasClueApplied: boolean, note: CardNoteVisual): string | null {
  const clued = !note.unclued && (hasClueApplied || note.clued);
  if (clued) return 'orange';
  if (note.finessed) return 'aqua';
  if (note.discardPermission) return '#812020';
  if (note.chopMoved) return '#fffce6';
  return null;
}
