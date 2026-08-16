import { Module } from '@nestjs/common';
import { EventsController } from './adapters/in/events.controller';
import { JsonEventRepository } from './adapters/out/json-event.repository';
import { PrismaEventRepository } from './adapters/out/prisma-event.repository';
import { GET_EVENT_DETAIL_USE_CASE } from './application/ports/in/get-event-detail.use-case';
import { GET_EVENTS_BY_IDS_USE_CASE } from './application/ports/in/get-events-by-ids.use-case';
import { LIST_EVENTS_USE_CASE } from './application/ports/in/list-events.use-case';
import { EVENT_REPOSITORY_PORT } from './application/ports/out/event-repository.port';
import { EventsQueryService } from './application/services/events-query.service';

@Module({
  controllers: [EventsController],
  providers: [
    {
      provide: EVENT_REPOSITORY_PORT,
      useClass: process.env.DATABASE_URL
        ? PrismaEventRepository
        : JsonEventRepository,
    },
    {
      provide: EventsQueryService,
      useFactory: repository => new EventsQueryService(repository),
      inject: [EVENT_REPOSITORY_PORT],
    },
    {
      provide: LIST_EVENTS_USE_CASE,
      useExisting: EventsQueryService,
    },
    {
      provide: GET_EVENT_DETAIL_USE_CASE,
      useExisting: EventsQueryService,
    },
    {
      provide: GET_EVENTS_BY_IDS_USE_CASE,
      useExisting: EventsQueryService,
    },
  ],
  exports: [LIST_EVENTS_USE_CASE, GET_EVENT_DETAIL_USE_CASE, GET_EVENTS_BY_IDS_USE_CASE],
})
export class EventsModule {}
