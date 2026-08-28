import { Module } from '@nestjs/common';
import { AdminAuthController } from './adapters/in/admin-auth.controller';
import { AdminEventsController } from './adapters/in/admin-events.controller';
import { AdminUploadsController } from './adapters/in/admin-uploads.controller';
import { AdminAuthService } from './application/services/admin-auth.service';
import { AdminEventsService } from './application/services/admin-events.service';

@Module({
  controllers: [AdminAuthController, AdminEventsController, AdminUploadsController],
  providers: [AdminAuthService, AdminEventsService],
})
export class AdminModule {}
