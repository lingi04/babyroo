import type { AuthSession } from '../auth/types';
import type { BabyrooEvent, ReservationStatus } from '../data/events';
import type { Child, User, UserHomeAddress } from '../data/user';

export const BABYROO_API_BASE_URL = 'https://babyroo-api.vercel.app/api';
const DEFAULT_REQUEST_TIMEOUT_MS = 7000;
const DEFAULT_EVENT_LIST_LIMIT = 300;

export class BabyrooApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

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

type BabyrooApiUser = User & {
  createdAt?: string;
  updatedAt?: string;
};

export type BabyrooCreditBalance = {
  userId: string;
  available: number;
};

export type BabyrooCreditLedgerEntry = {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type BabyrooCreditPackage = {
  id: string;
  googlePlayProductId?: string;
  credits: number;
  priceKrw: number;
  label: string;
};

export type BabyrooCreditStatus = {
  balance: BabyrooCreditBalance;
  ledger: BabyrooCreditLedgerEntry[];
  packages: BabyrooCreditPackage[];
};

export type BabyrooCreditPurchase = {
  id: string;
  status: 'credited' | 'already_credited';
  package: BabyrooCreditPackage;
  balance: BabyrooCreditBalance;
  ledgerEntry: BabyrooCreditLedgerEntry;
};

export type BabyrooGooglePlayPurchaseInput = {
  productId: string;
  purchaseToken: string;
  packageName?: string;
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

export async function getEventFromBabyrooApi(
  id: string,
): Promise<BabyrooEvent> {
  const event = await getJson<BabyrooApiEvent>({
    path: `/events/${encodeURIComponent(id)}`,
  });

  return {
    ...event,
    tags: event.tags ?? [],
  };
}

export async function getCurrentUserFromBabyrooApi(
  accessToken: string,
): Promise<User> {
  const user = await getJson<BabyrooApiUser>({
    accessToken,
    path: '/users/me',
  });

  return toAppUser(user);
}

export async function updateCurrentUserInBabyrooApi({
  accessToken,
  user,
}: {
  accessToken: string;
  user: Partial<
    Pick<
      User,
      | 'activeChildIds'
      | 'displayName'
      | 'homeAddress'
      | 'homeRegion'
      | 'preferredLocalities'
    >
  >;
}): Promise<User> {
  const updatedUser = await patchJson<BabyrooApiUser>({
    accessToken,
    body: user,
    path: '/users/me',
  });

  return toAppUser(updatedUser);
}

export async function createChildInBabyrooApi({
  accessToken,
  child,
}: {
  accessToken: string;
  child: Omit<Child, 'id'>;
}): Promise<Child> {
  return postJson<Child>({
    accessToken,
    body: child,
    path: '/users/me/children',
  });
}

export async function updateChildInBabyrooApi({
  accessToken,
  childId,
  childPatch,
}: {
  accessToken: string;
  childId: string;
  childPatch: Partial<Omit<Child, 'id'>>;
}): Promise<Child> {
  return patchJson<Child>({
    accessToken,
    body: childPatch,
    path: `/users/me/children/${encodeURIComponent(childId)}`,
  });
}

export async function deleteChildFromBabyrooApi({
  accessToken,
  childId,
}: {
  accessToken: string;
  childId: string;
}): Promise<void> {
  await deleteJson({
    accessToken,
    path: `/users/me/children/${encodeURIComponent(childId)}`,
  });
}

export async function getCreditStatusFromBabyrooApi(
  accessToken: string,
): Promise<BabyrooCreditStatus> {
  return getJson<BabyrooCreditStatus>({
    accessToken,
    path: '/credits/status',
  });
}

export async function createCreditPurchaseInBabyrooApi({
  accessToken,
  packageId,
}: {
  accessToken: string;
  packageId: string;
}): Promise<BabyrooCreditPurchase> {
  return postJson<BabyrooCreditPurchase>({
    accessToken,
    body: {
      packageId,
    },
    path: '/credits/purchases',
  });
}

export async function verifyGooglePlayPurchaseInBabyrooApi({
  accessToken,
  purchase,
}: {
  accessToken: string;
  purchase: BabyrooGooglePlayPurchaseInput;
}): Promise<BabyrooCreditPurchase> {
  return postJson<BabyrooCreditPurchase>({
    accessToken,
    body: purchase,
    path: '/credits/google-play/verify',
  });
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

export async function patchJson<T>({
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
    method: 'PATCH',
    path,
    timeoutMs,
  });
}

export async function deleteJson<T = void>({
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
    method: 'DELETE',
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
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST';
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
    | { code?: string; message?: string; statusCode?: number }
    | T
    | null;

  if (!response.ok) {
    throw new BabyrooApiError(
      isErrorPayload(payload) && payload.message
        ? payload.message
        : `Babyroo API request failed with ${response.status}`,
      isErrorPayload(payload) && typeof payload.statusCode === 'number'
        ? payload.statusCode
        : response.status,
      isErrorPayload(payload) ? payload.code : undefined,
    );
  }

  return payload as T;
}

function isErrorPayload(
  payload: unknown,
): payload is { code?: string; message?: string; statusCode?: number } {
  return (
    typeof payload === 'object' && payload !== null && 'message' in payload
  );
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message.includes('aborted'))
  );
}

function toAppUser(user: BabyrooApiUser): User {
  return {
    id: user.id,
    displayName: user.displayName,
    children: user.children ?? [],
    activeChildIds: user.activeChildIds ?? [],
    homeRegion: user.homeRegion,
    homeAddress: user.homeAddress as UserHomeAddress | undefined,
    preferredLocalities: user.preferredLocalities ?? [],
  };
}
