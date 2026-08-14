import { NotFoundError } from '../../../../common/application-error';
import { debugLog } from '../../../../common/debug-log';
import { createId } from '../../../../common/id';
import {
  CONSUME_RECOMMENDATION_CREDIT_USE_CASE,
  ConsumeRecommendationCreditUseCase,
} from '../../../credits/application/ports/in/consume-recommendation-credit.use-case';
import {
  LIST_EVENTS_USE_CASE,
  ListEventsUseCase,
} from '../../../events/application/ports/in/list-events.use-case';
import {
  GET_CURRENT_USER_USE_CASE,
  GetCurrentUserUseCase,
} from '../../../users/application/ports/in/get-current-user.use-case';
import {
  CreateRecommendationSessionInput,
  RecommendationResult,
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
  RecommendationEnginePort,
} from '../ports/out/recommendation-engine.port';

export class RecommendationSessionService
  implements
    CreateRecommendationSessionUseCase,
    ListRecommendationSessionsUseCase,
    GetRecommendationSessionUseCase
{
  constructor(
    private readonly sessions: RecommendationSessionRepositoryPort,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly listEventsUseCase: ListEventsUseCase,
    private readonly consumeRecommendationCreditUseCase: ConsumeRecommendationCreditUseCase,
    private readonly recommendationEngine: RecommendationEnginePort,
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
    const eventList = await this.listEventsUseCase.list({ limit: '300' });
    debugLog('recommendations.candidates.loaded', {
      userId,
      eventCount: eventList.events.length,
      selectedChildCount: selectedChildren.length,
    });
    const createdAt = new Date().toISOString();
    let results: RecommendationResult[] = [];

    try {
      results = await this.recommendationEngine.recommend({
        events: eventList.events,
        children: selectedChildren,
        preferences: input.preferences ?? {},
        requestedAt: createdAt,
        userHomeRegion: user.homeRegion,
        userHomeAddress: user.homeAddress,
      });
    } catch (error) {
      debugLog('recommendations.engine.failed', {
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    if (results.length > 0) {
      await this.consumeRecommendationCreditUseCase.consumeRecommendationCredit(userId);
    }

    const session: RecommendationSession = {
      id: createId('rec'),
      userId,
      selectedChildIds,
      selectedChildrenSnapshot: selectedChildren,
      answers: input.answers ?? {},
      preferences: input.preferences ?? {},
      results,
      creditCost: results.length > 0 ? 1 : 0,
      status: results.length > 0 ? 'success' : 'failed',
      createdAt,
    };

    const createdSession = await this.sessions.create(session);
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
