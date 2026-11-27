import { RecommendationSession } from '../../../domain/recommendation.entity';

export const RECOMMENDATION_SESSION_REPOSITORY_PORT = Symbol(
  'RECOMMENDATION_SESSION_REPOSITORY_PORT',
);

export interface RecommendationSessionRepositoryPort {
  create(session: RecommendationSession): Promise<RecommendationSession>;
  update(
    session: RecommendationSession,
    debitInMemory: () => Promise<void>,
  ): Promise<RecommendationSession | null>;
  listByUser(userId: string): Promise<RecommendationSession[]>;
  findById(userId: string, sessionId: string): Promise<RecommendationSession | null>;
}
