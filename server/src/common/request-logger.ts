import { randomUUID } from 'crypto';
import { debugLog } from './debug-log';

type RequestLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  statusCode?: number;
  on: (event: 'finish', listener: () => void) => void;
};

type Next = () => void;

export function requestLogger(
  request: RequestLike,
  response: ResponseLike,
  next: Next,
) {
  const requestId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
  const method = request.method ?? 'UNKNOWN';
  const path = request.originalUrl ?? request.url ?? '';

  debugLog('http.request.start', {
    requestId,
    method,
    path,
    userAgent: headerValue(request.headers?.['user-agent']),
  });

  response.on('finish', () => {
    debugLog('http.request.finish', {
      requestId,
      method,
      path,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join(',') : value;
}

