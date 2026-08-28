import { Injectable } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { getDatabaseUrl } from '../../../../common/database-url';
import { debugLog } from '../../../../common/debug-log';
import { Event as PrismaEvent, PrismaClient } from '../../../../generated/prisma/client';
import { EventRepositoryPort } from '../../application/ports/out/event-repository.port';
import { BabyrooEvent, ReservationStatus } from '../../domain/event.entity';

@Injectable()
export class PrismaEventRepository implements EventRepositoryPort {
  private readonly prisma = new PrismaClient({
    adapter: new PrismaNeon({
      connectionString: getDatabaseUrl() ?? '',
    }),
  });

  async list(): Promise<BabyrooEvent[]> {
    const events = await this.prisma.event.findMany({
      orderBy: {
        csvSequence: 'asc',
      },
    });

    debugLog('events.repository.loadedFromDatabase', {
      count: events.length,
    });

    return events.map(event => this.toDomainEvent(event));
  }

  async findById(id: string): Promise<BabyrooEvent | null> {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    return event ? this.toDomainEvent(event) : null;
  }

  private toDomainEvent(event: PrismaEvent): BabyrooEvent {
    return {
      id: event.id,
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
