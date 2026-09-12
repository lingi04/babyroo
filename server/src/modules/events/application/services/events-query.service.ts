import { NotFoundError } from '../../../../common/application-error';
import { debugLog } from '../../../../common/debug-log';
import {
  BabyrooEvent,
  EventCountResult,
  EventListQuery,
  EventListResult,
} from '../../domain/event.entity';
import { CountEventsUseCase } from '../ports/in/count-events.use-case';
import { GetEventDetailUseCase } from '../ports/in/get-event-detail.use-case';
import { GetEventsByIdsUseCase } from '../ports/in/get-events-by-ids.use-case';
import { ListEventsUseCase } from '../ports/in/list-events.use-case';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '../ports/out/event-repository.port';

export class EventsQueryService
  implements
    ListEventsUseCase,
    CountEventsUseCase,
    GetEventDetailUseCase,
    GetEventsByIdsUseCase
{
  constructor(
    private readonly events: EventRepositoryPort,
  ) {}

  async list(query: EventListQuery): Promise<EventListResult> {
    debugLog('events.list.start', {
      q: query.q,
      region: query.region,
      locality: query.locality,
      category: query.category,
      eventType: query.eventType,
      limit: query.limit,
      offset: query.offset,
    });
    const { allEvents, filtered } = await this.filteredEvents(query);
    const offset = Number(query.offset ?? 0);
    const limit = Math.min(Number(query.limit ?? 50), 300);

    const result = {
      count: filtered.length,
      events: filtered.slice(offset, offset + limit),
    };
    debugLog('events.list.success', {
      totalCount: allEvents.length,
      filteredCount: result.count,
      returnedCount: result.events.length,
    });

    return result;
  }

  async count(query: EventListQuery): Promise<EventCountResult> {
    debugLog('events.count.start', {
      q: query.q,
      region: query.region,
      locality: query.locality,
      category: query.category,
      eventType: query.eventType,
    });
    const { allEvents, filtered } = await this.filteredEvents(query);
    const result = { count: filtered.length };

    debugLog('events.count.success', {
      totalCount: allEvents.length,
      filteredCount: result.count,
    });

    return result;
  }

  async getById(id: string): Promise<BabyrooEvent> {
    debugLog('events.getById.start', { eventId: id });
    const event = await this.events.findById(id);
    if (!event || !this.isPublished(event)) {
      debugLog('events.getById.notFound', { eventId: id });
      throw new NotFoundError('Event not found');
    }
    debugLog('events.getById.success', { eventId: id });
    return event;
  }

  async getManyByIds(ids: string[]): Promise<BabyrooEvent[]> {
    const events = await Promise.all(ids.map(id => this.events.findById(id)));
    const foundEvents = events.filter(
      (event): event is BabyrooEvent => event !== null && this.isPublished(event),
    );
    debugLog('events.getManyByIds.success', {
      requestedCount: ids.length,
      foundCount: foundEvents.length,
    });
    return foundEvents;
  }

  private async filteredEvents(query: EventListQuery) {
    const allEvents = await this.events.list();
    const filtered = allEvents
      .filter(event => this.isPublished(event))
      .filter(event => this.matchesQuery(event, query))
      .sort((a, b) => this.sortSequence(b) - this.sortSequence(a));

    return { allEvents, filtered };
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
    if (query.eventType && !this.matchesEventTypes(event, query.eventType)) {
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

  private matchesEventTypes(event: BabyrooEvent, eventTypeQuery: string): boolean {
    const eventTypes = eventTypeQuery
      .split(',')
      .map(eventType => eventType.trim())
      .filter(Boolean);

    return eventTypes.includes(this.getExploreEventType(event));
  }

  private getExploreEventType(event: BabyrooEvent) {
    if (this.eventIsSeoulKidsCafe(event)) {
      return 'seoulKidsCafe';
    }

    if (this.eventIsPermanentVenue(event)) {
      return 'permanentVenue';
    }

    return 'limitedEvent';
  }

  private eventIsSeoulKidsCafe(event: BabyrooEvent) {
    const searchableText = [
      event.title,
      event.venueName,
      event.summary,
      ...event.tags,
    ].join(' ');

    return (
      event.source === 'seoul_kids_cafe' ||
      searchableText.includes('서울형 키즈카페') ||
      searchableText.includes('서울형키즈카페')
    );
  }

  private eventIsPermanentVenue(event: BabyrooEvent) {
    const searchableText = [
      event.title,
      event.venueName,
      event.summary,
      event.sourceUrl,
    ].join(' ');

    return (
      event.title.endsWith('관람') ||
      event.title.endsWith('입장') ||
      event.category === 'museum' ||
      searchableText.includes('아쿠아리움 관람') ||
      searchableText.includes('어린이박물관 관람') ||
      searchableText.includes('체험관 관람')
    );
  }

  private toBoolean(value: string): boolean {
    return value === 'true' || value === '1' || value === 'yes';
  }

  private sortSequence(event: BabyrooEvent): number {
    return event.csvSequence ?? 0;
  }

  private isPublished(event: BabyrooEvent): boolean {
    return event.publicationStatus === undefined || event.publicationStatus === 'published';
  }
}
