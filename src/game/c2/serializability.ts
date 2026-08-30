export type SerializabilityFindingKind =
  | 'bigint'
  | 'class-instance'
  | 'cyclic-reference'
  | 'date'
  | 'function'
  | 'map'
  | 'non-finite-number'
  | 'other-non-plain-object'
  | 'promise-or-thenable'
  | 'regexp'
  | 'set'
  | 'symbol'
  | 'undefined';

export type SerializabilityFinding = {
  kind: SerializabilityFindingKind;
  path: string;
};

export type SerializabilityAudit = {
  nonPlain: SerializabilityFinding[];
  jsonLossyNumbers: SerializabilityFinding[];
};

function childPath(parent: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

function isPromiseOrThenable(value: object): boolean {
  return value instanceof Promise
    || ('then' in value
      && typeof (value as { then?: unknown }).then === 'function');
}

export function auditSerializability(value: unknown): SerializabilityAudit {
  const nonPlain: SerializabilityFinding[] = [];
  const jsonLossyNumbers: SerializabilityFinding[] = [];
  const ancestors = new Set<object>();

  function visit(current: unknown, path: string): void {
    if (current === null || typeof current === 'string' || typeof current === 'boolean') {
      return;
    }

    if (typeof current === 'number') {
      if (!Number.isFinite(current)) {
        jsonLossyNumbers.push({ kind: 'non-finite-number', path });
      }
      return;
    }

    if (typeof current === 'undefined' || typeof current === 'function'
      || typeof current === 'symbol' || typeof current === 'bigint') {
      nonPlain.push({ kind: typeof current, path } as SerializabilityFinding);
      return;
    }

    if (typeof current !== 'object') {
      nonPlain.push({ kind: 'other-non-plain-object', path });
      return;
    }

    if (ancestors.has(current)) {
      nonPlain.push({ kind: 'cyclic-reference', path });
      return;
    }

    if (current instanceof Date) {
      nonPlain.push({ kind: 'date', path });
      return;
    }
    if (current instanceof Map) {
      nonPlain.push({ kind: 'map', path });
      return;
    }
    if (current instanceof Set) {
      nonPlain.push({ kind: 'set', path });
      return;
    }
    if (current instanceof RegExp) {
      nonPlain.push({ kind: 'regexp', path });
      return;
    }
    if (isPromiseOrThenable(current)) {
      nonPlain.push({ kind: 'promise-or-thenable', path });
      return;
    }

    const prototype = Object.getPrototypeOf(current);
    if (!Array.isArray(current) && prototype !== Object.prototype && prototype !== null) {
      const kind = prototype?.constructor !== undefined
        && prototype.constructor !== Object
        ? 'class-instance'
        : 'other-non-plain-object';
      nonPlain.push({ kind, path });
      return;
    }

    ancestors.add(current);
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else {
      for (const key of Object.keys(current)) {
        visit((current as Record<string, unknown>)[key], childPath(path, key));
      }
    }
    ancestors.delete(current);
  }

  visit(value, '$');
  return { nonPlain, jsonLossyNumbers };
}

export function structuralDataEquals(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (typeof left !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => structuralDataEquals(value, right[index]));
  }
  const leftKeys = Object.keys(left as object);
  const rightKeys = Object.keys(right as object);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index]
      && structuralDataEquals(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key],
      ));
}

export function jsonRoundTrips(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    return serialized !== undefined
      && structuralDataEquals(value, JSON.parse(serialized) as unknown);
  } catch {
    return false;
  }
}
