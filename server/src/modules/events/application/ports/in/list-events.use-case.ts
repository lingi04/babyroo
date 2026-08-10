import { EventListQuery, EventListResult } from '../../../domain/event.entity';

export const LIST_EVENTS_USE_CASE = Symbol('LIST_EVENTS_USE_CASE');

export interface ListEventsUseCase {
  list(query: EventListQuery): Promise<EventListResult>;
}

