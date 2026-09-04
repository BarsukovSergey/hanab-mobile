import { expect, test } from '@jest/globals';

import { getCommittedClueMarker } from './clueIndication';

const choices = {
  colors: [{ value: 0, label: 'Red' }, { value: 1, label: 'Yellow' }],
  ranks: [{ value: 1, label: '1' }, { value: 2, label: '2' }],
};

test('marks only cards touched by the latest clue', () => {
  const clue = {
    giverPlayerIndex: 0,
    targetPlayerIndex: 1,
    clueType: 'color' as const,
    value: 0,
    touchedOrders: [7, 9],
  };

  expect(getCommittedClueMarker(clue, 7, 1, choices)).toEqual({ label: 'R', retouched: false });
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

  expect(getCommittedClueMarker(clue, 4, 2, choices)).toEqual({ label: '2', retouched: true });
});
