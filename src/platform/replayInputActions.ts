import * as Clipboard from 'expo-clipboard';

export interface ClipboardActions {
  readClipboard(): Promise<string>;
  writeClipboard(value: string): Promise<void>;
}
export type ReplayInputActions = ClipboardActions;

export const clipboardActions: ClipboardActions = {
  readClipboard: async () => await Clipboard.getStringAsync(),
  writeClipboard: async (value) => { await Clipboard.setStringAsync(value); },
};
export const replayInputActions = clipboardActions;
