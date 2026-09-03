import { z } from 'zod';

import {
  cardIdentitiesSchema,
  finishOngoingGameSchema,
  gameActionListSchema,
  gameHistorySchema,
  gameInitSchema,
  incrementalGameActionSchema,
  noteListPlayerSchema,
  noteListSchema,
  noteSchema,
  pauseSchema,
  clockSchema,
} from './gameProtocol';
import { voteChangeSchema } from './terminationProtocol';
import { isVariantNameSupported } from '../game/client/supportedVariants';

const idSchema = z.number().int().nonnegative();

const tableIDCommandSchema = z.object({
  tableID: idSchema,
});

export const chatCommandSchema = z.object({
  msg: z.string().trim().min(1).max(300),
  room: z.string().regex(/^(?:lobby|table\d+)$/),
}).strict();

export type ChatCommand = z.infer<typeof chatCommandSchema>;

// Exact payload emitted by the pinned Go server. Go serializes who/recipient even when empty.
export const chatMessageSchema = z.object({
  msg: z.string().min(1),
  who: z.string(),
  discord: z.boolean(),
  server: z.boolean(),
  datetime: z.string().min(1),
  room: z.string().min(1).optional(),
  recipient: z.string(),
}).strict().readonly();

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatListSchema = z.object({
  list: z.array(chatMessageSchema).readonly(),
  unread: z.number().int(),
}).strict().readonly();

export type ChatList = z.infer<typeof chatListSchema>;

const supportedVariantNameSchema = z.string().min(1).refine(isVariantNameSupported);

export const tableOptionsSchema = z.object({
  variantName: z.string().min(1),
  timed: z.boolean(),
  timeBase: z.number().int().nonnegative(),
  timePerTurn: z.number().int().nonnegative(),
  speedrun: z.boolean(),
  cardCycle: z.boolean(),
  deckPlays: z.boolean(),
  emptyClues: z.boolean(),
  oneExtraCard: z.boolean(),
  oneLessCard: z.boolean(),
  allOrNothing: z.boolean(),
  detrimentalCharacters: z.boolean(),
}).passthrough();

export type TableOptions = z.infer<typeof tableOptionsSchema>;

export type MobileTableOptions = Pick<TableOptions,
  'variantName' | 'timed' | 'timeBase' | 'timePerTurn'
  | 'cardCycle' | 'emptyClues' | 'oneExtraCard' | 'oneLessCard' | 'allOrNothing'>;

function timedValuesAreValid(options: Pick<TableOptions,
  'timed' | 'timeBase' | 'timePerTurn'>): boolean {
  return options.timed
    ? Number.isInteger(options.timeBase)
      && options.timeBase >= 1
      && options.timeBase <= 604_800
      && Number.isInteger(options.timePerTurn)
      && options.timePerTurn >= 1
      && options.timePerTurn <= 86_400
    : options.timeBase === 0 && options.timePerTurn === 0;
}

const mobileTableOptionsSchema = z.object({
  variantName: supportedVariantNameSchema,
  timed: z.boolean(),
  timeBase: z.number().int(),
  timePerTurn: z.number().int(),
  cardCycle: z.boolean(),
  emptyClues: z.boolean(),
  oneExtraCard: z.boolean(),
  oneLessCard: z.boolean(),
  allOrNothing: z.boolean(),
}).superRefine((options, context) => {
  if (options.oneExtraCard && options.oneLessCard) {
    context.addIssue({ code: 'custom', message: 'extra and less card are mutually exclusive' });
  }
  if (options.timed) {
    if (options.timeBase < 1 || options.timeBase > 604_800) {
      context.addIssue({ code: 'custom', message: 'timeBase must be 1..604800 when timed' });
    }
    if (options.timePerTurn < 1 || options.timePerTurn > 86_400) {
      context.addIssue({ code: 'custom', message: 'timePerTurn must be 1..86400 when timed' });
    }
  } else if (options.timeBase !== 0 || options.timePerTurn !== 0) {
    context.addIssue({ code: 'custom', message: 'untimed values must be zero' });
  }
});

const unavailableTableOptions = {
  speedrun: false,
  deckPlays: false,
  detrimentalCharacters: false,
} as const;

