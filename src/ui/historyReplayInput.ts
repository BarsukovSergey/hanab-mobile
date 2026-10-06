import { parseReplayInput, type ReplayInputResult, type ReplayVisibility } from '../game/client/replayInput';

/** Presentation adapter: keep link semantics in the existing parser and JSON behind Advanced. */
export function parseHistoryReplayInput(
  input: string,
  visibility: ReplayVisibility,
  advanced: boolean,
): ReplayInputResult {
  const value = input.trim();
  if (!advanced && /^\d+$/.test(value)) {
    const route = visibility === 'shared' ? 'shared-replay' : 'replay';
    return parseReplayInput(`https://hanab.live/${route}/${value}`, visibility);
  }
  if (!advanced && !/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    return { kind: 'invalid', reason: 'Enter a replay link or database ID. Use Advanced for raw JSON.' };
  }
  return parseReplayInput(input, visibility);
}
