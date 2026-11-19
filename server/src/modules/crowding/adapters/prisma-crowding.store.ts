import { randomUUID } from 'node:crypto';
import { getPrismaClient } from '../../../common/prisma-client';
import { ApplicationError } from '../../../common/application-error';
import {
  CrowdingStore,
  CatalogInput,
  SettingsInput,
} from '../application/ports';
import {
  Area,
  ObservedArea,
  Observation,
  ResolvedVenue,
  locationFingerprint,
} from '../domain/crowding';

export class PrismaCrowdingStore implements CrowdingStore {
  private get db() {
    return getPrismaClient();
  }
  private async withLatest(area: Area): Promise<ObservedArea> {
    const observation = await this.db.crowdingObservation.findFirst({
      where: { areaId: area.id, boundaryVersion: area.boundaryVersion },
      orderBy: { observedAt: 'desc' },
    });
    return {
      ...area,
      level: observation?.level ?? null,
      observedAt: observation?.observedAt ?? null,
      fetchedAt: observation?.fetchedAt ?? null,
      quality: observation?.quality ?? null,
    };
  }
  async list() {
    const areas = await this.db.crowdingArea.findMany({
      orderBy: { name: 'asc' },
    });
    return Promise.all(areas.map(area => this.withLatest(area)));
  }
  async get(id: string) {
    const area = await this.db.crowdingArea.findUnique({ where: { id } });
    return area ? this.withLatest(area) : null;
  }
  async venue(eventId: string): Promise<ResolvedVenue | null> {
    const row = await this.db.event.findUnique({
      where: { id: eventId },
      include: { crowdingMapping: { include: { area: true } } },
    });
    return row
      ? {
          event: row,
          mapping: row.crowdingMapping,
          area: row.crowdingMapping?.area
            ? await this.withLatest(row.crowdingMapping.area)
            : null,
        }
      : null;
  }
  async create(input: CatalogInput, actorId: string) {
    return this.db.$transaction(async tx => {
      if (await tx.crowdingArea.findUnique({ where: { id: input.id } })) {
        throw new ApplicationError('AREA_EXISTS', 'Area already exists', 409);
      }
      const area = await tx.crowdingArea.create({ data: input });
      await tx.crowdingAudit.create({
        data: {
          id: randomUUID(),
          actorId,
          action: 'create_area',
          details: input,
        },
      });
      return area;
    });
  }
  async settings(input: SettingsInput, actorId: string, now: Date) {
    await this.db.$transaction(async tx => {
      const areas = await tx.crowdingArea.findMany({
        where: input.ids === 'all' ? {} : { id: { in: input.ids } },
        orderBy: { id: 'asc' },
      });
      if (
        !areas.length ||
        (input.ids !== 'all' && areas.length !== input.ids.length)
      ) {
        throw new ApplicationError(
          'INVALID_AREAS',
          'Select existing areas',
          400,
        );
      }
      for (const [index, area] of areas.entries()) {
        const changed = await tx.crowdingArea.updateMany({
          where: { id: area.id, revision: input.revisions[area.id] ?? -1 },
          data: {
            intervalMinutes: input.intervalMinutes,
            ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            revision: { increment: 1 },
            leaseToken: null,
            leaseUntil: null,
            nextDueAt: new Date(now.getTime() + index * 3_000),
          },
        });
        if (!changed.count)
          throw new ApplicationError(
            'REVISION_CONFLICT',
            'Settings changed; reload and retry',
            409,
          );
      }
      await tx.crowdingAudit.create({
        data: {
          id: randomUUID(),
          actorId,
          action: 'area_settings',
          details: {
            before: areas.map(a => ({
              id: a.id,
              intervalMinutes: a.intervalMinutes,
              enabled: a.enabled,
              active: a.active,
              revision: a.revision,
            })),
            after: { ...input },
          },
        },
      });
    });
  }
  async updateCatalog(input: CatalogInput, revision: number, actorId: string) {
    return this.db.$transaction(async tx => {
      const existing = await tx.crowdingArea.findUnique({
        where: { id: input.id },
      });
      if (
        !existing ||
        (existing.boundaryUrl !== input.boundaryUrl &&
          existing.boundaryVersion === input.boundaryVersion)
      ) {
        throw new ApplicationError(
          'BOUNDARY_VERSION_REQUIRED',
          'Change boundary version when changing its reference',
          400,
        );
      }
      const changed = await tx.crowdingArea.updateMany({
        where: { id: input.id, revision },
        data: {
          name: input.name,
          boundaryVersion: input.boundaryVersion,
          boundaryUrl: input.boundaryUrl,
          revision: { increment: 1 },
          leaseToken: null,
          leaseUntil: null,
          nextDueAt: new Date(),
          ...(existing.boundaryVersion !== input.boundaryVersion
            ? {
                lastSuccessAt: null,
              }
            : {}),
        },
      });
      if (!changed.count)
        throw new ApplicationError(
          'REVISION_CONFLICT',
          'Area changed; reload and retry',
          409,
        );
      await tx.crowdingAudit.create({
        data: {
          id: randomUUID(),
          actorId,
          action: 'update_area',
          details: {
            before: {
              name: existing.name,
              boundaryVersion: existing.boundaryVersion,
              boundaryUrl: existing.boundaryUrl,
            },
            after: input,
          },
        },
      });
      return tx.crowdingArea.findUniqueOrThrow({ where: { id: input.id } });
    });
  }
  async verify(
    eventId: string,
    areaId: string,
    evidence: string,
    fingerprint: string,
    actorId: string,
  ) {
    await this.db.$transaction(async tx => {
      const event = await tx.event.findUnique({ where: { id: eventId } });
      const area = await tx.crowdingArea.findUnique({ where: { id: areaId } });
      if (
        !event ||
        !area?.active ||
        locationFingerprint(event, area.boundaryVersion) !== fingerprint
      ) {
        throw new ApplicationError(
          'VERIFICATION_CHANGED',
          'Location or area changed; verify again',
          409,
        );
      }
      const data = {
        areaId,
        evidence,
        fingerprint,
        verifiedBy: actorId,
        verifiedAt: new Date(),
      };
      await tx.crowdingMapping.upsert({
        where: { eventId },
        create: { eventId, ...data },
        update: data,
      });
      await tx.crowdingAudit.create({
        data: {
          id: randomUUID(),
          actorId,
          action: 'verify_mapping',
          details: {
            eventId,
            ...data,
            verifiedAt: data.verifiedAt.toISOString(),
          },
        },
      });
    });
  }
  async unmap(eventId: string, actorId: string) {
    await this.db.$transaction(async tx => {
      await tx.crowdingMapping.deleteMany({ where: { eventId } });
      await tx.crowdingAudit.create({
        data: {
          id: randomUUID(),
          actorId,
          action: 'remove_mapping',
          details: { eventId },
        },
      });
    });
  }
  due(now: Date, limit: number) {
    return this.db.crowdingArea.findMany({
      where: {
        enabled: true,
        active: true,
        nextDueAt: { lte: now },
        AND: [
          {
            OR: [
              { lastAttemptAt: null },
              { lastAttemptAt: { lte: new Date(now.getTime() - 60_000) } },
            ],
          },
        ],
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      },
      orderBy: { nextDueAt: 'asc' },
      take: limit,
    });
  }
  async claim(id: string, now: Date, dueOnly: boolean) {
    const token = randomUUID();
    const result = await this.db.crowdingArea.updateMany({
      where: {
        id,
        active: true,
        enabled: true,
        ...(dueOnly ? { nextDueAt: { lte: now } } : {}),
        AND: [
          { OR: [{ failures: 0 }, { nextDueAt: { lte: now } }] },
          { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
          {
            OR: [
              { lastAttemptAt: null },
              { lastAttemptAt: { lte: new Date(now.getTime() - 60_000) } },
            ],
          },
        ],
      },
      data: {
        leaseToken: token,
        leaseUntil: new Date(now.getTime() + 30_000),
        lastAttemptAt: now,
      },
    });
    return result.count
      ? this.db.crowdingArea.findFirst({ where: { id, leaseToken: token } })
      : null;
  }
  async finish(
    area: Area,
    observation: Observation | null,
    failed: boolean,
    now: Date,
  ) {
    if (!area.leaseToken) return;
    await this.db.$transaction(async tx => {
      const changed = await tx.crowdingArea.updateMany({
        where: {
          id: area.id,
          leaseToken: area.leaseToken,
          revision: area.revision,
          active: true,
          enabled: true,
        },
        data: {
          ...(!failed ? { lastSuccessAt: now } : {}),
          lastError: failed ? 'SOURCE_UNAVAILABLE' : null,
          failures: failed ? area.failures + 1 : 0,
          nextDueAt: new Date(
            now.getTime() +
              (failed
                ? Math.min(900_000, 60_000 * 2 ** Math.min(area.failures, 4))
                : area.intervalMinutes * 60_000),
          ),
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (!changed.count || failed || !observation) return;
      // The row lock above protects both lease validation and archival from
      // concurrent settings/boundary edits. Both writes commit or roll back.
      await tx.crowdingObservation.upsert({
        where: {
          areaId_boundaryVersion_observedAt: {
            areaId: area.id,
            boundaryVersion: area.boundaryVersion,
            observedAt: observation.observedAt,
          },
        },
        create: {
          areaId: area.id,
          boundaryVersion: area.boundaryVersion,
          observedAt: observation.observedAt,
          level: observation.level,
          quality: observation.quality,
          fetchedAt: now,
        },
        update: {
          level: observation.level,
          quality: observation.quality,
          fetchedAt: now,
        },
      });
    });
  }
}
