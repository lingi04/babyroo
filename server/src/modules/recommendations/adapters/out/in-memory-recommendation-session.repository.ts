import { Injectable } from '@nestjs/common';
import { RecommendationSessionRepositoryPort } from '../../application/ports/out/recommendation-session-repository.port';
import { RecommendationSession } from '../../domain/recommendation.entity';

@Injectable()
export class InMemoryRecommendationSessionRepository
  implements RecommendationSessionRepositoryPort
{
  private readonly sessions = new Map<string, RecommendationSession>();

  async create(session: RecommendationSession): Promise<RecommendationSession> {
    this.sessions.set(session.id, session);
    return session;
  }

  async update(session: RecommendationSession): Promise<RecommendationSession> {
    this.sessions.set(session.id, session);
    return session;
  }

  async listByUser(userId: string): Promise<RecommendationSession[]> {
    return [...this.sessions.values()]
      .filter(session => session.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(userId: string, sessionId: string): Promise<RecommendationSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }
    return session;
  }
}
