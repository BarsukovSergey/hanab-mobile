import { describe, expect, test } from '@jest/globals';

import { auditSerializability } from './serializability';
import { runGameCoreProbe } from './gameCoreProbe';

describe('C2 pinned game-core probe', () => {
  test('runs the upstream-derived sequence without mutation and with expected results', () => {
    const result = runGameCoreProbe();

    expect(result.gameCoreImport).toBe(true);
    expect(result.reducerSequence).toBe(true);
    expect(result.actionCount).toBe(20);
    expect(result.finalScore).toBe(1);
    expect(result.clueTokens).toBe(8);
    expect(result.turnNumber).toBeGreaterThanOrEqual(3);
    expect(result.previousStateMutationDetected).toBe(false);
    expect(result.changedActionRootIdentityFailures).toBe(0);
    expect(result.actionOutcomeFailures).toBe(0);
    expect(result.structuralSharingObserved).toBe(true);
  });

  test('audits every state and metadata, including JSON round trips', () => {
    const result = runGameCoreProbe();

    expect(result.initialStateNonPlainFindings).toEqual([]);
    expect(result.sequenceStateNonPlainFindings).toEqual([]);
    expect(result.jsonLossyNumericFindings).toEqual([]);
    expect(result.metadataNonPlainFindings).toEqual([]);
    expect(result.initialStateJsonRoundTrip).toBe(true);
    expect(result.sequenceStatesJsonRoundTrip).toBe(true);
    expect(result.metadataJsonRoundTrip).toBe(true);
    expect(result.recommendation).toBe('DIRECT_REDUX');
    expect(result.ok).toBe(true);
  });

  test('reports all required unsuitable runtime categories with paths', () => {
    class Example {}
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const sample = {
      fn: () => undefined,
      symbol: Symbol('c2'),
      bigint: 1n,
      missing: undefined,
      date: new Date(0),
      map: new Map(),
      set: new Set(),
      regexp: /c2/,
      promise: Promise.resolve(),
      thenable: { then: () => undefined },
      instance: new Example(),
      other: Object.create({ constructor: Object }) as object,
      cyclic,
      nan: Number.NaN,
      positiveInfinity: Number.POSITIVE_INFINITY,
      negativeInfinity: Number.NEGATIVE_INFINITY,
    };

    const audit = auditSerializability(sample);
    expect(audit.nonPlain).toEqual(expect.arrayContaining([
      { kind: 'function', path: '$.fn' },
      { kind: 'symbol', path: '$.symbol' },
      { kind: 'bigint', path: '$.bigint' },
      { kind: 'undefined', path: '$.missing' },
      { kind: 'date', path: '$.date' },
      { kind: 'map', path: '$.map' },
      { kind: 'set', path: '$.set' },
      { kind: 'regexp', path: '$.regexp' },
      { kind: 'promise-or-thenable', path: '$.promise' },
      { kind: 'promise-or-thenable', path: '$.thenable' },
      { kind: 'class-instance', path: '$.instance' },
      { kind: 'other-non-plain-object', path: '$.other' },
      { kind: 'cyclic-reference', path: '$.cyclic.self' },
    ]));
    expect(audit.jsonLossyNumbers).toEqual([
      { kind: 'non-finite-number', path: '$.nan' },
      { kind: 'non-finite-number', path: '$.positiveInfinity' },
      { kind: 'non-finite-number', path: '$.negativeInfinity' },
    ]);
  });
});
