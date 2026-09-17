import { Module } from '@nestjs/common';
import { getDatabaseUrl } from '../../common/database-url';
import { PUSH_DEVICE_REPOSITORY, PushDeviceRepository } from './application/push-device.repository';
import { PUSH_NOTIFICATION_PORT } from './application/push-notification.port';
import { PUSH_DELIVERY_PORT, PushDeliveryPort } from './application/push-delivery.port';
import { RecommendationNotificationService } from './application/recommendation-notification.service';
import { createPushDelivery } from './push-delivery.factory';
import { InMemoryPushDeviceRepository, PrismaPushDeviceRepository } from './adapters/push-device.repositories';
import { PushDevicesController } from './adapters/push-devices.controller';

@Module({
  controllers: [PushDevicesController],
  providers: [
    {
      provide: PUSH_DEVICE_REPOSITORY,
      useClass: getDatabaseUrl() ? PrismaPushDeviceRepository : InMemoryPushDeviceRepository,
    },
    {
      provide: PUSH_DELIVERY_PORT,
      useFactory: () => createPushDelivery(),
    },
    {
      provide: PUSH_NOTIFICATION_PORT,
      useFactory: (devices: PushDeviceRepository, delivery: PushDeliveryPort) =>
        new RecommendationNotificationService(devices, delivery),
      inject: [PUSH_DEVICE_REPOSITORY, PUSH_DELIVERY_PORT],
    },
  ],
  exports: [PUSH_NOTIFICATION_PORT],
})
export class NotificationsModule {}
