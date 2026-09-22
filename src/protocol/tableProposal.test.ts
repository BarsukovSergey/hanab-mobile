import { describe, expect, test } from '@jest/globals';

import { parseServerTableProposal, tableProposalMatches } from './tableProposal';

const options = {
  numPlayers: 0,
  startingPlayer: 0,
  variantID: 0,
  variantName: 'No Variant',
  timed: false,
  timeBase: 0,
  timePerTurn: 0,
  speedrun: false,
  cardCycle: true,
  deckPlays: false,
  emptyClues: false,
  oneExtraCard: false,
  oneLessCard: false,
  allOrNothing: false,
  detrimentalCharacters: false,
  tableName: 'Suggested table',
  maxPlayers: 4,
};

function proposalMessage(payload: Record<string, unknown> = options) {
  return {
    server: true,
    msg: '<span class="cp"><button class="new-options" data-new-options="'
      + JSON.stringify(payload).replaceAll('"', "'")
      + '">click to apply the suggestion</button></span>',
  };
}

describe('pinned server table proposals', () => {
  test('parses the pinned server new-options payload and exposes only mobile options', () => {
    expect(parseServerTableProposal(proposalMessage())).toEqual({
      name: 'Suggested table',
      maxPlayers: 4,
      options: {
        variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
        cardCycle: true, emptyClues: false, oneExtraCard: false, oneLessCard: false,
        allOrNothing: false,
      },
    });
  });

  test.each([
    { ...proposalMessage(), server: false },
    { ...proposalMessage(), msg: '<button data-new-options="{}">click to apply the suggestion</button>' },
    proposalMessage({ ...options, variantName: 'Clue Starved' }),
    proposalMessage({ ...options, speedrun: true }),
    proposalMessage({ ...options, oneExtraCard: true, oneLessCard: true }),
  ])('rejects malformed, non-server, and unsupported proposal payloads', (message) => {
    expect(parseServerTableProposal(message)).toBeNull();
  });

  test('recognizes a proposal already present in the authoritative room data', () => {
    const proposal = parseServerTableProposal(proposalMessage());
    if (proposal === null) throw new Error('Expected proposal');
    expect(tableProposalMatches(proposal, {
      name: 'Suggested table', maxPlayers: 4, options,
    })).toBe(true);
  });
});
