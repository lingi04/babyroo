export type ReservationStatus = 'unknown' | 'available' | 'limited' | 'closed';
export type PublicationStatus = 'draft' | 'published' | 'hidden' | 'archived';

export type BabyrooEvent = {
  id: string;
  csvSequence?: number;
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
  publicationStatus?: PublicationStatus;
  guardianRequired?: boolean;
  tags: string[];
  summary: string;
  sourceUrl: string;
};

export type EventListQuery = {
  q?: string;
  region?: string;
  locality?: string;
  startsBefore?: string;
  endsAfter?: string;
  childAgeMonths?: string;
  priceType?: BabyrooEvent['priceType'];
  indoor?: string;
  reservationRequired?: string;
  reservationStatus?: ReservationStatus;
  category?: string;
  eventType?: string;
  limit?: string;
  offset?: string;
};

export type EventListResult = {
  count: number;
  events: BabyrooEvent[];
};
