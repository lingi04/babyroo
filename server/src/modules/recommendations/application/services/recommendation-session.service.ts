import { NotFoundError } from '../../../../common/application-error';
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
  RecommendationSession,
} from '../../domain/recommendation.entity';
import { RuleBasedRecommender } from '../../domain/rule-based-recommender';
import { CreateRecommendationSessionUseCase } from '../ports/in/create-recommendation-session.use-case';
import { GetRecommendationSessionUseCase } from '../ports/in/get-recommendation-session.use-case';
import { ListRecommendationSessionsUseCase } from '../ports/in/list-recommendation-sessions.use-case';
import {
  RECOMMENDATION_SESSION_REPOSITORY_PORT,
  RecommendationSessionRepositoryPort,
} from '../ports/out/recommendation-session-repository.port';

export class RecommendationSessionService
  implements
    CreateRecommendationSessionUseCase,
    ListRecommendationSessionsUseCase,
    GetRecommendationSessionUseCase
{
  private readonly recommender = new RuleBasedRecommender();

  constructor(
    private readonly sessions: RecommendationSessionRepositoryPort,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly listEventsUseCase: ListEventsUseCase,
    private readonly consumeRecommendationCreditUseCase: ConsumeRecommendationCreditUseCase,
  ) {}

  async createSession(
    userId: string,
    input: CreateRecommendationSessionInput,
  ): Promise<RecommendationSession> {
    const user = await this.getCurrentUserUseCase.getRequiredUser(userId);
    const selectedChildIds =
      input.selectedChildIds && input.selectedChildIds.length > 0
        ? input.selectedChildIds
        : user.activeChildIds.length > 0
          ? user.activeChildIds
          : user.children.map(child => child.id);
    const selectedChildren = user.children.filter(child =>
      selectedChildIds.includes(child.id),
    );
    const eventList = await this.listEventsUseCase.list({ limit: '100' });
    const results = this.recommender.recommend(
      eventList.events,
      selectedChildren,
      input.preferences ?? {},
    );

    await this.consumeRecommendationCreditUseCase.consumeRecommendationCredit(userId);

    const session: RecommendationSession = {
      id: createId('rec'),
      userId,
      selectedChildIds,
      answers: input.answers ?? {},
      preferences: input.preferences ?? {},
      results,
      creditCost: 1,
      status: results.length > 0 ? 'success' : 'failed',
      createdAt: new Date().toISOString(),
    };

    return this.sessions.create(session);
  }

  listSessions(userId: string): Promise<RecommendationSession[]> {
    return this.sessions.listByUser(userId);
  }

  async getSession(userId: string, sessionId: string): Promise<RecommendationSession> {
    const session = await this.sessions.findById(userId, sessionId);
    if (!session) {
      throw new NotFoundError('Recommendation session not found');
    }
    return session;
  }
}
