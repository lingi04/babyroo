import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Header,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { AuthGuard } from '../../../common/auth.guard';
import { AdminAuthGuard } from '../../../common/admin-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../../../common/current-user.decorator';
import { getDatabaseUrl } from '../../../common/database-url';
import { CrowdingService } from '../application/crowding.service';
import { CatalogInput, SettingsInput } from '../application/ports';

function persistent() {
  if (!getDatabaseUrl())
    throw new ServiceUnavailableException('Crowding storage is not configured');
}
@Controller('events')
export class CurrentCrowdingController {
  constructor(private readonly crowding: CrowdingService) {}
  @Get(':id/crowding')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'private, no-store')
  current(@Param('id') id: string) {
    persistent();
    return this.crowding.current(id);
  }
}

@Controller('admin/crowding')
@UseGuards(AdminAuthGuard)
export class AdminCrowdingController {
  constructor(private readonly crowding: CrowdingService) {}
  @Get('areas')
  @Header('Cache-Control', 'private, no-store')
  list() {
    persistent();
    return this.crowding.list();
  }
  @Post('areas')
  create(@Body() input: CatalogInput, @CurrentUser() admin: RequestUser) {
    persistent();
    return this.crowding.create(input, admin.id);
  }
  @Patch('areas/settings')
  async settings(
    @Body() input: SettingsInput,
    @CurrentUser() admin: RequestUser,
  ) {
    persistent();
    await this.crowding.settings(input, admin.id);
    return { saved: true };
  }
  @Patch('areas/:id')
  update(
    @Param('id') id: string,
    @Body() input: CatalogInput & { revision: number },
    @CurrentUser() admin: RequestUser,
  ) {
    persistent();
    return this.crowding.updateCatalog(
      { ...input, id },
      input?.revision ?? 0,
      admin.id,
    );
  }
  @Get('events/:id')
  @Header('Cache-Control', 'private, no-store')
  info(@Param('id') id: string, @Query('areaId') areaId: string) {
    persistent();
    return this.crowding.mappingInfo(id, areaId);
  }
  @Post('events/:id/verify')
  async verify(
    @Param('id') id: string,
    @Body() input: Parameters<CrowdingService['verify']>[1],
    @CurrentUser() admin: RequestUser,
  ) {
    persistent();
    await this.crowding.verify(id, input, admin.id);
    return { saved: true };
  }
  @Delete('events/:id')
  async unmap(@Param('id') id: string, @CurrentUser() admin: RequestUser) {
    persistent();
    await this.crowding.unmap(id, admin.id);
    return { saved: true };
  }
}

@Controller('internal/crowding')
export class CrowdingCollectionController {
  constructor(private readonly crowding: CrowdingService) {}
  @Post('collect')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  collect(@Headers('authorization') header?: string) {
    const secret = process.env.BABYROO_CROWDING_JOB_SECRET;
    if (!secret || secret.length < 32)
      throw new ServiceUnavailableException('Collector is not configured');
    const expected = Buffer.from('Bearer ' + secret);
    const received = Buffer.from(header ?? '');
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      throw new UnauthorizedException();
    persistent();
    return this.crowding.collect();
  }
}
