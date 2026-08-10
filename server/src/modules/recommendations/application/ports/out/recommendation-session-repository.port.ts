import { RecommendationSession } from '../../../domain/recommendation.entity';

export const RECOMMENDATION_SESSION_REPOSITORY_PORT = Symbol(
  'RECOMMENDATION_SESSION_REPOSITORY_PORT',
);

export interface RecommendationSessionRepositoryPort {
  create(session: RecommendationSession): Promise<RecommendationSession>;
  listByUser(userId: string): Promise<RecommendationSession[]>;
  findById(userId: string, sessionId: string): Promise<RecommendationSession | null>;
}

