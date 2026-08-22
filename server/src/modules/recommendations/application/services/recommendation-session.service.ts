import { NotFoundError } from '../../../../common/application-error';
import { debugLog } from '../../../../common/debug-log';
import { createId } from '../../../../common/id';
import {
  GET_CURRENT_USER_USE_CASE,
  GetCurrentUserUseCase,
} from '../../../users/application/ports/in/get-current-user.use-case';
import {
  CreateRecommendationSessionInput,
  RecommendationSession,
} from '../../domain/recommendation.entity';
import { CreateRecommendationSessionUseCase } from '../ports/in/create-recommendation-session.use-case';
import { GetRecommendationSessionUseCase } from '../ports/in/get-recommendation-session.use-case';
import { ListRecommendationSessionsUseCase } from '../ports/in/list-recommendation-sessions.use-case';
import {
  RECOMMENDATION_SESSION_REPOSITORY_PORT,
  RecommendationSessionRepositoryPort,
} from '../ports/out/recommendation-session-repository.port';
import {
  RecommendationJobDispatcherPort,
} from '../ports/out/recommendation-job-dispatcher.port';

export class RecommendationSessionService
  implements
    CreateRecommendationSessionUseCase,
    ListRecommendationSessionsUseCase,
    GetRecommendationSessionUseCase
{
  constructor(
    private readonly sessions: RecommendationSessionRepositoryPort,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly recommendationJobDispatcher: RecommendationJobDispatcherPort,
  ) {}

  async createSession(
    userId: string,
    input: CreateRecommendationSessionInput,
  ): Promise<RecommendationSession> {
    debugLog('recommendations.create.start', {
      userId,
      selectedChildIdCount: input.selectedChildIds?.length,
      selectedChildSnapshotCount: input.selectedChildren?.length,
      answerCount: input.answers ? Object.keys(input.answers).length : 0,
    });
    const user = await this.getCurrentUserUseCase.getRequiredUser(userId);
    const selectedChildIds =
      input.selectedChildIds && input.selectedChildIds.length > 0
        ? input.selectedChildIds
        : input.selectedChildren && input.selectedChildren.length > 0
          ? input.selectedChildren.map(child => child.id)
        : user.activeChildIds.length > 0
          ? user.activeChildIds
          : user.children.map(child => child.id);
    const selectedChildren =
      input.selectedChildren && input.selectedChildren.length > 0
        ? input.selectedChildren
        : user.children.filter(child => selectedChildIds.includes(child.id));
    const createdAt = new Date().toISOString();
    const session: RecommendationSession = {
      id: createId('rec'),
      userId,
      selectedChildIds,
      selectedChildrenSnapshot: selectedChildren,
      answers: input.answers ?? {},
      preferences: input.preferences ?? {},
      results: [],
      creditCost: 0,
      status: 'running',
      createdAt,
    };

    const createdSession = await this.sessions.create(session);
    await this.recommendationJobDispatcher.dispatch({
      userId,
      sessionId: createdSession.id,
    });
    debugLog('recommendations.create.success', {
      userId,
      sessionId: createdSession.id,
      status: createdSession.status,
      resultCount: createdSession.results.length,
    });
    return createdSession;
  }

  listSessions(userId: string): Promise<RecommendationSession[]> {
    debugLog('recommendations.list.start', { userId });
    return this.sessions.listByUser(userId);
  }

  async getSession(userId: string, sessionId: string): Promise<RecommendationSession> {
    debugLog('recommendations.get.start', { userId, sessionId });
    const session = await this.sessions.findById(userId, sessionId);
    if (!session) {
      debugLog('recommendations.get.notFound', { userId, sessionId });
      throw new NotFoundError('Recommendation session not found');
    }
    debugLog('recommendations.get.success', { userId, sessionId });
    return session;
  }
}
