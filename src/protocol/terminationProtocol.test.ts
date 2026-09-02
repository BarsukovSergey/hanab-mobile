import { describe, expect, test } from '@jest/globals';

import { decodeServerFrame } from './lobbyProtocol';
import {
  encodeTableTerminateFrame,
  encodeVoteForTerminationFrame,
  terminationCommandSchema,
} from './terminationProtocol';

describe('C14-B2 termination protocol', () => {
  test('encodes the two exact table commands', () => {
    expect(encodeVoteForTerminationFrame(123)).toBe(
      'tableVoteForTermination {"tableID":123}',
    );
    expect(encodeTableTerminateFrame(123)).toBe(
      'tableTerminate {"tableID":123}',
    );
    expect(() => terminationCommandSchema.parse({ tableID: -1 })).toThrow();
  });

  test('decodes strict voteChange payloads', () => {
    expect(decodeServerFrame('voteChange {"vote":true}')).toEqual({
      kind: 'event',
      event: { command: 'voteChange', data: { vote: true } },
    });
    expect(decodeServerFrame('voteChange {"vote":false,"tableID":123}')).toEqual({
      kind: 'malformed',
      command: 'voteChange',
      issue: 'invalid-payload',
    });
  });
});
