import { Module } from '@nestjs/common';
import { CONSUME_RECOMMENDATION_CREDIT_USE_CASE } from '../credits/application/ports/in/consume-recommendation-credit.use-case';
import { CreditsModule } from '../credits/credits.module';
import { LIST_EVENTS_USE_CASE } from '../events/application/ports/in/list-events.use-case';
import { EventsModule } from '../events/events.module';
import { GET_CURRENT_USER_USE_CASE } from '../users/application/ports/in/get-current-user.use-case';
import { UsersModule } from '../users/users.module';
import { RecommendationsController } from './adapters/in/recommendations.controller';
import { InMemoryRecommendationSessionRepository } from './adapters/out/in-memory-recommendation-session.repository';
import { CREATE_RECOMMENDATION_SESSION_USE_CASE } from './application/ports/in/create-recommendation-session.use-case';
import { GET_RECOMMENDATION_SESSION_USE_CASE } from './application/ports/in/get-recommendation-session.use-case';
import { LIST_RECOMMENDATION_SESSIONS_USE_CASE } from './application/ports/in/list-recommendation-sessions.use-case';
import { RECOMMENDATION_SESSION_REPOSITORY_PORT } from './application/ports/out/recommendation-session-repository.port';
import { RecommendationSessionService } from './application/services/recommendation-session.service';

@Module({
  imports: [UsersModule, EventsModule, CreditsModule],
  controllers: [RecommendationsController],
  providers: [
    {
      provide: RECOMMENDATION_SESSION_REPOSITORY_PORT,
      useClass: InMemoryRecommendationSessionRepository,
    },
    {
      provide: RecommendationSessionService,
      useFactory: (
        repository,
        getCurrentUserUseCase,
        listEventsUseCase,
        consumeRecommendationCreditUseCase,
      ) =>
        new RecommendationSessionService(
          repository,
          getCurrentUserUseCase,
          listEventsUseCase,
          consumeRecommendationCreditUseCase,
        ),
      inject: [
        RECOMMENDATION_SESSION_REPOSITORY_PORT,
        GET_CURRENT_USER_USE_CASE,
        LIST_EVENTS_USE_CASE,
        CONSUME_RECOMMENDATION_CREDIT_USE_CASE,
      ],
    },
    {
      provide: CREATE_RECOMMENDATION_SESSION_USE_CASE,
      useExisting: RecommendationSessionService,
    },
    {
      provide: LIST_RECOMMENDATION_SESSIONS_USE_CASE,
      useExisting: RecommendationSessionService,
    },
    {
      provide: GET_RECOMMENDATION_SESSION_USE_CASE,
      useExisting: RecommendationSessionService,
    },
  ],
})
export class RecommendationsModule {}
