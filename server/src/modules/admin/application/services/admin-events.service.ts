import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { createId } from '../../../../common/id';
import { getDatabaseUrl } from '../../../../common/database-url';
import { debugLog } from '../../../../common/debug-log';
import { Event, Prisma, PrismaClient } from '../../../../generated/prisma/client';
import { PublicationStatus, ReservationStatus } from '../../../events/domain/event.entity';

export type AdminEventListQuery = Partial<{
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
  limit: string;
  offset: string;
}>;

export type AdminEventMutationInput = Partial<{
  title: string | null;
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
  priceType: 'free' | 'paid' | 'unknown';
  reservationRequired: boolean | null;
  reservationStatus: ReservationStatus;
  guardianRequired: boolean | null;
  strollerFriendly: boolean | null;
  nursingRoom: boolean | null;
  parking: boolean | null;
  tags: string[] | null;
  summary: string | null;
  sourceUrl: string | null;
  lastCheckedAt: string | null;
  publicationStatus: PublicationStatus;
}>;

type AdminEventAction = 'create' | 'update' | 'publish' | 'hide' | 'archive';

type NormalizedAdminEventInput = Partial<{
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
  startsAt: Date | null;
  endsAt: Date | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  indoor: boolean | null;
  priceText: string | null;
  priceType: 'free' | 'paid' | 'unknown';
  reservationRequired: boolean | null;
  reservationStatus: ReservationStatus;
  guardianRequired: boolean | null;
  strollerFriendly: boolean | null;
  nursingRoom: boolean | null;
  parking: boolean | null;
  tags: string[];
  summary: string | null;
  sourceUrl: string;
  lastCheckedAt: Date | null;
  publicationStatus: PublicationStatus;
}>;

const PUBLICATION_STATUSES = ['draft', 'published', 'hidden', 'archived'] as const;
const PRICE_TYPES = ['free', 'paid', 'unknown'] as const;
const RESERVATION_STATUSES = ['unknown', 'available', 'limited', 'closed'] as const;
const CATEGORIES = [
  'experience',
  'play_space',
  'camp',
  'exhibition',
  'performance',
  'class',
  'festival',
  'other',
] as const;

@Injectable()
export class AdminEventsService {
  private readonly prisma = new PrismaClient({
    adapter: new PrismaNeon({
      connectionString: getDatabaseUrl() ?? '',
    }),
  });

