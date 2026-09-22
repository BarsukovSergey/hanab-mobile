import type { ReadableChatMessage } from '../store/chatSlice';

type ChatMetadataMessage = Pick<ReadableChatMessage, 'recipient' | 'server' | 'who'>;

export function chatMessageMetadata(
  message: ChatMetadataMessage,
  authenticatedUsername: string | null | undefined,
): string {
  if (message.recipient.length > 0) {
    const incoming = authenticatedUsername !== null
      && authenticatedUsername !== undefined
      && message.recipient.toLocaleLowerCase() === authenticatedUsername.toLocaleLowerCase();
    return incoming ? `[PM from ${message.who}]` : `[PM to ${message.recipient}]`;
  }
  return `${message.server ? 'Server' : message.who}:`;
}
