import { EventListResult } from '../../../../events/domain/event.entity';

export const LIST_SAVED_EVENTS_USE_CASE = Symbol('LIST_SAVED_EVENTS_USE_CASE');

export interface ListSavedEventsUseCase {
  list(userId: string): Promise<EventListResult>;
}

