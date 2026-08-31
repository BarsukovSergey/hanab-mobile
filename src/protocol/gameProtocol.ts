import { z } from 'zod';

import {
  cardOrder,
  colorIndex,
  numPlayers,
  playerIndex,
  rank,
  rankClueNumber,
  suitIndex,
} from '../game/bootstrap/upstreamSchemas';

const idSchema = z.number().int().nonnegative();
const unknownSuitSchema = z.union([suitIndex, z.literal(-1)]);
const unknownRankSchema = z.union([rank, z.literal(-1)]);
const playerOrFinishedSchema = z.union([playerIndex, z.literal(-1)]);

const tableIDCommandSchema = z.object({ tableID: idSchema });

export const getGameInfo1CommandSchema = tableIDCommandSchema;
export const getGameInfo2CommandSchema = tableIDCommandSchema;
export const loadedCommandSchema = tableIDCommandSchema;

export const playGameplayActionSchema = z.object({
  tableID: idSchema,
  type: z.literal(0),
  target: cardOrder,
});

export const discardGameplayActionSchema = z.object({
  tableID: idSchema,
  type: z.literal(1),
  target: cardOrder,
});

export const colorClueGameplayActionSchema = z.object({
  tableID: idSchema,
  type: z.literal(2),
  target: playerIndex,
  value: colorIndex,
});

export const rankClueGameplayActionSchema = z.object({
  tableID: idSchema,
  type: z.literal(3),
  target: playerIndex,
  value: rankClueNumber,
});

export const clientGameplayActionSchema = z.discriminatedUnion('type', [
  playGameplayActionSchema,
  discardGameplayActionSchema,
  colorClueGameplayActionSchema,
  rankClueGameplayActionSchema,
]);

export type ClientGameplayAction = z.infer<typeof clientGameplayActionSchema>;
export type PlayGameplayAction = z.infer<typeof playGameplayActionSchema>;
export type DiscardGameplayAction = z.infer<typeof discardGameplayActionSchema>;
export type ColorClueGameplayAction = z.infer<typeof colorClueGameplayActionSchema>;
export type RankClueGameplayAction = z.infer<typeof rankClueGameplayActionSchema>;

const wireOptionsSchema = z.object({
  numPlayers,
  startingPlayer: playerIndex,
  variantID: z.number().int().nonnegative(),
  variantName: z.string().min(1),
  timed: z.boolean(),
  timeBase: z.number(),
  timePerTurn: z.number().int(),
  speedrun: z.boolean(),
  cardCycle: z.boolean(),
  deckPlays: z.boolean(),
  emptyClues: z.boolean(),
  oneExtraCard: z.boolean(),
  oneLessCard: z.boolean(),
  allOrNothing: z.boolean(),
  detrimentalCharacters: z.boolean(),
  tableName: z.string().min(1).optional(),
  maxPlayers: numPlayers.optional(),
}).passthrough();

export const gameInitSchema = z.object({
  tableID: idSchema,
  playerNames: z.array(z.string().min(1)),
  ourPlayerIndex: playerIndex,
  spectating: z.boolean(),
  shadowing: z.boolean(),
  replay: z.boolean(),
  databaseID: z.number().int(),
  hasCustomSeed: z.boolean(),
  seed: z.string(),
  datetimeStarted: z.string().min(1),
  datetimeFinished: z.string().min(1),
  options: wireOptionsSchema,
  characterAssignments: z.array(z.number().int().min(-1)),
  characterMetadata: z.array(z.number().int()),
  sharedReplay: z.boolean(),
  sharedReplayLeader: z.string(),
  sharedReplaySegment: z.number().int().nonnegative(),
  sharedReplayEffMod: z.number().int(),
  paused: z.boolean(),
  pausePlayerIndex: playerOrFinishedSchema,
  pauseQueued: z.boolean(),
}).passthrough().superRefine((data, context) => {
  const count = data.options.numPlayers;
  if (data.playerNames.length !== count) {
    context.addIssue({ code: 'custom', message: 'playerNames length must equal numPlayers' });
  }
  if (data.characterAssignments.length !== 0 && data.characterAssignments.length !== count) {
    context.addIssue({ code: 'custom', message: 'characterAssignments length must be zero or numPlayers' });
  }
  if (data.characterMetadata.length !== 0 && data.characterMetadata.length !== count) {
    context.addIssue({ code: 'custom', message: 'characterMetadata length must be zero or numPlayers' });
  }
  if (data.ourPlayerIndex >= count) {
    context.addIssue({ code: 'custom', message: 'ourPlayerIndex must name an active seat' });
  }
});

export type GameInit = z.infer<typeof gameInitSchema>;

