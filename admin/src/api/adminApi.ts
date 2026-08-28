export type PublicationStatus = 'draft' | 'published' | 'hidden' | 'archived';
export type ReservationStatus = 'unknown' | 'available' | 'limited' | 'closed';
export type PriceType = 'free' | 'paid' | 'unknown';

export type AdminSession = {
  accessToken: string;
  tokenType: 'Bearer';
  adminUser: {
    id: string;
    email: string;
    displayName: string | null;
  };
};

export type AdminEvent = {
  id: string;
  csvSequence: number | null;
  title: string;
  venueName: string | null;
  venueDetail: string | null;
  address: string | null;
  imageUrl: string | null;
  locality: string | null;
  region: string | null;
  category: string | null;
  source: string;
  sourceEventId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  indoor: boolean | null;
  priceText: string | null;
  priceType: PriceType;
  reservationRequired: boolean | null;
  reservationStatus: ReservationStatus;
  guardianRequired: boolean | null;
  strollerFriendly: boolean | null;
  nursingRoom: boolean | null;
  parking: boolean | null;
  tags: string[];
  summary: string | null;
  sourceUrl: string;
  lastCheckedAt: string | null;
  publicationStatus: PublicationStatus;
  adminUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventListQuery = Partial<{
  q: string;
  publicationStatus: PublicationStatus | 'all';
  source: string;
  category: string;
  region: string;
  locality: string;
  reservationStatus: ReservationStatus;
  startsFrom: string;
  startsTo: string;
  endsFrom: string;
  endsTo: string;
  createdFrom: string;
  createdTo: string;
  limit: number;
  offset: number;
}>;

export type EventListResponse = {
  count: number;
  events: AdminEvent[];
};

export type EventMutationInput = Partial<
  Omit<AdminEvent, 'id' | 'csvSequence' | 'adminUpdatedAt' | 'createdAt' | 'updatedAt'>
>;

export type ApiValidationError = {
  message: string;
  errors?: Record<string, string>;
};

const API_BASE_URL =
  import.meta.env.VITE_BABYROO_API_BASE_URL ?? 'http://localhost:3000/api';

export async function loginAdminWithGoogle(idToken: string): Promise<AdminSession> {
  return request<AdminSession>('/admin/auth/google', {
    method: 'POST',
    body: { idToken },
  });
}

export async function listAdminEvents(
  accessToken: string,
  query: EventListQuery,
): Promise<EventListResponse> {
  return request<EventListResponse>(`/admin/events?${queryString(query)}`, {
    accessToken,
  });
}

export async function getAdminEvent(
  accessToken: string,
  id: string,
): Promise<AdminEvent> {
  return request<AdminEvent>(`/admin/events/${encodeURIComponent(id)}`, {
    accessToken,
  });
}

export async function createAdminEvent(
  accessToken: string,
  event: EventMutationInput,
): Promise<AdminEvent> {
  return request<AdminEvent>('/admin/events', {
    accessToken,
    method: 'POST',
    body: event,
  });
}

export async function updateAdminEvent(
  accessToken: string,
  id: string,
  event: EventMutationInput,
): Promise<AdminEvent> {
  return request<AdminEvent>(`/admin/events/${encodeURIComponent(id)}`, {
    accessToken,
    method: 'PATCH',
    body: event,
  });
}

export async function changeAdminEventStatus(
  accessToken: string,
  id: string,
  status: Exclude<PublicationStatus, 'draft'>,
): Promise<AdminEvent> {
  return request<AdminEvent>(`/admin/events/${encodeURIComponent(id)}/${statusAction(status)}`, {
    accessToken,
    method: 'POST',
  });
}

export async function uploadEventImage(
  accessToken: string,
  file: File,
  eventId?: string,
): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append(eventId ? 'eventId' : 'tempId', eventId ?? crypto.randomUUID());

  return request<{ imageUrl: string }>('/admin/uploads/event-image', {
    accessToken,
    body: formData,
    method: 'POST',
  });
}

async function request<T>(
  path: string,
  options: {
    accessToken?: string;
    method?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
  };
  const isFormData = options.body instanceof FormData;
  if (options.body && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body
      ? isFormData
        ? options.body as FormData
        : JSON.stringify(options.body)
      : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    const error = new Error(payload?.message ?? `Request failed: ${response.status}`);
    Object.assign(error, {
      statusCode: response.status,
      errors: payload?.errors,
    });
    throw error;
  }

  return response.json() as Promise<T>;
}

function queryString(query: EventListQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

function statusAction(status: Exclude<PublicationStatus, 'draft'>): string {
  if (status === 'published') return 'publish';
  if (status === 'hidden') return 'hide';
  return 'archive';
}
