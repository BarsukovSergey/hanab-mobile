export type RuntimeCommandGate<T extends object> = {
  readonly runtime: T;
  suppress(): () => void;
  isSuppressed(): boolean;
};

export function createRuntimeCommandGate<T extends object>(
  target: T,
  blockedMethods: readonly (keyof T)[],
): RuntimeCommandGate<T> {
  const blocked = new Set<PropertyKey>(blockedMethods as readonly PropertyKey[]);
  let suppressionDepth = 0;

  const runtime = new Proxy(target, {
    get(currentTarget, property, receiver) {
      const value = Reflect.get(currentTarget, property, receiver);
      if (typeof value !== 'function') return value;

      if (blocked.has(property)) {
        return (...args: unknown[]) => {
          if (suppressionDepth > 0) return false;
          return Reflect.apply(value, currentTarget, args);
        };
      }

      return value.bind(currentTarget);
    },
  });

  return {
    runtime,
    suppress() {
      suppressionDepth += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        suppressionDepth = Math.max(0, suppressionDepth - 1);
      };
    },
    isSuppressed() {
      return suppressionDepth > 0;
    },
  };
}
