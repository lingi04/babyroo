import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { CreditsModule } from './modules/credits/credits.module';
import { EventsModule } from './modules/events/events.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { SavedEventsModule } from './modules/saved-events/saved-events.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    EventsModule,
    SavedEventsModule,
    CreditsModule,
    RecommendationsModule,
  ],
})
export class AppModule {}

