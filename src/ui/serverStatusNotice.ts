export function getServerStatusNoticeMessage(status: {
  shuttingDown: boolean;
  maintenanceMode: boolean;
}): string | null {
  const message = [
    status.maintenanceMode
      ? 'Server maintenance is active. Starting new games may be unavailable.' : null,
    status.shuttingDown
      ? 'The server is restarting or shutting down soon.' : null,
  ].filter((item): item is string => item !== null).join(' ');
  return message === '' ? null : message;
}
