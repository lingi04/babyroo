import { Module } from '@nestjs/common';
import { AppPolicyModule } from './modules/app-policy/app-policy.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CreditsModule } from './modules/credits/credits.module';
import { EventsModule } from './modules/events/events.module';
import { LegalModule } from './modules/legal/legal.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { SavedEventsModule } from './modules/saved-events/saved-events.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppPolicyModule,
    AdminModule,
    AuthModule,
    UsersModule,
    EventsModule,
    LegalModule,
    SavedEventsModule,
    CreditsModule,
    RecommendationsModule,
  ],
})
export class AppModule {}