  async list(query: AdminEventListQuery) {
    const limit = Math.min(Number(query.limit ?? 50), 100);
    const offset = Number(query.offset ?? 0);
    const where = this.listWhere(query);

    debugLog('admin.events.list.start', {
      publicationStatus: query.publicationStatus ?? 'draft',
      q: query.q,
      limit,
      offset,
    });

    const [count, events] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number.isNaN(offset) ? 0 : offset,
        take: Number.isNaN(limit) ? 50 : limit,
      }),
    ]);

    return {
      count,
      events: events.map(event => this.toResponse(event)),
    };
  }

  async getById(id: string) {
    return this.toResponse(await this.requireEvent(id));
  }

  async create(adminUserId: string, input: AdminEventMutationInput) {
    const normalized = this.normalizeInput(input);
    this.validateDraft(this.toValidationInput(normalized));
    const now = new Date();
    const title = normalized.title;
    const sourceUrl = normalized.sourceUrl;
    if (!title || !sourceUrl) {
      throw new BadRequestException('Title and sourceUrl are required');
    }

    const event = await this.prisma.event.create({
      data: this.toPrismaCreateData({
        ...normalized,
        title,
        sourceUrl,
        source: normalized.source ?? 'manual',
        publicationStatus: normalized.publicationStatus ?? 'draft',
        lastCheckedAt: normalized.lastCheckedAt ?? this.today(),
        adminUpdatedAt: now,
      }),
    });
    await this.writeAuditLog(adminUserId, event.id, 'create', null, event);

    return this.toResponse(event);
  }

  async update(adminUserId: string, id: string, input: AdminEventMutationInput) {
    const existing = await this.requireEvent(id);
    const normalized = this.normalizeInput(input);
    const merged = { ...this.toResponse(existing), ...this.toValidationInput(normalized) };
    this.validateDraft(merged);
    this.validatePublishIfNeeded(merged);

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...this.toPrismaWriteData(normalized),
        adminUpdatedAt: new Date(),
      },
    });
    await this.writeAuditLog(adminUserId, event.id, 'update', existing, event);

    return this.toResponse(event);
  }

  async changeStatus(
    adminUserId: string,
    id: string,
    publicationStatus: Exclude<PublicationStatus, 'draft'>,
  ) {
    const existing = await this.requireEvent(id);
    const next = {
      ...this.toResponse(existing),
      publicationStatus,
    };
    if (publicationStatus === 'published') {
      this.validatePublish(next);
    }

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        publicationStatus,
        adminUpdatedAt: new Date(),
      },
    });
    await this.writeAuditLog(
      adminUserId,
      event.id,
      this.statusAction(publicationStatus),
      existing,
      event,
    );

    return this.toResponse(event);
  }

  private listWhere(query: AdminEventListQuery): Prisma.EventWhereInput {
    const where: Prisma.EventWhereInput = {};
    if (query.publicationStatus && query.publicationStatus !== 'all') {
      where.publicationStatus = query.publicationStatus;
    } else if (!query.publicationStatus) {
      where.publicationStatus = 'draft';
    }
    if (query.source) {
      where.source = query.source;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.region) {
      where.region = query.region;
    }
    if (query.locality) {
      where.locality = query.locality;
    }
    if (query.reservationStatus) {
      where.reservationStatus = query.reservationStatus;
    }
    if (query.startsFrom || query.startsTo) {
      where.startsAt = this.dateRange(query.startsFrom, query.startsTo);
    }
    if (query.endsFrom || query.endsTo) {
      where.endsAt = this.dateRange(query.endsFrom, query.endsTo);
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = this.dateTimeRange(query.createdFrom, query.createdTo);
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { venueName: { contains: q, mode: 'insensitive' } },
        { venueDetail: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
        { region: { contains: q, mode: 'insensitive' } },
        { locality: { contains: q, mode: 'insensitive' } },
        { source: { contains: q, mode: 'insensitive' } },
        { sourceEventId: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    return where;
  }

  private normalizeInput(input: AdminEventMutationInput): NormalizedAdminEventInput {
    return {
      title: this.requiredTextValue(input.title),
      venueName: this.optionalTextValue(input.venueName),
      venueDetail: this.optionalTextValue(input.venueDetail),
      address: this.optionalTextValue(input.address),
      imageUrl: this.optionalTextValue(input.imageUrl),
      locality: this.optionalTextValue(input.locality),
      region: this.optionalTextValue(input.region),
      category: this.optionalTextValue(input.category),
      source: this.optionalTextValue(input.source) ?? undefined,
      sourceEventId: this.optionalTextValue(input.sourceEventId),
      startsAt: this.optionalDateValue(input.startsAt),
      endsAt: this.optionalDateValue(input.endsAt),
      ageMinMonths: this.optionalNumberValue(input.ageMinMonths),
      ageMaxMonths: this.optionalNumberValue(input.ageMaxMonths),
      indoor: this.optionalBooleanValue(input.indoor),
      priceText: this.optionalTextValue(input.priceText),
      priceType: input.priceType ?? 'unknown',
      reservationRequired: this.optionalBooleanValue(input.reservationRequired),
      reservationStatus: input.reservationStatus ?? 'unknown',
      guardianRequired: this.optionalBooleanValue(input.guardianRequired),
      strollerFriendly: this.optionalBooleanValue(input.strollerFriendly),
      nursingRoom: this.optionalBooleanValue(input.nursingRoom),
      parking: this.optionalBooleanValue(input.parking),
      tags: this.normalizeTags(input.tags),
      summary: this.optionalTextValue(input.summary),
      sourceUrl: this.requiredTextValue(input.sourceUrl),
      lastCheckedAt: this.optionalDateValue(input.lastCheckedAt),
      publicationStatus: input.publicationStatus ?? undefined,
    };
  }

  private toPrismaCreateData(
    input: NormalizedAdminEventInput & {
      title: string;
      sourceUrl: string;
      source: string;
      publicationStatus: PublicationStatus;
      lastCheckedAt: Date;
      adminUpdatedAt: Date;
    },
  ): Prisma.EventUncheckedCreateInput {
    return {
      id: createId('event'),
      title: input.title,
      venueName: input.venueName,
      venueDetail: input.venueDetail,
      address: input.address,
      imageUrl: input.imageUrl,
      locality: input.locality,
      region: input.region,
      category: input.category,
      source: input.source,
      sourceEventId: input.sourceEventId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      ageMinMonths: input.ageMinMonths,
      ageMaxMonths: input.ageMaxMonths,
      indoor: input.indoor,
      priceText: input.priceText,
      priceType: input.priceType,
      reservationRequired: input.reservationRequired,
      reservationStatus: input.reservationStatus,
      guardianRequired: input.guardianRequired,
      strollerFriendly: input.strollerFriendly,
      nursingRoom: input.nursingRoom,
      parking: input.parking,
      tags: input.tags,
      summary: input.summary,
      sourceUrl: input.sourceUrl,
      lastCheckedAt: input.lastCheckedAt,
      publicationStatus: input.publicationStatus,
      adminUpdatedAt: input.adminUpdatedAt,
    };
  }

  private toPrismaWriteData(input: NormalizedAdminEventInput): Prisma.EventUncheckedUpdateInput {
    return {
      title: input.title,
      venueName: input.venueName,
      venueDetail: input.venueDetail,
      address: input.address,
      imageUrl: input.imageUrl,
      locality: input.locality,
      region: input.region,
      category: input.category,
      source: input.source,
      sourceEventId: input.sourceEventId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      ageMinMonths: input.ageMinMonths,
      ageMaxMonths: input.ageMaxMonths,
      indoor: input.indoor,
      priceText: input.priceText,
      priceType: input.priceType,
      reservationRequired: input.reservationRequired,
      reservationStatus: input.reservationStatus,
      guardianRequired: input.guardianRequired,
      strollerFriendly: input.strollerFriendly,
      nursingRoom: input.nursingRoom,
      parking: input.parking,
      tags: input.tags,
      summary: input.summary,
      sourceUrl: input.sourceUrl,
      lastCheckedAt: input.lastCheckedAt,
      publicationStatus: input.publicationStatus,
    };
  }

  private validateDraft(event: Partial<ReturnType<AdminEventsService['toResponse']>>) {
    const errors: Record<string, string> = {};
    if (!event.title?.trim()) {
      errors.title = '제목을 입력해 주세요.';
    }
    if (!event.sourceUrl?.trim()) {
      errors.sourceUrl = '원본 URL을 입력해 주세요.';
    }
    this.validateShared(event, errors);
    this.throwValidationError(errors);
  }

  private validatePublishIfNeeded(event: Partial<ReturnType<AdminEventsService['toResponse']>>) {
    if (event.publicationStatus === 'published') {
      this.validatePublish(event);
    }
  }

  private validatePublish(event: Partial<ReturnType<AdminEventsService['toResponse']>>) {
    const errors: Record<string, string> = {};
    this.validateDraftFields(event, errors);
    for (const field of [
      'summary',
      'category',
      'venueName',
      'region',
      'locality',
      'startsAt',
      'endsAt',
      'source',
      'sourceUrl',
    ] as const) {
      if (!event[field]) {
        errors[field] = '공개하려면 값을 입력해 주세요.';
      }
    }
    this.validateShared(event, errors);
    this.throwValidationError(errors);
  }

  private validateDraftFields(
    event: Partial<ReturnType<AdminEventsService['toResponse']>>,
    errors: Record<string, string>,
  ) {
    if (!event.title?.trim()) {
      errors.title = '제목을 입력해 주세요.';
    }
    if (!event.sourceUrl?.trim()) {
      errors.sourceUrl = '원본 URL을 입력해 주세요.';
    }
  }

  private validateShared(
    event: Partial<ReturnType<AdminEventsService['toResponse']>>,
    errors: Record<string, string>,
  ) {
    if (event.publicationStatus && !this.includes(PUBLICATION_STATUSES, event.publicationStatus)) {
      errors.publicationStatus = '공개 상태 값이 올바르지 않습니다.';
    }
    if (event.priceType && !this.includes(PRICE_TYPES, event.priceType)) {
      errors.priceType = '가격 유형 값이 올바르지 않습니다.';
    }
    if (
      event.reservationStatus &&
      !this.includes(RESERVATION_STATUSES, event.reservationStatus)
    ) {
      errors.reservationStatus = '예약 상태 값이 올바르지 않습니다.';
    }
    if (event.category && !this.includes(CATEGORIES, event.category)) {
      errors.category = '카테고리 값이 올바르지 않습니다.';
    }
    if (event.startsAt && event.endsAt && event.endsAt < event.startsAt) {
      errors.endsAt = '종료일은 시작일보다 빠를 수 없습니다.';
    }
  }

  private async requireEvent(id: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  private async writeAuditLog(
    adminUserId: string,
    eventId: string,
    action: AdminEventAction,
    before: Event | null,
    after: Event,
  ) {
    await this.prisma.eventAuditLog.create({
      data: {
        id: createId('event_audit'),
        eventId,
        adminUserId,
        action,
        before: before ? this.toAuditJson(before) : undefined,
        after: this.toAuditJson(after),
      },
    });
  }

  private toResponse(event: Event) {
    return {
      id: event.id,
      csvSequence: event.csvSequence,
      title: event.title,
      venueName: event.venueName,
      venueDetail: event.venueDetail,
      address: event.address,
      imageUrl: event.imageUrl,
      locality: event.locality,
      region: event.region,
      category: event.category,
      source: event.source,
      sourceEventId: event.sourceEventId,
      startsAt: event.startsAt ? this.toDateOnly(event.startsAt) : null,
      endsAt: event.endsAt ? this.toDateOnly(event.endsAt) : null,
      ageMinMonths: event.ageMinMonths,
      ageMaxMonths: event.ageMaxMonths,
      indoor: event.indoor,
      priceText: event.priceText,
      priceType: event.priceType,
      reservationRequired: event.reservationRequired,
      reservationStatus: event.reservationStatus,
      guardianRequired: event.guardianRequired,
      strollerFriendly: event.strollerFriendly,
      nursingRoom: event.nursingRoom,
      parking: event.parking,
      tags: event.tags,
      summary: event.summary,
      sourceUrl: event.sourceUrl,
      lastCheckedAt: event.lastCheckedAt ? this.toDateOnly(event.lastCheckedAt) : null,
      publicationStatus: event.publicationStatus as PublicationStatus,
      adminUpdatedAt: event.adminUpdatedAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  private toAuditJson(event: Event): Prisma.InputJsonValue {
    return this.toResponse(event) as Prisma.InputJsonObject;
  }

  private toValidationInput(input: NormalizedAdminEventInput) {
    return {
      ...input,
      startsAt: input.startsAt ? this.toDateOnly(input.startsAt) : input.startsAt,
      endsAt: input.endsAt ? this.toDateOnly(input.endsAt) : input.endsAt,
      lastCheckedAt: input.lastCheckedAt ? this.toDateOnly(input.lastCheckedAt) : input.lastCheckedAt,
    };
  }

  private optionalTextValue(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private requiredTextValue(value: string | null | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private optionalDateValue(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (!value) {
      return null;
    }

    return this.toDate(value);
  }

  private optionalNumberValue(value: number | null | undefined): number | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || Number.isNaN(Number(value))) {
      return null;
    }

    return Number(value);
  }

  private optionalBooleanValue(value: boolean | null | undefined): boolean | null | undefined {
    return value;
  }

  private normalizeTags(value: string[] | null | undefined): string[] | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (!value) {
      return [];
    }

    return [...new Set(value.map(tag => tag.trim()).filter(Boolean))];
  }

  private dateRange(from?: string, to?: string): Prisma.DateTimeNullableFilter {
    return {
      gte: from ? this.toDate(from) : undefined,
      lte: to ? this.toDate(to) : undefined,
    };
  }

  private dateTimeRange(from?: string, to?: string): Prisma.DateTimeFilter {
    return {
      gte: from ? this.toDate(from) : undefined,
      lte: to ? this.toDate(to) : undefined,
    };
  }

  private toDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private today(): Date {
    return this.toDate(new Date().toISOString().slice(0, 10));
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private statusAction(publicationStatus: PublicationStatus): AdminEventAction {
    if (publicationStatus === 'published') {
      return 'publish';
    }
    if (publicationStatus === 'hidden') {
      return 'hide';
    }

    return 'archive';
  }

  private includes<T extends readonly string[]>(values: T, value: string): value is T[number] {
    return values.includes(value);
  }

  private throwValidationError(errors: Record<string, string>) {
    if (Object.keys(errors).length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }
  }
}
