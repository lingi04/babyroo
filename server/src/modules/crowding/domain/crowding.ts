import { createHash } from 'node:crypto';

export const CROWDING_LEVELS = ['여유', '보통', '약간 붐빔', '붐빔'] as const;
export type CrowdingLevel = (typeof CROWDING_LEVELS)[number];
export const CROWDING_SOURCE_URL =
  'https://data.seoul.go.kr/dataList/OA-21285/A/1/datasetView.do';
export type AreaSupport = { id: string; name: string; revision: string };
export type VenueLocation = {
  id: string;
  venueName: string | null;
  venueDetail: string | null;
  address: string | null;
  locality: string | null;
  region: string | null;
  publicationStatus: string;
};
export type Area = {
  id: string;
  name: string;
  boundaryVersion: string;
  boundaryUrl: string;
  active: boolean;
  enabled: boolean;
  intervalMinutes: number;
  revision: number;
  nextDueAt: Date;
  leaseToken: string | null;
  leaseUntil: Date | null;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  failures: number;
  updatedAt: Date;
};
export type ObservedArea = Area & {
  level: string | null;
  observedAt: Date | null;
  fetchedAt: Date | null;
  quality: string | null;
};
export type Observation = {
  level: CrowdingLevel;
  observedAt: Date;
  quality: string | null;
};
export type Mapping = { eventId: string; areaId: string; fingerprint: string };
export type ResolvedVenue = {
  event: VenueLocation;
  mapping: Mapping | null;
  area: ObservedArea | null;
};

export function locationFingerprint(
  event: VenueLocation,
  boundaryVersion: string,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        event.id,
        event.venueName,
        event.venueDetail,
        event.address,
        event.locality,
        event.region,
        boundaryVersion,
      ]),
    )
    .digest('hex');
}

export function verifiedSupport(
  venue: Omit<ResolvedVenue, 'area'> & {
    area: Pick<Area, 'id' | 'name' | 'active' | 'boundaryVersion'> | null;
  },
): AreaSupport | undefined {
  const { event, mapping, area } = venue;
  if (
    event.publicationStatus !== 'published' ||
    !mapping ||
    !area?.active ||
    mapping.fingerprint !== locationFingerprint(event, area.boundaryVersion)
  )
    return undefined;
  return { id: area.id, name: area.name, revision: mapping.fingerprint };
}

export function isPreviousKoreaHour(observedAt: Date, now: Date): boolean {
  // Korea is UTC+09:00 with whole-hour boundaries, so epoch-hour comparison is equivalent.
  return (
    Math.floor(observedAt.getTime() / 3_600_000) <
    Math.floor(now.getTime() / 3_600_000)
  );
}
