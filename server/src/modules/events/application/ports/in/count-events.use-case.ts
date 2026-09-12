import { EventCountResult, EventListQuery } from '../../../domain/event.entity';

export const COUNT_EVENTS_USE_CASE = Symbol('COUNT_EVENTS_USE_CASE');

export interface CountEventsUseCase {
  count(query: EventListQuery): Promise<EventCountResult>;
}
