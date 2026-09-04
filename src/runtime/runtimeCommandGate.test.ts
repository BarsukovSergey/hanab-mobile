import { describe, expect, test } from '@jest/globals';

import { createRuntimeCommandGate } from './runtimeCommandGate';

describe('createRuntimeCommandGate', () => {
  test('blocks only named methods while a suppression lease is active', () => {
    const calls: string[] = [];
    const target = {
      send(value: string) {
        calls.push(`send:${value}`);
        return true;
      },
      lifecycle(value: string) {
        calls.push(`lifecycle:${value}`);
        return true;
      },
    };
    const gate = createRuntimeCommandGate(target, ['send']);

    expect(gate.runtime.send('before')).toBe(true);
    const release = gate.suppress();
    expect(gate.isSuppressed()).toBe(true);
    expect(gate.runtime.send('blocked')).toBe(false);
    expect(gate.runtime.lifecycle('active')).toBe(true);
    release();
    expect(gate.isSuppressed()).toBe(false);
    expect(gate.runtime.send('after')).toBe(true);

    expect(calls).toEqual(['send:before', 'lifecycle:active', 'send:after']);
  });

  test('uses nested leases and makes release idempotent', () => {
    const target = { mutate: () => true };
    const gate = createRuntimeCommandGate(target, ['mutate']);
    const releaseA = gate.suppress();
    const releaseB = gate.suppress();

    releaseA();
    releaseA();
    expect(gate.isSuppressed()).toBe(true);
    expect(gate.runtime.mutate()).toBe(false);

    releaseB();
    expect(gate.isSuppressed()).toBe(false);
    expect(gate.runtime.mutate()).toBe(true);
  });
});
