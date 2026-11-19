import { Injectable } from '@nestjs/common';
import { debugLog } from '../../../../common/debug-log';
import { getPrismaClient } from '../../../../common/prisma-client';
import { Prisma } from '../../../../generated/prisma/client';
import { verifiedSupport } from '../../../crowding/domain/crowding';
import { EventRepositoryPort } from '../../application/ports/out/event-repository.port';
import { BabyrooEvent, ReservationStatus } from '../../domain/event.entity';

const EVENT_LIST_CACHE_TTL_MS = 60_000;
type EventWithCrowding = Prisma.EventGetPayload<{
  include: { crowdingMapping: { include: { area: true } } };
}>;

@Injectable()
export class PrismaEventRepository implements EventRepositoryPort {
  private readonly prisma = getPrismaClient();
  private cachedEventList:
    | {
        expiresAt: number;
        events: BabyrooEvent[];
      }
    | undefined;

  async list(): Promise<BabyrooEvent[]> {
    const now = Date.now();

    if (this.cachedEventList && this.cachedEventList.expiresAt > now) {
      debugLog('events.repository.loadedFromCache', {
        count: this.cachedEventList.events.length,
        expiresInMs: this.cachedEventList.expiresAt - now,
      });
      return this.cachedEventList.events;
    }

    const events = await this.prisma.event.findMany({
      include: { crowdingMapping: { include: { area: true } } },
      orderBy: {
        csvSequence: 'asc',
      },
    });

    debugLog('events.repository.loadedFromDatabase', {
      count: events.length,
    });

    const mappedEvents = events.map(event => this.toDomainEvent(event));
    this.cachedEventList = {
      events: mappedEvents,
      expiresAt: Date.now() + EVENT_LIST_CACHE_TTL_MS,
    };

    return mappedEvents;
  }

  async findById(id: string): Promise<BabyrooEvent | null> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { crowdingMapping: { include: { area: true } } },
    });

    return event ? this.toDomainEvent(event) : null;
  }

  private toDomainEvent(event: EventWithCrowding): BabyrooEvent {
    return {
      id: event.id,
      crowdingArea: verifiedSupport({
        event, mapping: event.crowdingMapping ?? null, area: event.crowdingMapping?.area ?? null,
      }),
      csvSequence: event.csvSequence ?? undefined,
      title: event.title,
      venueName: event.venueName ?? '',
      venueDetail: event.venueDetail ?? undefined,
      imageUrl: event.imageUrl ?? undefined,
      locality: event.locality ?? '',
      region: event.region ?? '',
      category: event.category ?? '',
      source: event.source,
      startsAt: event.startsAt ? this.toDateOnly(event.startsAt) : '',
      endsAt: event.endsAt ? this.toDateOnly(event.endsAt) : '',
      ageMinMonths: event.ageMinMonths ?? undefined,
      ageMaxMonths: event.ageMaxMonths ?? undefined,
      indoor: event.indoor ?? undefined,
      priceText: event.priceText ?? undefined,
      priceType: this.toPriceType(event.priceType),
      reservationRequired: event.reservationRequired ?? undefined,
      reservationStatus: this.toReservationStatus(event.reservationStatus),
      publicationStatus: this.toPublicationStatus(event.publicationStatus),
      guardianRequired: event.guardianRequired ?? undefined,
      tags: event.tags,
      summary: event.summary ?? '',
      sourceUrl: event.sourceUrl,
    };
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toPriceType(value: string): BabyrooEvent['priceType'] {
    if (value === 'free' || value === 'paid') {
      return value;
    }

    return 'unknown';
  }

  private toReservationStatus(value: string): ReservationStatus {
    if (
      value === 'available' ||
      value === 'limited' ||
      value === 'closed'
    ) {
      return value;
    }

    return 'unknown';
  }

  private toPublicationStatus(value: string): BabyrooEvent['publicationStatus'] {
    if (
      value === 'draft' ||
      value === 'published' ||
      value === 'hidden' ||
      value === 'archived'
    ) {
      return value;
    }

    return 'draft';
  }
}
