import {
  GET_EVENT_DETAIL_USE_CASE,
  GetEventDetailUseCase,
} from '../../../events/application/ports/in/get-event-detail.use-case';
import { debugLog } from '../../../../common/debug-log';
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
    debugLog('savedEvents.save.start', { userId, eventId });
    await this.getEventDetailUseCase.getById(eventId);
    const savedEvent = await this.savedEvents.save(userId, eventId);
    debugLog('savedEvents.save.success', { userId, eventId });
    return savedEvent;
  }

  async unsave(userId: string, eventId: string) {
    debugLog('savedEvents.unsave.start', { userId, eventId });
    await this.savedEvents.unsave(userId, eventId);
    debugLog('savedEvents.unsave.success', { userId, eventId });
  }

  async list(userId: string) {
    debugLog('savedEvents.list.start', { userId });
    const savedEvents = await this.savedEvents.list(userId);
    const events = await this.getEventsByIdsUseCase.getManyByIds(
      savedEvents.map(saved => saved.eventId),
    );
    const result = {
      count: events.length,
      events,
    };
    debugLog('savedEvents.list.success', {
      userId,
      count: result.count,
    });
    return result;
  }
}
