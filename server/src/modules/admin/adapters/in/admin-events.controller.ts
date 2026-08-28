import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../../../../common/admin-auth.guard';
import { CurrentUser, RequestUser } from '../../../../common/current-user.decorator';
import {
  AdminEventListQuery,
  AdminEventMutationInput,
  AdminEventsService,
} from '../../application/services/admin-events.service';

@Controller('admin/events')
@UseGuards(AdminAuthGuard)
export class AdminEventsController {
  constructor(private readonly adminEventsService: AdminEventsService) {}

  @Get()
  list(@Query() query: AdminEventListQuery) {
    return this.adminEventsService.list(query);
  }

  @Post()
  create(@CurrentUser() admin: RequestUser, @Body() body: AdminEventMutationInput) {
    return this.adminEventsService.create(admin.id, body);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.adminEventsService.getById(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body() body: AdminEventMutationInput,
  ) {
    return this.adminEventsService.update(admin.id, id, body);
  }

  @Post(':id/publish')
  publish(@CurrentUser() admin: RequestUser, @Param('id') id: string) {
    return this.adminEventsService.changeStatus(admin.id, id, 'published');
  }

  @Post(':id/hide')
  hide(@CurrentUser() admin: RequestUser, @Param('id') id: string) {
    return this.adminEventsService.changeStatus(admin.id, id, 'hidden');
  }

  @Post(':id/archive')
  archive(@CurrentUser() admin: RequestUser, @Param('id') id: string) {
    return this.adminEventsService.changeStatus(admin.id, id, 'archived');
  }
}
