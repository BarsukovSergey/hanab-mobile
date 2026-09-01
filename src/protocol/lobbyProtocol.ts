import { z } from 'zod';

import {
  gameActionListSchema,
  gameInitSchema,
  incrementalGameActionSchema,
} from './gameProtocol';

const idSchema = z.number().int().nonnegative();

const tableIDCommandSchema = z.object({
  tableID: idSchema,
});

export const chatCommandSchema = z.object({
  msg: z.string().trim().min(1).max(300),
  room: z.string().regex(/^(?:lobby|table\d+)$/),
}).strict();

export type ChatCommand = z.infer<typeof chatCommandSchema>;

// Exact schemas from packages/data/src/serverCommands.ts at the pinned upstream commit.
export const chatMessageSchema = z.object({
  msg: z.string().min(1),
  who: z.string().min(1).optional(),
  discord: z.boolean(),
  server: z.boolean(),
  datetime: z.string().min(1),
  room: z.string().min(1).optional(),
  recipient: z.string().min(1).optional(),
}).strict().readonly();

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatListSchema = z.object({
  list: z.array(chatMessageSchema).readonly(),
  unread: z.number().int(),
}).strict().readonly();

export type ChatList = z.infer<typeof chatListSchema>;

export const BASIC_VARIANT_NAMES = [
  'No Variant',
  '6 Suits',
  'Black (6 Suits)',
  'Rainbow (6 Suits)',
] as const;

export const tableCreateCommandSchema = z.object({
  name: z.string().trim().min(1).max(45),
  options: z.object({
    variantName: z.enum(BASIC_VARIANT_NAMES),
    timed: z.literal(false),
    timeBase: z.literal(0),
    timePerTurn: z.literal(0),
    speedrun: z.literal(false),
    cardCycle: z.literal(false),
    deckPlays: z.literal(false),
    emptyClues: z.literal(false),
    oneExtraCard: z.literal(false),
    oneLessCard: z.literal(false),
    allOrNothing: z.literal(false),
    detrimentalCharacters: z.literal(false),
  }),
  password: z.literal(''),
  maxPlayers: z.number().int().min(2).max(6),
});

export type TableCreateCommand = z.infer<typeof tableCreateCommandSchema>;

export const tableStartCommandSchema = z.object({
  tableID: idSchema,
  intendedPlayers: z.array(z.string().min(1)).min(2),
});

export type TableStartCommand = z.infer<typeof tableStartCommandSchema>;

export const tableJoinCommandSchema = tableIDCommandSchema;
export type TableJoinCommand = z.infer<typeof tableJoinCommandSchema>;

export const tableLeaveCommandSchema = tableIDCommandSchema;
export type TableLeaveCommand = z.infer<typeof tableLeaveCommandSchema>;

export const tableSpectateCommandSchema = z.object({
  tableID: idSchema,
  shadowingPlayerIndex: z.number().int(),
});

export type TableSpectateCommand = z.infer<typeof tableSpectateCommandSchema>;

export const tableReattendCommandSchema = tableIDCommandSchema;
export type TableReattendCommand = z.infer<typeof tableReattendCommandSchema>;

export const tableStartSchema = z.object({
  tableID: idSchema,
  replay: z.boolean(),
});

export type TableStart = z.infer<typeof tableStartSchema>;

export const tableJoinedSchema = z.object({
  tableID: idSchema,
});

export type TableJoined = z.infer<typeof tableJoinedSchema>;

// The pinned Go server intentionally emits the exported field name because
// TableLeftMessage.TableID has no json tag.
export const tableLeftSchema = z.object({
  TableID: idSchema,
});

export type TableLeft = z.infer<typeof tableLeftSchema>;

const pregamePlayerSchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string().min(1),
  you: z.boolean(),
  present: z.boolean(),
});

export const pregameGameSchema = z.object({
  tableID: idSchema,
  name: z.string().min(1),
  owner: idSchema,
  players: z.array(pregamePlayerSchema),
  options: z.object({
    variantName: z.string().min(1),
  }),
  passwordProtected: z.boolean(),
  maxPlayers: z.number().int().positive(),
});

export type PregameGame = z.infer<typeof pregameGameSchema>;

export const lobbyUserSchema = z.object({
  userID: idSchema,
  name: z.string().min(1),
  status: z.number().int().min(0).max(5),
  tableID: idSchema.optional(),
  hyphenated: z.boolean(),
  inactive: z.boolean(),
});

export type LobbyUser = z.infer<typeof lobbyUserSchema>;

export const lobbyTableSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  numPlayers: z.number().int().nonnegative(),
  maxPlayers: z.number().int().positive(),
  running: z.boolean(),
  variant: z.string().min(1),
  passwordProtected: z.boolean(),
  joined: z.boolean(),
  progress: z.number().int().nonnegative(),
  players: z.array(z.string().min(1)),
  sharedReplay: z.boolean(),
});

