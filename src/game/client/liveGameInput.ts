export type LiveGameInputResult =
  | { kind: 'liveGame'; tableID: number }
  | { kind: 'invalid'; reason: string };

export function parseLiveGameInput(value: string): LiveGameInputResult {
  const invalid = (reason: string): LiveGameInputResult => ({ kind: 'invalid', reason });
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { return invalid('Enter a canonical hanab.live running game link.'); }

  const authority = value.trim().match(/^https:\/\/([^/?#]+)/i)?.[1];
  if (url.protocol !== 'https:' || url.hostname !== 'hanab.live' || authority === undefined
    || authority.includes(':') || url.username !== '' || url.password !== '') {
    return invalid('Use an HTTPS link from hanab.live with no port.');
  }
  const match = url.pathname.match(/^\/game\/([1-9]\d*)\/?$/);
  if (match === null) return invalid('Use a running game link in the form https://hanab.live/game/123.');
  const tableID = Number(match[1]);
  if (!Number.isSafeInteger(tableID) || tableID <= 0) return invalid('The table ID must be a positive safe integer.');
  return { kind: 'liveGame', tableID };
}
