export type KnownBot = { username: string; passwordJoin: boolean };

// Exact account names supplied for this registry. Protected-table join is unverified.
export const knownBots: readonly KnownBot[] = [
  { username: 'jabot1', passwordJoin: false },
  { username: 'jabot2', passwordJoin: false },
  { username: 'jabot3', passwordJoin: false },
  { username: 'jabot4', passwordJoin: false },
  { username: 'michiel-bot-1', passwordJoin: false },
  { username: 'michiel-bot-2', passwordJoin: false },
  { username: 'potato_bot_1', passwordJoin: false },
  { username: 'potato_bot_2', passwordJoin: false },
  { username: 'potato_bot_3', passwordJoin: false },
  { username: 'potato_bot_4', passwordJoin: false },
  { username: 'ser1_bot', passwordJoin: false },
  { username: 'ser2_bot', passwordJoin: false },
  { username: 'ser3_bot', passwordJoin: false },
  { username: 'ser4_bot', passwordJoin: false },
  { username: 'will-bot1', passwordJoin: false },
  { username: 'will-bot2', passwordJoin: false },
  { username: 'will-bot4', passwordJoin: false },
  { username: 'will-bot67', passwordJoin: false },
  { username: 'will-bot69', passwordJoin: false },
];

export function normalizedBotName(name: string): string { return name.toLowerCase(); }

export function isBotOnline(name: string, users: readonly { name: string }[]): boolean {
  return users.some((user) => normalizedBotName(user.name) === normalizedBotName(name));
}

export function isBotAtTable(name: string, players: readonly { name: string }[]): boolean {
  return players.some((player) => normalizedBotName(player.name) === normalizedBotName(name));
}

export function freeBotSlots(maxPlayers: number, playerCount: number): number {
  return Math.max(0, maxPlayers - playerCount);
}
