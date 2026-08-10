import { Module } from '@nestjs/common';
import { GET_EVENT_DETAIL_USE_CASE } from '../events/application/ports/in/get-event-detail.use-case';
import { GET_EVENTS_BY_IDS_USE_CASE } from '../events/application/ports/in/get-events-by-ids.use-case';
import { EventsModule } from '../events/events.module';
import { SavedEventsController } from './adapters/in/saved-events.controller';
import { InMemorySavedEventRepository } from './adapters/out/in-memory-saved-event.repository';
import { LIST_SAVED_EVENTS_USE_CASE } from './application/ports/in/list-saved-events.use-case';
import { SAVE_EVENT_USE_CASE } from './application/ports/in/save-event.use-case';
import { UNSAVE_EVENT_USE_CASE } from './application/ports/in/unsave-event.use-case';
import { SAVED_EVENT_REPOSITORY_PORT } from './application/ports/out/saved-event-repository.port';
import { SavedEventBookmarkService } from './application/services/saved-event-bookmark.service';

@Module({
  imports: [EventsModule],
  controllers: [SavedEventsController],
  providers: [
    {
      provide: SAVED_EVENT_REPOSITORY_PORT,
      useClass: InMemorySavedEventRepository,
    },
    {
      provide: SavedEventBookmarkService,
      useFactory: (repository, getEventDetailUseCase, getEventsByIdsUseCase) =>
        new SavedEventBookmarkService(
          repository,
          getEventDetailUseCase,
          getEventsByIdsUseCase,
        ),
      inject: [
        SAVED_EVENT_REPOSITORY_PORT,
        GET_EVENT_DETAIL_USE_CASE,
        GET_EVENTS_BY_IDS_USE_CASE,
      ],
    },
    {
      provide: LIST_SAVED_EVENTS_USE_CASE,
      useExisting: SavedEventBookmarkService,
    },
    {
      provide: SAVE_EVENT_USE_CASE,
      useExisting: SavedEventBookmarkService,
    },
    {
      provide: UNSAVE_EVENT_USE_CASE,
      useExisting: SavedEventBookmarkService,
    },
  ],
})
export class SavedEventsModule {}
