import { RecommendationSession } from '../../../domain/recommendation.entity';

export const GET_RECOMMENDATION_SESSION_USE_CASE = Symbol(
  'GET_RECOMMENDATION_SESSION_USE_CASE',
);

export interface GetRecommendationSessionUseCase {
  getSession(userId: string, sessionId: string): Promise<RecommendationSession>;
}

