import { describe, expect, test } from '@jest/globals';

import { parseServerProposedVariantName, parseServerTableProposal, tableProposalMatches } from './tableProposal';

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
  test.each(['No Variant', 'Clue Starved', 'Rainbow (6 Suits)', 'x'.repeat(256)])(
    'reads the exact variant name %s independently of mobile support', (variantName) => {
      expect(parseServerProposedVariantName(proposalMessage({ ...options, variantName })))
        .toBe(variantName);
    },
  );

  test('name recognition does not relax application restrictions', () => {
    for (const payload of [
      { variantName: 'No Variant' },
      { ...options, variantName: 'Clue Starved' },
      { ...options, speedrun: true },
      { ...options, oneExtraCard: true, oneLessCard: true },
    ]) {
      const message = proposalMessage(payload);
      expect(parseServerProposedVariantName(message)).toBe(payload.variantName);
      expect(parseServerTableProposal(message)).toBeNull();
    }
  });

  test.each([
    proposalMessage({}),
    ...[null, 123, true, {}, [], '', '   ', 'x'.repeat(257)].map(
      (variantName) => proposalMessage({ ...options, variantName }),
    ),
    { ...proposalMessage(), server: false },
    { server: true, msg: '<button data-new-options="{}">click to apply the suggestion</button>' },
    { server: true, msg: proposalMessage().msg.replace("'variantName':", "'variantName'") },
    { server: true, msg: proposalMessage().msg.replace('new-options"', 'new-options" onclick="bad"') },
    { server: true, msg: proposalMessage().msg + '<span>extra</span>' },
    ...['null', '42', '[]', "'No Variant'"].map((json) => ({
      server: true,
      msg: `<span class="cp"><button class="new-options" data-new-options="${json}">click to apply the suggestion</button></span>`,
    })),
  ])('rejects invalid names and markup without creating an actionable proposal', (message) => {
    expect(parseServerProposedVariantName(message)).toBeNull();
    expect(parseServerTableProposal(message)).toBeNull();
  });

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
