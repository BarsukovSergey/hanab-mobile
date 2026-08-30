export type WireObservation = {
  command: string;
  payloadByteCount: number;
  parsedPayload?: unknown;
};

export function observeWireMessage(frame: string): WireObservation | null {
  const firstSpace = frame.indexOf(' ');
  const command = firstSpace === -1 ? frame : frame.slice(0, firstSpace);
  const payload = firstSpace === -1 ? '' : frame.slice(firstSpace + 1);

  if (command.length === 0 || /\s/.test(command)) {
    return null;
  }

  const observation: WireObservation = {
    command,
    payloadByteCount: new Blob([payload]).size,
  };

  if (payload.length > 0) {
    try {
      observation.parsedPayload = JSON.parse(payload) as unknown;
    } catch {
      // C1 observes malformed/unexpected payloads without creating a protocol layer.
    }
  }

  return observation;
}

export function countArrayPayload(payload: unknown): number | null {
  return Array.isArray(payload) ? payload.length : null;
}
