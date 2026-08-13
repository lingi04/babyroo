import { Module } from '@nestjs/common';
import { CONSUME_RECOMMENDATION_CREDIT_USE_CASE } from '../credits/application/ports/in/consume-recommendation-credit.use-case';
import { CreditsModule } from '../credits/credits.module';
import { LIST_EVENTS_USE_CASE } from '../events/application/ports/in/list-events.use-case';
import { EventsModule } from '../events/events.module';
import { GET_CURRENT_USER_USE_CASE } from '../users/application/ports/in/get-current-user.use-case';
import { UsersModule } from '../users/users.module';
import { RecommendationsController } from './adapters/in/recommendations.controller';
import { InMemoryRecommendationSessionRepository } from './adapters/out/in-memory-recommendation-session.repository';
import { OpenAiRecommendationEngineAdapter } from './adapters/out/openai-recommendation-engine.adapter';
import { RuleBasedRecommendationEngineAdapter } from './adapters/out/rule-based-recommendation-engine.adapter';
import { CREATE_RECOMMENDATION_SESSION_USE_CASE } from './application/ports/in/create-recommendation-session.use-case';
import { GET_RECOMMENDATION_SESSION_USE_CASE } from './application/ports/in/get-recommendation-session.use-case';
import { LIST_RECOMMENDATION_SESSIONS_USE_CASE } from './application/ports/in/list-recommendation-sessions.use-case';
import { RECOMMENDATION_ENGINE_PORT } from './application/ports/out/recommendation-engine.port';
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
      provide: RECOMMENDATION_ENGINE_PORT,
      useFactory: () => {
        if (process.env.BABYROO_RECOMMENDATION_ENGINE === 'openai') {
          return new OpenAiRecommendationEngineAdapter({
            apiKey: process.env.OPENAI_API_KEY ?? 'replace-me-openai-api-key',
            model: process.env.OPENAI_RECOMMENDATION_MODEL ?? 'gpt-5-mini',
            maxCandidates: Number(process.env.OPENAI_RECOMMENDATION_MAX_CANDIDATES ?? 20),
            maxResults: 3,
            timeoutMs: Number(process.env.OPENAI_RECOMMENDATION_TIMEOUT_MS ?? 60000),
          });
        }

        return new RuleBasedRecommendationEngineAdapter();
      },
    },
    {
      provide: RecommendationSessionService,
      useFactory: (
        repository,
        getCurrentUserUseCase,
        listEventsUseCase,
        consumeRecommendationCreditUseCase,
        recommendationEngine,
      ) =>
        new RecommendationSessionService(
          repository,
          getCurrentUserUseCase,
          listEventsUseCase,
          consumeRecommendationCreditUseCase,
          recommendationEngine,
        ),
      inject: [
        RECOMMENDATION_SESSION_REPOSITORY_PORT,
        GET_CURRENT_USER_USE_CASE,
        LIST_EVENTS_USE_CASE,
        CONSUME_RECOMMENDATION_CREDIT_USE_CASE,
        RECOMMENDATION_ENGINE_PORT,
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
