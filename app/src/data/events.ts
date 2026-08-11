export type ReservationStatus = 'unknown' | 'available' | 'limited' | 'closed';

export type BabyrooEvent = {
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

const eventsByCsvOrder: BabyrooEvent[] = [];

export const eventsNewestFirst = [...eventsByCsvOrder].reverse();
