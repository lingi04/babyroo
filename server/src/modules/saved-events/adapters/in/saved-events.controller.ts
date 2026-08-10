import { Controller, Delete, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../common/auth.guard';
import { CurrentUser, RequestUser } from '../../../../common/current-user.decorator';
import {
  LIST_SAVED_EVENTS_USE_CASE,
  ListSavedEventsUseCase,
} from '../../application/ports/in/list-saved-events.use-case';
import {
  SAVE_EVENT_USE_CASE,
  SaveEventUseCase,
} from '../../application/ports/in/save-event.use-case';
import {
  UNSAVE_EVENT_USE_CASE,
  UnsaveEventUseCase,
} from '../../application/ports/in/unsave-event.use-case';

@Controller('saved-events')
@UseGuards(AuthGuard)
export class SavedEventsController {
  constructor(
    @Inject(LIST_SAVED_EVENTS_USE_CASE)
    private readonly listSavedEventsUseCase: ListSavedEventsUseCase,
    @Inject(SAVE_EVENT_USE_CASE)
    private readonly saveEventUseCase: SaveEventUseCase,
    @Inject(UNSAVE_EVENT_USE_CASE)
    private readonly unsaveEventUseCase: UnsaveEventUseCase,
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.listSavedEventsUseCase.list(user.id);
  }

  @Post(':eventId')
  save(@CurrentUser() user: RequestUser, @Param('eventId') eventId: string) {
    return this.saveEventUseCase.save(user.id, eventId);
  }

  @Delete(':eventId')
  unsave(@CurrentUser() user: RequestUser, @Param('eventId') eventId: string) {
    return this.unsaveEventUseCase.unsave(user.id, eventId);
  }
}