export const tableCreateCommandSchema = z.object({
  name: z.string().trim().min(1).max(45),
  options: tableOptionsSchema,
  password: z.string(),
  maxPlayers: z.number().int().min(2).max(6),
}).refine(({ options }) => isVariantNameSupported(options.variantName)
  && !(options.oneExtraCard && options.oneLessCard)
  && timedValuesAreValid(options));

export type TableCreateCommand = z.infer<typeof tableCreateCommandSchema>;

export const tableStartCommandSchema = z.object({
  tableID: idSchema,
  intendedPlayers: z.array(z.string().min(1)).min(2),
});

export type TableStartCommand = z.infer<typeof tableStartCommandSchema>;

export const tableJoinCommandSchema = tableIDCommandSchema.extend({
  password: z.string().optional(),
}).strict();
export type TableJoinCommand = z.infer<typeof tableJoinCommandSchema>;

export const tableLeaveCommandSchema = tableIDCommandSchema;
export type TableLeaveCommand = z.infer<typeof tableLeaveCommandSchema>;

export const tableUnattendCommandSchema = tableIDCommandSchema;
export type TableUnattendCommand = z.infer<typeof tableUnattendCommandSchema>;

export const tableSpectateCommandSchema = z.object({
  tableID: idSchema,
  shadowingPlayerIndex: z.number().int(),
});

export type TableSpectateCommand = z.infer<typeof tableSpectateCommandSchema>;

export const tableReattendCommandSchema = tableIDCommandSchema;
export type TableReattendCommand = z.infer<typeof tableReattendCommandSchema>;

export const replayActionCommandSchema = z.object({
  tableID: idSchema,
  type: z.literal(0),
  segment: z.number().int().nonnegative(),
}).strict();

export const tableRestartCommandSchema = z.object({
  tableID: idSchema,
  hidePregame: z.boolean(),
}).strict();

export const tableUpdateCommandSchema = z.object({
  tableID: idSchema,
  name: z.string().trim().min(1).max(45),
  options: tableOptionsSchema,
  maxPlayers: z.number().int().min(2).max(6),
}).refine(({ options }) => isVariantNameSupported(options.variantName)
  && !(options.oneExtraCard && options.oneLessCard)
  && timedValuesAreValid(options));

export const tableSetLeaderCommandSchema = z.object({
  tableID: idSchema,
  name: z.string().min(1),
}).strict();

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

// The pinned Go BootMessage intentionally has no json tag.
export const bootSchema = z.object({
  TableID: idSchema,
}).strict();

export type Boot = z.infer<typeof bootSchema>;

export const replaySegmentSchema = z.object({
  tableID: idSchema,
  segment: z.number().int().nonnegative(),
}).strict();

export const replayLeaderSchema = z.object({
  tableID: idSchema,
  name: z.string().min(1),
}).strict();

export const spectatorSchema = z.object({
  name: z.string().min(1),
  shadowingPlayerIndex: z.number().int().min(-1),
  // The Go server emits an empty string when the spectator is not shadowing.
  shadowingPlayerUsername: z.string(),
}).strict();

export type Spectator = z.infer<typeof spectatorSchema>;

export const spectatorsSchema = z.object({
  tableID: idSchema,
  spectators: z.array(spectatorSchema).readonly(),
}).strict();

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
  options: tableOptionsSchema,
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

export const connectedSchema = z.object({
  tableID: idSchema,
  list: z.array(z.boolean()).readonly(),
}).strict().readonly();

export const userInactiveSchema = z.object({
  userID: idSchema,
  inactive: z.boolean(),
}).strict().readonly();

export const inactiveCommandSchema = z.object({
  inactive: z.boolean(),
}).strict();

export const lobbyTableSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  numPlayers: z.number().int().nonnegative(),
  maxPlayers: z.number().int().positive(),
  running: z.boolean(),
  variant: z.string().min(1),
  options: tableOptionsSchema,
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
  totalGames: z.number().int().nonnegative(),
  playingAtTables: z.array(idSchema),
  disconSpectatingTable: idSchema.optional(),
  disconShadowingSeat: z.number().int().optional(),
});

export type Welcome = z.infer<typeof welcomeSchema>;

export const historyGetCommandSchema = z.object({
  offset: z.number().int().nonnegative(),
  amount: z.literal(10),
}).strict();

