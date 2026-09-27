import * as Clipboard from 'expo-clipboard';

export interface ClipboardActions { readClipboard(): Promise<string>; }
export type ReplayInputActions = ClipboardActions;

export const clipboardActions: ClipboardActions = {
  readClipboard: async () => await Clipboard.getStringAsync(),
};
export const replayInputActions = clipboardActions;
