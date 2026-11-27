import { Injectable } from '@nestjs/common';
import { RecommendationSessionRepositoryPort } from '../../application/ports/out/recommendation-session-repository.port';
import { RecommendationSession } from '../../domain/recommendation.entity';

@Injectable()
export class InMemoryRecommendationSessionRepository
  implements RecommendationSessionRepositoryPort
{
  private readonly sessions = new Map<string, RecommendationSession>();
  private readonly completing = new Set<string>();

  async create(session: RecommendationSession): Promise<RecommendationSession> {
    this.sessions.set(session.id, session);
    return session;
  }

  async update(
    session: RecommendationSession,
    debitInMemory: () => Promise<void>,
  ): Promise<RecommendationSession | null> {
    const current = this.sessions.get(session.id);
    if (current?.userId !== session.userId || current.status !== 'running' ||
        this.completing.has(session.id)) return null;

    this.completing.add(session.id);
    try {
      if (session.creditCost > 0) await debitInMemory();
      this.sessions.set(session.id, session);
      return session;
    } finally {
      this.completing.delete(session.id);
    }
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
