import type { MobileTableOptions } from '../protocol/lobbyProtocol';

export type BooleanMobileTableOption = Exclude<keyof MobileTableOptions,
  'variantName' | 'timeBase' | 'timePerTurn'>;

export function toggleMobileTableBooleanOption(
  options: MobileTableOptions,
  key: BooleanMobileTableOption,
): MobileTableOptions {
  const value = !options[key];
  return {
    ...options,
    [key]: value,
    ...(key === 'timed' ? value
      ? {
          timeBase: options.timeBase === 0 ? 120 : options.timeBase,
          timePerTurn: options.timePerTurn === 0 ? 20 : options.timePerTurn,
        }
      : { timeBase: 0, timePerTurn: 0 } : {}),
    ...(key === 'oneExtraCard' && value ? { oneLessCard: false } : {}),
    ...(key === 'oneLessCard' && value ? { oneExtraCard: false } : {}),
  };
}
