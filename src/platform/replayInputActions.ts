import * as Clipboard from 'expo-clipboard';

export interface ReplayInputActions { readClipboard(): Promise<string>; }

export const replayInputActions: ReplayInputActions = {
  readClipboard: async () => await Clipboard.getStringAsync(),
};
