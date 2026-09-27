import type { ClipboardActions } from '../platform/replayInputActions';

export async function copyHistorySeed(seed: string, clipboard: ClipboardActions): Promise<boolean> {
  try {
    await clipboard.writeClipboard(seed);
    return true;
  } catch {
    return false;
  }
}
