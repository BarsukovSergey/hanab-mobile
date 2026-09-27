import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

export interface ReplayExportActions {
  copy(text: string): Promise<void>;
  share(url: string): Promise<void>;
}

export const replayExportActions: ReplayExportActions = {
  copy: async (text) => { await Clipboard.setStringAsync(text); },
  share: async (url) => { await Share.share({ message: url, url }); },
};
