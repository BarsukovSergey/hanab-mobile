export type KnownBot = { username: string; passwordJoin: boolean };

// Exact account names with verified open and password-protected table join.
export const knownBots: readonly KnownBot[] = [
  { username: 'jabot1', passwordJoin: true },
  { username: 'jabot2', passwordJoin: true },
  { username: 'jabot3', passwordJoin: true },
  { username: 'jabot4', passwordJoin: true },
  { username: 'michiel-bot-1', passwordJoin: true },
  { username: 'michiel-bot-2', passwordJoin: true },
  { username: 'potato_bot_1', passwordJoin: true },
  { username: 'potato_bot_2', passwordJoin: true },
  { username: 'potato_bot_3', passwordJoin: true },
  { username: 'potato_bot_4', passwordJoin: true },
  { username: 'ser1_bot', passwordJoin: true },
  { username: 'ser2_bot', passwordJoin: true },
  { username: 'ser3_bot', passwordJoin: true },
  { username: 'ser4_bot', passwordJoin: true },
  { username: 'will-bot1', passwordJoin: true },
  { username: 'will-bot2', passwordJoin: true },
  { username: 'will-bot4', passwordJoin: true },
  { username: 'will-bot67', passwordJoin: true },
  { username: 'will-bot69', passwordJoin: true },
];

export function normalizedBotName(name: string): string { return name.toLowerCase(); }

export function findKnownBotUser<T extends { name: string; status: number }>(
  name: string, users: readonly T[],
): T | undefined {
  return users.find((user) => normalizedBotName(user.name) === normalizedBotName(name));
}

export function isBotAtTable(name: string, players: readonly { name: string }[]): boolean {
  return players.some((player) => normalizedBotName(player.name) === normalizedBotName(name));
}

export function freeBotSlots(maxPlayers: number, playerCount: number): number {
  return Math.max(0, maxPlayers - playerCount);
}

export function isBotAvailableForTable(
  user: { status: number } | undefined,
  bot: KnownBot,
  protectedTable: boolean,
): boolean {
  return user?.status === 0 && (!protectedTable || bot.passwordJoin);
}

export function getVisibleBotSections<T extends { name: string; status: number }>(
  users: readonly T[], players: readonly { name: string }[],
): { available: { bot: KnownBot; user: T }[]; busy: { bot: KnownBot; user: T }[] } {
  const rows = knownBots.flatMap((bot) => {
    const user = findKnownBotUser(bot.username, users);
    return user === undefined || isBotAtTable(bot.username, players) ? [] : [{ bot, user }];
  });
  return {
    available: rows.filter(({ user }) => user.status === 0),
    busy: rows.filter(({ user }) => user.status !== 0),
  };
}

export function pruneBotSelection(
  selected: readonly string[],
  users: readonly { name: string; status: number }[],
  players: readonly { name: string }[],
  protectedTable: boolean,
  capacity: number,
  bots: readonly KnownBot[] = knownBots,
): string[] {
  return selected.filter((name) => {
    const bot = bots.find((entry) => normalizedBotName(entry.username) === normalizedBotName(name));
    return bot !== undefined
      && !isBotAtTable(name, players)
      && isBotAvailableForTable(findKnownBotUser(name, users), bot, protectedTable);
  }).slice(0, Math.max(0, capacity));
}
