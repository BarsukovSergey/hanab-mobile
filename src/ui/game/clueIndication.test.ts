import { expect, test } from '@jest/globals';

import { getCommittedClueMarker } from './clueIndication';

const choices = {
  colors: [{ value: 0, label: 'Red' }, { value: 1, label: 'Yellow' }],
  ranks: [{ value: 1, label: '1' }, { value: 2, label: '2' }],
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
    label: 'Red',
    fill: '#ff7777',
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
    label: '2',
    fill: null,
    retouched: true,
  });
});
