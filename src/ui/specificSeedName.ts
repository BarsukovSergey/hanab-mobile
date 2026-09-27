const MAX_TABLE_NAME_LENGTH = 45;
const SEED_COMMAND_PREFIX = '!seed ';

export function createSpecificSeedTableName(seedSuffix: string): string | null {
  const suffix = seedSuffix.trim();
  if (suffix.length === 0) return null;

  const name = `${SEED_COMMAND_PREFIX}${suffix}`;
  return name.length <= MAX_TABLE_NAME_LENGTH ? name : null;
}
