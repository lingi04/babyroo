import { NotFoundError } from '../../../../common/application-error';
import { BabyrooEvent, EventListQuery, EventListResult } from '../../domain/event.entity';
import { GetEventDetailUseCase } from '../ports/in/get-event-detail.use-case';
import { GetEventsByIdsUseCase } from '../ports/in/get-events-by-ids.use-case';
import { ListEventsUseCase } from '../ports/in/list-events.use-case';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '../ports/out/event-repository.port';

export class EventsQueryService
  implements ListEventsUseCase, GetEventDetailUseCase, GetEventsByIdsUseCase
{
  constructor(
    private readonly events: EventRepositoryPort,
  ) {}

  async list(query: EventListQuery): Promise<EventListResult> {
    const allEvents = await this.events.list();
    const filtered = allEvents
      .filter(event => this.matchesQuery(event, query))
      .sort((a, b) => b.csvSequence - a.csvSequence);
    const offset = Number(query.offset ?? 0);
    const limit = Math.min(Number(query.limit ?? 50), 100);

    return {
      count: filtered.length,
      events: filtered.slice(offset, offset + limit),
    };
  }

  async getById(id: string): Promise<BabyrooEvent> {
    const event = await this.events.findById(id);
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    return event;
  }

  async getManyByIds(ids: string[]): Promise<BabyrooEvent[]> {
    const events = await Promise.all(ids.map(id => this.events.findById(id)));
    return events.filter((event): event is BabyrooEvent => event !== null);
  }

  private matchesQuery(event: BabyrooEvent, query: EventListQuery): boolean {
    if (query.q && !event.title.toLowerCase().includes(query.q.toLowerCase())) {
      return false;
    }
    if (query.region && event.region !== query.region) {
      return false;
    }
    if (query.locality && event.locality !== query.locality) {
      return false;
    }
    if (query.category && event.category !== query.category) {
      return false;
    }
    if (query.priceType && event.priceType !== query.priceType) {
      return false;
    }
    if (query.reservationStatus && event.reservationStatus !== query.reservationStatus) {
      return false;
    }
    if (query.indoor !== undefined && event.indoor !== this.toBoolean(query.indoor)) {
      return false;
    }
    if (
      query.reservationRequired !== undefined &&
      event.reservationRequired !== this.toBoolean(query.reservationRequired)
    ) {
      return false;
    }
    if (query.startsBefore && event.startsAt > query.startsBefore) {
      return false;
    }
    if (query.endsAfter && event.endsAt < query.endsAfter) {
      return false;
    }
    if (query.childAgeMonths && !this.matchesAge(event, Number(query.childAgeMonths))) {
      return false;
    }

    return true;
  }

  private matchesAge(event: BabyrooEvent, ageMonths: number): boolean {
    if (Number.isNaN(ageMonths)) {
      return true;
    }
    if (event.ageMinMonths !== undefined && ageMonths < event.ageMinMonths) {
      return false;
    }
    if (event.ageMaxMonths !== undefined && ageMonths > event.ageMaxMonths) {
      return false;
    }
    return event.ageMinMonths !== undefined || event.ageMaxMonths !== undefined;
  }

  private toBoolean(value: string): boolean {
    return value === 'true' || value === '1' || value === 'yes';
  }
}
