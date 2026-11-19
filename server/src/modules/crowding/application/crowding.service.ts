import {
  ApplicationError,
  NotFoundError,
} from '../../../common/application-error';
import {
  CROWDING_SOURCE_URL,
  isPreviousKoreaHour,
  locationFingerprint,
  verifiedSupport,
} from '../domain/crowding';
import {
  CatalogInput,
  CrowdingProvider,
  CrowdingStore,
  SettingsInput,
} from './ports';

function text(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= max
  );
}
function bad(message: string): never {
  throw new ApplicationError('INVALID_CROWDING_INPUT', message, 400);
}

export class CrowdingService {
  constructor(
    private readonly store: CrowdingStore,
    private readonly provider: CrowdingProvider,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async current(eventId: string) {
    let venue = await this.store.venue(eventId);
    if (!venue || venue.event.publicationStatus !== 'published')
      throw new NotFoundError('Event not found');
    let support = verifiedSupport(venue);
    if (!support) return { supported: false as const };
    await this.refresh(support.id, false);
    // A location/mapping may change while the provider request is in flight.
    venue = await this.store.venue(eventId);
    if (!venue || venue.event.publicationStatus !== 'published')
      throw new NotFoundError('Event not found');
    support = verifiedSupport(venue);
    if (!support || !venue.area) return { supported: false as const };
    const area = venue.area;
    const now = this.clock();
    return {
      supported: true as const,
      area: support,
      serverNow: now.toISOString(),
      level: area.level,
      observedAt: area.observedAt?.toISOString() ?? null,
      lastSuccessAt: area.lastSuccessAt?.toISOString() ?? null,
      state: !area.observedAt
        ? 'unavailable'
        : isPreviousKoreaHour(area.observedAt, now)
        ? 'last_known'
        : 'current',
      refreshFailed: Boolean(area.lastError),
      quality: area.quality,
      attribution: { name: '서울특별시 공공데이터', url: CROWDING_SOURCE_URL },
    };
  }

  async refresh(id: string, dueOnly: boolean) {
    const area = await this.store.claim(id, this.clock(), dueOnly);
    if (!area) return 'skipped' as const;
    try {
      const observation = await this.provider.read(area, this.clock());
      await this.store.finish(area, observation, false, this.clock());
      return 'succeeded' as const;
    } catch {
      // Never expose/log provider errors: URLs may contain the API key.
      await this.store.finish(area, null, true, this.clock());
      return 'failed' as const;
    }
  }
  async collect() {
    const due = await this.store.due(this.clock(), 5);
    const results = await Promise.allSettled(
      due.map(area => this.refresh(area.id, true)),
    );
    return {
      attempted: due.length,
      completed: results.filter(
        r => r.status === 'fulfilled' && r.value === 'succeeded',
      ).length,
      failed: results.filter(
        r => r.status === 'rejected' || r.value === 'failed',
      ).length,
      skipped: results.filter(
        r => r.status === 'fulfilled' && r.value === 'skipped',
      ).length,
    };
  }
  list() {
    return this.store.list();
  }
  private validateCatalog(input: CatalogInput) {
    if (
      !input ||
      !text(input.id, 32) ||
      !/^[A-Z0-9_-]+$/.test(input.id) ||
      !text(input.name, 120) ||
      !text(input.boundaryVersion, 120) ||
      !text(input.boundaryUrl, 2048)
    ) {
      bad('Area code, name and official boundary reference are required');
    }
    try {
      const url = new URL(input.boundaryUrl);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'data.seoul.go.kr' ||
        url.username ||
        url.password
      )
        bad('Use an official Seoul HTTPS boundary URL');
    } catch {
      bad('Use an official Seoul HTTPS boundary URL');
    }
    return {
      id: input.id.trim(),
      name: input.name.trim(),
      boundaryVersion: input.boundaryVersion.trim(),
      boundaryUrl: input.boundaryUrl.trim(),
    };
  }
  create(input: CatalogInput, actorId: string) {
    return this.store.create(this.validateCatalog(input), actorId);
  }
  updateCatalog(input: CatalogInput, revision: number, actorId: string) {
    if (!Number.isInteger(revision) || revision < 1)
      bad('Area revision required');
    return this.store.updateCatalog(
      this.validateCatalog(input),
      revision,
      actorId,
    );
  }
  async settings(input: SettingsInput, actorId: string) {
    if (
      !input ||
      !Number.isInteger(input.intervalMinutes) ||
      input.intervalMinutes < 1 ||
      input.intervalMinutes > 1440 ||
      (input.enabled !== undefined && typeof input.enabled !== 'boolean') ||
      (input.active !== undefined && typeof input.active !== 'boolean') ||
      !input.revisions ||
      typeof input.revisions !== 'object' ||
      Array.isArray(input.revisions) ||
      Object.keys(input.revisions).length > 500 ||
      Object.values(input.revisions).some(
        value => !Number.isInteger(value) || value < 1 || value > 2147483647,
      ) ||
      (input.ids !== 'all' &&
        (!Array.isArray(input.ids) ||
          !input.ids.length ||
          input.ids.length > 500 ||
          input.ids.some(id => !text(id, 32)) ||
          new Set(input.ids).size !== input.ids.length))
    )
      bad('Invalid collection settings');
    await this.store.settings(input, actorId, this.clock());
  }
  async mappingInfo(eventId: string, areaId: string) {
    if (!text(eventId, 200) || !text(areaId, 32))
      bad('Event and area are required');
    const venue = await this.store.venue(eventId);
    const area = await this.store.get(areaId);
    if (!venue || !area?.active)
      throw new NotFoundError('Event or active area not found');
    return {
      event: venue.event,
      area,
      fingerprint: locationFingerprint(venue.event, area.boundaryVersion),
      verified: verifiedSupport(venue),
      mapping: venue.mapping,
    };
  }
  async verify(
    eventId: string,
    input: {
      areaId: string;
      evidence: string;
      fingerprint: string;
      confirmedInside: boolean;
    },
    actorId: string,
  ) {
    if (
      !input ||
      !text(input.areaId, 32) ||
      !text(input.evidence, 2000) ||
      !text(input.fingerprint, 64) ||
      !/^[a-f0-9]{64}$/.test(input.fingerprint) ||
      input.confirmedInside !== true
    ) {
      bad(
        'Verify the venue against the official boundary and provide evidence',
      );
    }
    await this.store.verify(
      eventId,
      input.areaId,
      input.evidence.trim(),
      input.fingerprint,
      actorId,
    );
  }
  unmap(eventId: string, actorId: string) {
    return this.store.unmap(eventId, actorId);
  }
}
