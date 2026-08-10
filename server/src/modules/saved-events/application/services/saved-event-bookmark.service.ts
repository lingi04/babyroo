import {
  GET_EVENT_DETAIL_USE_CASE,
  GetEventDetailUseCase,
} from '../../../events/application/ports/in/get-event-detail.use-case';
import {
  GET_EVENTS_BY_IDS_USE_CASE,
  GetEventsByIdsUseCase,
} from '../../../events/application/ports/in/get-events-by-ids.use-case';
import { ListSavedEventsUseCase } from '../ports/in/list-saved-events.use-case';
import { SaveEventUseCase } from '../ports/in/save-event.use-case';
import { UnsaveEventUseCase } from '../ports/in/unsave-event.use-case';
import {
  SAVED_EVENT_REPOSITORY_PORT,
  SavedEventRepositoryPort,
} from '../ports/out/saved-event-repository.port';

export class SavedEventBookmarkService
  implements SaveEventUseCase, UnsaveEventUseCase, ListSavedEventsUseCase
{
  constructor(
    private readonly savedEvents: SavedEventRepositoryPort,
    private readonly getEventDetailUseCase: GetEventDetailUseCase,
    private readonly getEventsByIdsUseCase: GetEventsByIdsUseCase,
  ) {}

  async save(userId: string, eventId: string) {
    await this.getEventDetailUseCase.getById(eventId);
    return this.savedEvents.save(userId, eventId);
  }

  async unsave(userId: string, eventId: string) {
    return this.savedEvents.unsave(userId, eventId);
  }

  async list(userId: string) {
    const savedEvents = await this.savedEvents.list(userId);
    const events = await this.getEventsByIdsUseCase.getManyByIds(
      savedEvents.map(saved => saved.eventId),
    );
    return {
      count: events.length,
      events,
    };
  }
}
