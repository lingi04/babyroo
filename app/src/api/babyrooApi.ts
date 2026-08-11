import { Platform } from 'react-native';

import type { AuthSession } from '../auth/types';
import type { BabyrooEvent, ReservationStatus } from '../data/events';

export const BABYROO_API_BASE_URL = defaultApiBaseUrl();
const DEFAULT_REQUEST_TIMEOUT_MS = 7000;
const DEFAULT_EVENT_LIST_LIMIT = 300;

export type BabyrooApiAuthResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  user: {
    id: string;
    displayName: string;
  };
};

type BabyrooApiEvent = {
  id: string;
  csvSequence: number;
  title: string;
  venueName: string;
  venueDetail?: string;
  imageUrl?: string;
  locality: string;
  region: string;
  category: string;
  source: string;
  startsAt: string;
  endsAt: string;
  ageMinMonths?: number;
  ageMaxMonths?: number;
  indoor?: boolean;
  priceText?: string;
  priceType: 'free' | 'paid' | 'unknown';
  reservationRequired?: boolean;
  reservationStatus: ReservationStatus;
  guardianRequired?: boolean;
  tags: string[];
  summary: string;
  sourceUrl: string;
};

type BabyrooApiEventListResponse = {
  count: number;
  events: BabyrooApiEvent[];
};

export type BabyrooEventListQuery = Partial<{
  q: string;
  region: string;
  locality: string;
  startsBefore: string;
  endsAfter: string;
  childAgeMonths: number;
  priceType: BabyrooEvent['priceType'];
  indoor: boolean;
  reservationRequired: boolean;
  reservationStatus: ReservationStatus;
  category: string;
  eventType: string;
  limit: number;
  offset: number;
}>;

export async function loginWithBabyrooApi(
  session: AuthSession,
): Promise<BabyrooApiAuthResponse> {
  return postJson<BabyrooApiAuthResponse>({
    body: {
      idToken: session.idToken ?? session.providerUserId,
      displayName: session.displayName,
    },
    path: '/auth/google',
  });
}

export async function listEventsFromBabyrooApi(
  query: BabyrooEventListQuery = {},
): Promise<BabyrooEvent[]> {
  const queryString = eventListQueryString({
    limit: DEFAULT_EVENT_LIST_LIMIT,
    ...query,
  });
  console.warn(
    `[Babyroo API] listEventsFromBabyrooApi called: ${BABYROO_API_BASE_URL}/events?${queryString}`,
  );
  debugger;
  const response = await getJson<BabyrooApiEventListResponse>({
    path: `/events?${queryString}`,
  });
  console.warn(
    `[Babyroo API] listEventsFromBabyrooApi success: ${response.events.length} events`,
  );

  return response.events.map(event => ({
    ...event,
    tags: event.tags ?? [],
  }));
}

function eventListQueryString(query: BabyrooEventListQuery) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    params.set(key, String(value));
  });

  return params.toString();
}

export async function getJson<T>({
  accessToken,
  path,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: {
  accessToken?: string;
  path: string;
  timeoutMs?: number;
}): Promise<T> {
  return requestJson<T>({
    accessToken,
    method: 'GET',
    path,
    timeoutMs,
  });
}

export async function postJson<T>({
  accessToken,
  body,
  path,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: {
  accessToken?: string;
  body: unknown;
  path: string;
  timeoutMs?: number;
}): Promise<T> {
  return requestJson<T>({
    accessToken,
    body,
    method: 'POST',
    path,
    timeoutMs,
  });
}

async function requestJson<T>({
  accessToken,
  body,
  method,
  path,
  timeoutMs,
}: {
  accessToken?: string;
  body?: unknown;
  method: 'GET' | 'POST';
  path: string;
  timeoutMs: number;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(`${BABYROO_API_BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        `Babyroo API request timed out after ${timeoutMs}ms: ${BABYROO_API_BASE_URL}${path}`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | T
    | null;

  if (!response.ok) {
    throw new Error(
      isErrorPayload(payload) && payload.message
        ? payload.message
        : `Babyroo API request failed with ${response.status}`,
    );
  }

  return payload as T;
}

function defaultApiBaseUrl() {
  if (Platform.OS === 'android') {
    return 'http://172.30.1.90:3000/api';
  }

  return 'http://127.0.0.1:3000/api';
}

function isErrorPayload(payload: unknown): payload is { message?: string } {
  return typeof payload === 'object' && payload !== null && 'message' in payload;
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message.includes('aborted'))
  );
}
