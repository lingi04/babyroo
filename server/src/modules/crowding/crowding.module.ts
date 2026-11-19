import { Module } from '@nestjs/common';
import { CrowdingService } from './application/crowding.service';
import {
  CROWDING_STORE,
  CROWDING_PROVIDER,
  CrowdingStore,
  CrowdingProvider,
} from './application/ports';
import { PrismaCrowdingStore } from './adapters/prisma-crowding.store';
import { SeoulCrowdingProvider } from './adapters/seoul-crowding.provider';
import {
  CurrentCrowdingController,
  AdminCrowdingController,
  CrowdingCollectionController,
} from './adapters/crowding.controllers';

@Module({
  controllers: [
    CurrentCrowdingController,
    AdminCrowdingController,
    CrowdingCollectionController,
  ],
  providers: [
    { provide: CROWDING_STORE, useClass: PrismaCrowdingStore },
    { provide: CROWDING_PROVIDER, useClass: SeoulCrowdingProvider },
    {
      provide: CrowdingService,
      useFactory: (store: CrowdingStore, provider: CrowdingProvider) =>
        new CrowdingService(store, provider),
      inject: [CROWDING_STORE, CROWDING_PROVIDER],
    },
  ],
})
export class CrowdingModule {}
