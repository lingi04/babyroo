import { Injectable } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { getDatabaseUrl } from '../../../../common/database-url';
import {
  Prisma,
  PrismaClient,
  RecommendationSession as PrismaRecommendationSession,
} from '../../../../generated/prisma/client';
import { RecommendationSessionRepositoryPort } from '../../application/ports/out/recommendation-session-repository.port';
import {
  RecommendationAnswerMap,
  RecommendationPreferences,
  RecommendationResult,
  RecommendationSessionError,
  RecommendationSession,
} from '../../domain/recommendation.entity';
import { Child } from '../../../users/domain/user.entity';

@Injectable()
export class PrismaRecommendationSessionRepository
  implements RecommendationSessionRepositoryPort
{
  private readonly prisma = new PrismaClient({
    adapter: new PrismaNeon({
      connectionString: getDatabaseUrl() ?? '',
    }),
  });

  async create(session: RecommendationSession): Promise<RecommendationSession> {
    const createdSession = await this.prisma.recommendationSession.create({
      data: {
        id: session.id,
        userId: session.userId,
        selectedChildIds: session.selectedChildIds,
        selectedChildrenSnapshot:
          session.selectedChildrenSnapshot as unknown as Prisma.InputJsonValue,
        answers: session.answers as unknown as Prisma.InputJsonValue,
        preferences: session.preferences as unknown as Prisma.InputJsonValue,
        results: session.results as unknown as Prisma.InputJsonValue,
        creditCost: session.creditCost,
        status: session.status,
        error: session.error as unknown as Prisma.InputJsonValue,
        createdAt: new Date(session.createdAt),
      },
    });

    return this.toDomainSession(createdSession);
  }

  async update(session: RecommendationSession): Promise<RecommendationSession> {
    const updatedSession = await this.prisma.recommendationSession.update({
      where: {
        id: session.id,
      },
      data: this.toPersistenceData(session),
    });

    return this.toDomainSession(updatedSession);
  }

  async listByUser(userId: string): Promise<RecommendationSession[]> {
    const sessions = await this.prisma.recommendationSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map(session => this.toDomainSession(session));
  }

  async findById(
    userId: string,
    sessionId: string,
  ): Promise<RecommendationSession | null> {
    const session = await this.prisma.recommendationSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    return session ? this.toDomainSession(session) : null;
  }

  private toDomainSession(
    session: PrismaRecommendationSession,
  ): RecommendationSession {
    return {
      id: session.id,
      userId: session.userId,
      selectedChildIds: session.selectedChildIds,
      selectedChildrenSnapshot: session.selectedChildrenSnapshot as Child[],
      answers: session.answers as RecommendationAnswerMap,
      preferences: session.preferences as RecommendationPreferences,
      results: session.results as RecommendationResult[],
      creditCost: session.creditCost,
      status: this.toStatus(session.status),
      error: session.error as RecommendationSessionError | undefined,
      createdAt: session.createdAt.toISOString(),
    };
  }

  private toPersistenceData(session: RecommendationSession) {
    return {
      userId: session.userId,
      selectedChildIds: session.selectedChildIds,
      selectedChildrenSnapshot:
        session.selectedChildrenSnapshot as unknown as Prisma.InputJsonValue,
      answers: session.answers as unknown as Prisma.InputJsonValue,
      preferences: session.preferences as unknown as Prisma.InputJsonValue,
      results: session.results as unknown as Prisma.InputJsonValue,
      creditCost: session.creditCost,
      status: session.status,
      error: session.error as unknown as Prisma.InputJsonValue,
      createdAt: new Date(session.createdAt),
    };
  }

  private toStatus(value: string): RecommendationSession['status'] {
    if (
      value === 'running' ||
      value === 'success' ||
      value === 'failed' ||
      value === 'timeout'
    ) {
      return value;
    }

    return 'failed';
  }
}
