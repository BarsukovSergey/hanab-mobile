import { z } from 'zod';

const tableIDSchema = z.number().int().nonnegative();

export const terminationCommandSchema = z.object({
  tableID: tableIDSchema,
}).strict();

export const voteChangeSchema = z.object({
  vote: z.boolean(),
}).strict().readonly();

export type VoteChange = z.infer<typeof voteChangeSchema>;

export function encodeVoteForTerminationFrame(tableID: number): string {
  return `tableVoteForTermination ${JSON.stringify(terminationCommandSchema.parse({ tableID }))}`;
}

export function encodeTableTerminateFrame(tableID: number): string {
  return `tableTerminate ${JSON.stringify(terminationCommandSchema.parse({ tableID }))}`;
}
