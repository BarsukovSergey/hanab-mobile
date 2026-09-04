import { expect, test } from '@jest/globals';

import {
  getCommittedClueMarker,
  getCommittedClueMarkerForMetadata,
} from './clueIndication';

const choices = {
  colors: [{ value: 0, label: 'Red' }, { value: 1, label: 'Yellow' }],
  ranks: [{ value: 1, label: '1' }, { value: 2, label: '2' }],
  allowEmptyClues: false,
};

test('marks only cards touched by the latest color clue', () => {
  const clue = {
    giverPlayerIndex: 0,
    targetPlayerIndex: 1,
    clueType: 'color' as const,
    value: 0,
    touchedOrders: [7, 9],
  };

  expect(getCommittedClueMarker(clue, 7, 1, choices)).toEqual({
    kind: 'color',
    value: 0,
    label: 'Red',
    retouched: false,
  });
  expect(getCommittedClueMarker(clue, 8, 1, choices)).toBeNull();
});

test('shows rank labels and distinguishes retouched cards', () => {
  const clue = {
    giverPlayerIndex: 0,
    targetPlayerIndex: 1,
    clueType: 'rank' as const,
    value: 2,
    touchedOrders: [4],
  };

  expect(getCommittedClueMarker(clue, 4, 2, choices)).toEqual({
    kind: 'rank',
    value: 2,
    label: '2',
    retouched: true,
  });
});

test('uses the same compact O/E rank marker text as upstream Odds and Evens arrows', () => {
  const clue = {
    giverPlayerIndex: 0,
    targetPlayerIndex: 1,
    clueType: 'rank' as const,
    value: 2,
    touchedOrders: [4],
  };
  const oddsAndEvensChoices = {
    ...choices,
    ranks: [{ value: 1, label: 'Odd' }, { value: 2, label: 'Even' }],
  };

  expect(getCommittedClueMarker(clue, 4, 1, oddsAndEvensChoices)?.label).toBe('E');
});

test('uses the authoritative clue giver character for committed marker labels', () => {
  const clue = {
    giverPlayerIndex: 1,
    targetPlayerIndex: 0,
    clueType: 'color' as const,
    value: 0,
    touchedOrders: [4],
  };
  const metadata = {
    options: { variantName: 'No Variant', emptyClues: false },
    ourPlayerIndex: 0,
    characterAssignments: [null, 34],
  } as unknown as Parameters<typeof getCommittedClueMarkerForMetadata>[3];

  expect(getCommittedClueMarkerForMetadata(clue, 4, 1, metadata)?.label).toBe('Quack');
});
