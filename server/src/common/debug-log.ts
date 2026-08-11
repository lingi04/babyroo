export type DebugLogFields = Record<
  string,
  boolean | number | string | null | undefined
>;

export function debugLog(message: string, fields: DebugLogFields = {}) {
  if (!debugLogsEnabled()) {
    return;
  }

  const renderedFields = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  const suffix = renderedFields ? ` ${renderedFields}` : '';

  console.log(`[babyroo:debug] ${new Date().toISOString()} ${message}${suffix}`);
}

export function debugLogsEnabled() {
  return process.env.BABYROO_DEBUG_LOGS !== 'false';
}

