import {
  CreateRecommendationSessionInput,
  RecommendationSession,
} from '../../../domain/recommendation.entity';

export const CREATE_RECOMMENDATION_SESSION_USE_CASE = Symbol(
  'CREATE_RECOMMENDATION_SESSION_USE_CASE',
);

export interface CreateRecommendationSessionUseCase {
  createSession(
    userId: string,
    input: CreateRecommendationSessionInput,
  ): Promise<RecommendationSession>;
}