export const replayCreateCommandSchema = z.object({
  source: z.literal('id'),
  databaseID: z.number().int().positive(),
  visibility: z.literal('solo'),
}).strict();

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
  noteListPlayer: noteListPlayerSchema,
  noteList: noteListSchema,
  note: noteSchema,
  pause: pauseSchema,
  clock: clockSchema,
  connected: connectedSchema,
  userInactive: userInactiveSchema,
  voteChange: voteChangeSchema,
  gameHistory: gameHistorySchema,
  cardIdentities: cardIdentitiesSchema,
  finishOngoingGame: finishOngoingGameSchema,
  replaySegment: replaySegmentSchema,
  replayLeader: replayLeaderSchema,
  spectators: spectatorsSchema,
  boot: bootSchema,
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

export function encodeReplayActionFrame(tableID: number, segment: number): string {
  const payload = replayActionCommandSchema.parse({ tableID, type: 0, segment });
  return encodeClientFrame('replayAction', payload);
}

export function encodeTableRestartFrame(tableID: number, hidePregame = true): string {
  const payload = tableRestartCommandSchema.parse({ tableID, hidePregame });
  return encodeClientFrame('tableRestart', payload);
}

export function encodeTableJoinFrame(tableID: number, password?: string): string {
  const payload = tableJoinCommandSchema.parse({ tableID, password });
  return encodeClientFrame('tableJoin', payload);
}

export function encodeTableLeaveFrame(tableID: number): string {
  const payload = tableLeaveCommandSchema.parse({ tableID });
  return encodeClientFrame('tableLeave', payload);
}

export function encodeTableUnattendFrame(tableID: number): string {
  const payload = tableUnattendCommandSchema.parse({ tableID });
  return encodeClientFrame('tableUnattend', payload);
}

export function encodeTableCreateFrame(
  name: string,
  maxPlayers: number,
  options: MobileTableOptions | string,
  password = '',
): string {
  const exposed = mobileTableOptionsSchema.parse(typeof options === 'string' ? {
    variantName: options,
    timed: false,
    timeBase: 0,
    timePerTurn: 0,
    cardCycle: false,
    emptyClues: false,
    oneExtraCard: false,
    oneLessCard: false,
    allOrNothing: false,
  } : options);
  const payload = tableCreateCommandSchema.parse({
    name,
    options: {
      variantName: exposed.variantName,
      timed: exposed.timed,
      timeBase: exposed.timeBase,
      timePerTurn: exposed.timePerTurn,
      speedrun: unavailableTableOptions.speedrun,
      cardCycle: exposed.cardCycle,
      deckPlays: unavailableTableOptions.deckPlays,
      emptyClues: exposed.emptyClues,
      oneExtraCard: exposed.oneExtraCard,
      oneLessCard: exposed.oneLessCard,
      allOrNothing: exposed.allOrNothing,
      detrimentalCharacters: unavailableTableOptions.detrimentalCharacters,
    },
    password,
    maxPlayers,
  });
  return encodeClientFrame('tableCreate', payload);
}

export function encodeTableUpdateFrame(
  tableID: number,
  name: string,
  maxPlayers: number,
  existingOptions: TableOptions,
  changes: MobileTableOptions,
): string {
  const exposed = mobileTableOptionsSchema.parse(changes);
  const payload = tableUpdateCommandSchema.parse({
    tableID,
    name,
    maxPlayers,
    options: { ...existingOptions, ...exposed },
  });
  return encodeClientFrame('tableUpdate', payload);
}

export function encodeTableSetLeaderFrame(tableID: number, name: string): string {
  const payload = tableSetLeaderCommandSchema.parse({ tableID, name });
  return encodeClientFrame('tableSetLeader', payload);
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

export function encodeInactiveFrame(inactive: boolean): string {
  return encodeClientFrame('inactive', inactiveCommandSchema.parse({ inactive }));
}

export function encodeHistoryGetFrame(offset: number, amount = 10): string {
  return encodeClientFrame('historyGet', historyGetCommandSchema.parse({ offset, amount }));
}

export function encodeReplayCreateFrame(databaseID: number): string {
  return encodeClientFrame('replayCreate', replayCreateCommandSchema.parse({
    source: 'id', databaseID, visibility: 'solo',
  }));
}