const cardIdentityActionSchema = z.object({
  type: z.literal('cardIdentity'),
  playerIndex,
  order: cardOrder,
  suitIndex: unknownSuitSchema,
  rank: unknownRankSchema,
}).passthrough();

const clueActionSchema = z.object({
  type: z.literal('clue'),
  clue: z.discriminatedUnion('type', [
    z.object({ type: z.literal(0), value: colorIndex }).passthrough(),
    z.object({ type: z.literal(1), value: rankClueNumber }).passthrough(),
  ]),
  giver: playerIndex,
  list: z.array(cardOrder),
  target: playerIndex,
  turn: z.number().int().nonnegative(),
}).passthrough();

const discardActionSchema = z.object({
  type: z.literal('discard'),
  playerIndex,
  order: cardOrder,
  suitIndex: unknownSuitSchema,
  rank: unknownRankSchema,
  failed: z.boolean(),
}).passthrough();

const drawActionSchema = z.object({
  type: z.literal('draw'),
  playerIndex,
  order: cardOrder,
  suitIndex: unknownSuitSchema,
  rank: unknownRankSchema,
}).passthrough();

const gameOverActionSchema = z.object({
  type: z.literal('gameOver'),
  endCondition: z.number().int().min(0).max(10),
  playerIndex: playerOrFinishedSchema,
  votes: z.array(playerIndex).nullable(),
}).passthrough();

const playActionSchema = z.object({
  type: z.literal('play'),
  playerIndex,
  order: cardOrder,
  suitIndex: unknownSuitSchema,
  rank: unknownRankSchema,
}).passthrough();

const playerTimesActionSchema = z.object({
  type: z.literal('playerTimes'),
  playerTimes: z.array(z.number().int()),
  duration: z.number().int(),
}).passthrough();

const strikeActionSchema = z.object({
  type: z.literal('strike'),
  num: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  order: cardOrder,
  turn: z.number().int().nonnegative(),
}).passthrough();

// The pinned Go server appends status records to g.Actions. The pinned game reducer
// intentionally treats them as no-ops, but bootstrap must accept and count them.
const statusActionSchema = z.object({
  type: z.literal('status'),
  clues: z.number().int(),
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
}).passthrough();

const turnActionSchema = z.object({
  type: z.literal('turn'),
  num: z.number().int().nonnegative(),
  currentPlayerIndex: playerOrFinishedSchema,
}).passthrough();

export const wireGameActionSchema = z.discriminatedUnion('type', [
  cardIdentityActionSchema,
  clueActionSchema,
  discardActionSchema,
  drawActionSchema,
  gameOverActionSchema,
  playActionSchema,
  playerTimesActionSchema,
  strikeActionSchema,
  statusActionSchema,
  turnActionSchema,
]);

export type WireGameAction = z.infer<typeof wireGameActionSchema>;

export const gameActionListSchema = z.object({
  tableID: idSchema,
  list: z.array(wireGameActionSchema),
}).passthrough();

export type GameActionList = z.infer<typeof gameActionListSchema>;

export const incrementalGameActionSchema = z.object({
  tableID: idSchema,
  action: wireGameActionSchema,
}).passthrough();

export type IncrementalGameAction = z.infer<typeof incrementalGameActionSchema>;

function encodeTableCommand(
  command: 'getGameInfo1' | 'getGameInfo2' | 'loaded',
  tableID: number,
): string {
  return `${command} ${JSON.stringify(tableIDCommandSchema.parse({ tableID }))}`;
}

export function encodeGetGameInfo1Frame(tableID: number): string {
  return encodeTableCommand('getGameInfo1', tableID);
}

export function encodeGetGameInfo2Frame(tableID: number): string {
  return encodeTableCommand('getGameInfo2', tableID);
}

export function encodeLoadedFrame(tableID: number): string {
  return encodeTableCommand('loaded', tableID);
}

function encodeGameplayAction(action: unknown): string {
  return `action ${JSON.stringify(clientGameplayActionSchema.parse(action))}`;
}

export function encodePlayFrame(tableID: number, target: number): string {
  return encodeGameplayAction({ tableID, type: 0, target });
}

export function encodeDiscardFrame(tableID: number, target: number): string {
  return encodeGameplayAction({ tableID, type: 1, target });
}

export function encodeColorClueFrame(
  tableID: number,
  target: number,
  value: number,
): string {
  return encodeGameplayAction({ tableID, type: 2, target, value });
}

export function encodeRankClueFrame(
  tableID: number,
  target: number,
  value: number,
): string {
  return encodeGameplayAction({ tableID, type: 3, target, value });
}
