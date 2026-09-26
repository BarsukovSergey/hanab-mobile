import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { getServerStatusNoticeMessage } from './serverStatusNotice';

const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');

describe('global server status notice source contract', () => {
  test('surfaces authoritative status in the app shell and live game shell', () => {
    expect(app).toContain('getServerStatusNoticeMessage(session.serverStatus)');
    expect(app).toContain('{probe === \'valid\' && serverStatusMessage !== null && <Notice>');
    expect(app).toContain('{serverStatusMessage !== null && (');
    expect(app).not.toContain('Dismiss server status');
  });

  test('returns no notice when status is inactive and preserves active messages', () => {
    expect(getServerStatusNoticeMessage({ shuttingDown: false, maintenanceMode: false })).toBeNull();
    expect(getServerStatusNoticeMessage({ shuttingDown: false, maintenanceMode: true }))
      .toBe('Server maintenance is active. Starting new games may be unavailable.');
    expect(getServerStatusNoticeMessage({ shuttingDown: true, maintenanceMode: false }))
      .toBe('The server is restarting or shutting down soon.');
    expect(getServerStatusNoticeMessage({ shuttingDown: true, maintenanceMode: true }))
      .toBe('Server maintenance is active. Starting new games may be unavailable. '
        + 'The server is restarting or shutting down soon.');
  });
});
