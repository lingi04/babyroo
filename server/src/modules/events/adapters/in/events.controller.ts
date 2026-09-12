import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import {
  COUNT_EVENTS_USE_CASE,
  CountEventsUseCase,
} from '../../application/ports/in/count-events.use-case';
import {
  GET_EVENT_DETAIL_USE_CASE,
  GetEventDetailUseCase,
} from '../../application/ports/in/get-event-detail.use-case';
import {
  LIST_EVENTS_USE_CASE,
  ListEventsUseCase,
} from '../../application/ports/in/list-events.use-case';
import { EventListQuery } from '../../domain/event.entity';

@Controller('events')
export class EventsController {
  constructor(
    @Inject(LIST_EVENTS_USE_CASE)
    private readonly listEventsUseCase: ListEventsUseCase,
    @Inject(COUNT_EVENTS_USE_CASE)
    private readonly countEventsUseCase: CountEventsUseCase,
    @Inject(GET_EVENT_DETAIL_USE_CASE)
    private readonly getEventDetailUseCase: GetEventDetailUseCase,
  ) {}

  @Get()
  list(@Query() query: EventListQuery) {
    return this.listEventsUseCase.list(query);
  }

  @Get('count')
  count(@Query() query: EventListQuery) {
    return this.countEventsUseCase.count(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.getEventDetailUseCase.getById(id);
  }
}
