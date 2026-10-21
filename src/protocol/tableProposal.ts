import { areTableOptionsSupported } from '../game/client/supportedVariants';

import {
  tableUpdateCommandSchema,
  type ChatMessage,
  type MobileTableOptions,
  type TableOptions,
} from './lobbyProtocol';

export type TableProposal = {
  name: string;
  maxPlayers: number;
  options: MobileTableOptions;
};

type ProposalMessage = Pick<ChatMessage, 'server' | 'msg'>;

// This is the exact markup emitted by the pinned server's table-update proposal path.
// It is deliberately parsed as data only; React Native never renders this markup.
const PINNED_NEW_OPTIONS_MESSAGE = /^<span class="cp"><button class="new-options" data-new-options="([^\"]*)">click to apply the suggestion<\/button><\/span>$/;

function parseServerNewOptions(message: ProposalMessage): Record<string, unknown> | null {
  if (!message.server) return null;
  const match = PINNED_NEW_OPTIONS_MESSAGE.exec(message.msg);
  const encodedOptions = match?.[1];
  if (encodedOptions === undefined) return null;

  let candidate: unknown;
  try {
    candidate = JSON.parse(encodedOptions.replaceAll("'", '"'));
  } catch {
    return null;
  }
  if (candidate === null || typeof candidate !== 'object') return null;
  return candidate as Record<string, unknown>;
}

// Display-only: recognizing a name does not make the proposed options applicable.
export function parseServerProposedVariantName(message: ProposalMessage): string | null {
  const variantName = parseServerNewOptions(message)?.variantName;
  return typeof variantName === 'string' && variantName.trim().length > 0
    && variantName.length <= 256 ? variantName : null;
}

export function parseServerTableProposal(message: ProposalMessage): TableProposal | null {
  const candidate = parseServerNewOptions(message);
  if (candidate === null) return null;

  const { tableName, maxPlayers, ...options } = candidate;
  const parsed = tableUpdateCommandSchema.safeParse({
    tableID: 0,
    name: tableName,
    maxPlayers,
    options,
  });
  if (!parsed.success || !areTableOptionsSupported(parsed.data.options)) return null;

  return {
    name: parsed.data.name,
    maxPlayers: parsed.data.maxPlayers,
    options: {
      variantName: parsed.data.options.variantName,
      timed: parsed.data.options.timed,
      timeBase: parsed.data.options.timeBase,
      timePerTurn: parsed.data.options.timePerTurn,
      cardCycle: parsed.data.options.cardCycle,
      emptyClues: parsed.data.options.emptyClues,
      oneExtraCard: parsed.data.options.oneExtraCard,
      oneLessCard: parsed.data.options.oneLessCard,
      allOrNothing: parsed.data.options.allOrNothing,
    },
  };
}

export function tableProposalMatches(
  proposal: TableProposal,
  table: { name: string; maxPlayers: number; options: TableOptions },
): boolean {
  return proposal.name === table.name
    && proposal.maxPlayers === table.maxPlayers
    && proposal.options.variantName === table.options.variantName
    && proposal.options.timed === table.options.timed
    && proposal.options.timeBase === table.options.timeBase
    && proposal.options.timePerTurn === table.options.timePerTurn
    && proposal.options.cardCycle === table.options.cardCycle
    && proposal.options.emptyClues === table.options.emptyClues
    && proposal.options.oneExtraCard === table.options.oneExtraCard
    && proposal.options.oneLessCard === table.options.oneLessCard
    && proposal.options.allOrNothing === table.options.allOrNothing;
}
