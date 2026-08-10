import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { EventRepositoryPort } from '../../application/ports/out/event-repository.port';
import { BabyrooEvent } from '../../domain/event.entity';

type PublishedEvent = {
  id: string;
  title: string;
  venue_name?: string | null;
  venue_detail?: string | null;
  image_url?: string | null;
  locality?: string | null;
  region?: string | null;
  category?: string | null;
  source?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  age_min_months?: number | null;
  age_max_months?: number | null;
  indoor?: boolean | null;
  price_text?: string | null;
  price_type?: 'free' | 'paid' | 'unknown' | null;
  reservation_required?: boolean | null;
  reservation_status?: 'unknown' | 'available' | 'limited' | 'closed' | null;
  guardian_required?: boolean | null;
  tags?: string[] | null;
  summary?: string | null;
  source_url?: string | null;
};

@Injectable()
export class JsonEventRepository implements EventRepositoryPort {
  private readonly events: BabyrooEvent[];

  constructor() {
    const path = this.resolveEventsPath();
    const payload = JSON.parse(readFileSync(path, 'utf8')) as { events: PublishedEvent[] };
    this.events = payload.events.map((event, index) => this.mapEvent(event, index + 1));
  }

  async list(): Promise<BabyrooEvent[]> {
    return this.events;
  }

  async findById(id: string): Promise<BabyrooEvent | null> {
    return this.events.find(event => event.id === id) ?? null;
  }

  private mapEvent(event: PublishedEvent, csvSequence: number): BabyrooEvent {
    return {
      id: event.id,
      csvSequence,
      title: event.title,
      venueName: event.venue_name ?? '',
      venueDetail: event.venue_detail ?? undefined,
      imageUrl: event.image_url ?? undefined,
      locality: event.locality ?? '',
      region: event.region ?? '',
      category: event.category ?? 'unknown',
      source: event.source ?? '',
      startsAt: event.starts_at ?? '',
      endsAt: event.ends_at ?? '',
      ageMinMonths: event.age_min_months ?? undefined,
      ageMaxMonths: event.age_max_months ?? undefined,
      indoor: event.indoor ?? undefined,
      priceText: event.price_text ?? undefined,
      priceType: event.price_type ?? 'unknown',
      reservationRequired: event.reservation_required ?? undefined,
      reservationStatus: event.reservation_status ?? 'unknown',
      guardianRequired: event.guardian_required ?? undefined,
      tags: event.tags ?? [],
      summary: event.summary ?? '',
      sourceUrl: event.source_url ?? '',
    };
  }

  private resolveEventsPath(): string {
    if (process.env.EVENT_DATA_PATH) {
      return process.env.EVENT_DATA_PATH;
    }

    const candidates = [
      resolve(process.cwd(), '../public/events.json'),
      resolve(process.cwd(), 'public/events.json'),
    ];
    const match = candidates.find(candidate => existsSync(candidate));
    return match ?? candidates[0];
  }
}