export type LobbyTable = z.infer<typeof lobbyTableSchema>;

export const welcomeSchema = z.object({
  userID: idSchema,
  username: z.string().min(1),
  playingAtTables: z.array(idSchema),
  disconSpectatingTable: idSchema.optional(),
  disconShadowingSeat: z.number().int().optional(),
});

export type Welcome = z.infer<typeof welcomeSchema>;

const schemas = {
  welcome: welcomeSchema,
  userList: z.array(lobbyUserSchema),
  user: lobbyUserSchema,
  userLeft: z.object({ userID: idSchema }),
  tableList: z.array(lobbyTableSchema),
  table: lobbyTableSchema,
  tableGone: z.object({ tableID: idSchema }),
  game: pregameGameSchema,
  joined: tableJoinedSchema,
  left: tableLeftSchema,
  tableStart: tableStartSchema,
  init: gameInitSchema,
  gameActionList: gameActionListSchema,
  gameAction: incrementalGameActionSchema,
  chat: chatMessageSchema,
  chatList: chatListSchema,
  warning: z.object({ warning: z.string().min(1) }),
  error: z.object({ error: z.string().min(1) }),
} as const;

export type KnownServerCommand = keyof typeof schemas;

export type ServerEvent = {
  [Command in KnownServerCommand]: {
    command: Command;
    data: z.infer<(typeof schemas)[Command]>;
  };
}[KnownServerCommand];

export type DecodeResult =
  | { kind: 'event'; event: ServerEvent }
  | { kind: 'unknown'; command: string }
  | {
      kind: 'malformed';
      command: string | null;
      issue: 'empty-command' | 'missing-payload' | 'malformed-json' | 'invalid-payload';
    };

function isKnownCommand(command: string): command is KnownServerCommand {
  return Object.prototype.hasOwnProperty.call(schemas, command);
}

/** Decode one hanab.live frame by splitting on the first ASCII space only. */
export function decodeServerFrame(frame: string): DecodeResult {
  const firstSpace = frame.indexOf(' ');
  const command = firstSpace === -1 ? frame : frame.slice(0, firstSpace);

  if (command.length === 0 || /\s/.test(command)) {
    return { kind: 'malformed', command: null, issue: 'empty-command' };
  }

  if (!isKnownCommand(command)) {
    return { kind: 'unknown', command };
  }

  if (firstSpace === -1 || firstSpace === frame.length - 1) {
    return { kind: 'malformed', command, issue: 'missing-payload' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(frame.slice(firstSpace + 1)) as unknown;
  } catch {
    return { kind: 'malformed', command, issue: 'malformed-json' };
  }

  const result = schemas[command].safeParse(payload);
  if (!result.success) {
    return { kind: 'malformed', command, issue: 'invalid-payload' };
  }

  return {
    kind: 'event',
    event: { command, data: result.data } as ServerEvent,
  };
}

export function encodeClientFrame(command: string, payload?: unknown): string {
  return payload === undefined ? command : `${command} ${JSON.stringify(payload)}`;
}

export function encodeTableSpectateFrame(
  tableID: number,
  shadowingPlayerIndex = -1,
): string {
  const payload = tableSpectateCommandSchema.parse({
    tableID,
    shadowingPlayerIndex,
  });
  return encodeClientFrame('tableSpectate', payload);
}

export function encodeTableReattendFrame(tableID: number): string {
  const payload = tableReattendCommandSchema.parse({ tableID });
  return encodeClientFrame('tableReattend', payload);
}

export function encodeTableJoinFrame(tableID: number): string {
  const payload = tableJoinCommandSchema.parse({ tableID });
  return encodeClientFrame('tableJoin', payload);
}

export function encodeTableLeaveFrame(tableID: number): string {
  const payload = tableLeaveCommandSchema.parse({ tableID });
  return encodeClientFrame('tableLeave', payload);
}

export function encodeTableCreateFrame(
  name: string,
  maxPlayers: number,
  variantName: string,
): string {
  const payload = tableCreateCommandSchema.parse({
    name,
    options: {
      variantName,
      timed: false,
      timeBase: 0,
      timePerTurn: 0,
      speedrun: false,
      cardCycle: false,
      deckPlays: false,
      emptyClues: false,
      oneExtraCard: false,
      oneLessCard: false,
      allOrNothing: false,
      detrimentalCharacters: false,
    },
    password: '',
    maxPlayers,
  });
  return encodeClientFrame('tableCreate', payload);
}

export function encodeTableStartFrame(
  tableID: number,
  intendedPlayers: readonly string[],
): string {
  const payload = tableStartCommandSchema.parse({ tableID, intendedPlayers });
  return encodeClientFrame('tableStart', payload);
}

export function encodeChatFrame(msg: string, room: string): string {
  const payload = chatCommandSchema.parse({ msg, room });
  return encodeClientFrame('chat', payload);
}
