import { RecommendationSession } from '../../../domain/recommendation.entity';

export const LIST_RECOMMENDATION_SESSIONS_USE_CASE = Symbol(
  'LIST_RECOMMENDATION_SESSIONS_USE_CASE',
);

export interface ListRecommendationSessionsUseCase {
  listSessions(userId: string): Promise<RecommendationSession[]>;
}

