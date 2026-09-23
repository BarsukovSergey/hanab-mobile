import type { ReadableChatMessage } from '../store/chatSlice';

type ChatMetadataMessage = Pick<ReadableChatMessage, 'recipient' | 'server' | 'who'>;

export function sessionPrivateMessages(
  messagesByRoom: Record<string, readonly ReadableChatMessage[]>,
  authenticatedUsername: string | null | undefined,
  username: string,
): ReadableChatMessage[] {
  if (!authenticatedUsername) return [];
  const self = authenticatedUsername.toLocaleLowerCase();
  const other = username.toLocaleLowerCase();
  const messages = Object.values(messagesByRoom).flatMap((roomMessages) => roomMessages)
    .filter((message) => message.source === 'live'
      && message.recipient.length > 0
      && ((message.who.toLocaleLowerCase() === self
          && message.recipient.toLocaleLowerCase() === other)
        || (message.who.toLocaleLowerCase() === other
          && message.recipient.toLocaleLowerCase() === self)));
  return messages.map((message, index) => ({ message, index, time: Date.parse(message.datetime) }))
    .sort((left, right) => {
      const leftValid = Number.isFinite(left.time);
      const rightValid = Number.isFinite(right.time);
      if (leftValid && rightValid && left.time !== right.time) return left.time - right.time;
      if (leftValid !== rightValid) return leftValid ? -1 : 1;
      return left.index - right.index;
    })
    .map(({ message }) => message);
}

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
