import { debugLog } from '../../../../common/debug-log';
import { ApplicationError } from '../../../../common/application-error';
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
  RecommendationSession,
  RecommendationSessionError,
} from '../../domain/recommendation.entity';
import {
  RecommendationEnginePort,
} from '../ports/out/recommendation-engine.port';
import {
  RecommendationJob,
} from '../ports/out/recommendation-job-dispatcher.port';
import {
  RECOMMENDATION_SESSION_REPOSITORY_PORT,
  RecommendationSessionRepositoryPort,
} from '../ports/out/recommendation-session-repository.port';

export class RecommendationJobProcessor {
  constructor(
    private readonly sessions: RecommendationSessionRepositoryPort,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly listEventsUseCase: ListEventsUseCase,
    private readonly consumeRecommendationCreditUseCase: ConsumeRecommendationCreditUseCase,
    private readonly recommendationEngine: RecommendationEnginePort,
  ) {}

  async process(job: RecommendationJob): Promise<void> {
    const session = await this.sessions.findById(job.userId, job.sessionId);

    if (!session) {
      debugLog('recommendations.job.notFound', job);
      return;
    }

    if (session.status !== 'running') {
      debugLog('recommendations.job.skip', {
        ...job,
        status: session.status,
      });
      return;
    }

    try {
      await this.runRecommendation(job, session);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog('recommendations.job.failed', {
        ...job,
        errorMessage,
      });

      await this.sessions.update({
        ...session,
        status: errorMessage.includes('timed out') ? 'timeout' : 'failed',
        results: [],
        creditCost: 0,
        error: {
          code: recommendationJobErrorCode(error, errorMessage),
          message: errorMessage,
          retryable: true,
        },
      });
    }
  }

  private async runRecommendation(
    job: RecommendationJob,
    session: RecommendationSession,
  ): Promise<void> {
    debugLog('recommendations.job.start', {
      ...job,
      selectedChildCount: session.selectedChildrenSnapshot.length,
    });
    const user = await this.getCurrentUserUseCase.getRequiredUser(job.userId);
    const eventList = await this.listEventsUseCase.list({ limit: '300' });
    const results = await this.recommendationEngine.recommend({
      events: eventList.events,
      children: session.selectedChildrenSnapshot,
      preferences: session.preferences,
      requestedAt: session.createdAt,
      userHomeRegion: user.homeRegion,
      userHomeAddress: user.homeAddress,
    });

    if (results.length > 0) {
      await this.consumeRecommendationCreditUseCase.consumeRecommendationCredit(
        job.userId,
      );
    }

    const updatedSession = await this.sessions.update({
      ...session,
      results,
      creditCost: results.length > 0 ? 1 : 0,
      status: results.length > 0 ? 'success' : 'failed',
      error:
        results.length > 0
          ? undefined
          : {
              code: 'no_results',
              message: 'Babyroo API did not return recommendation results.',
              retryable: true,
            },
    });

    debugLog('recommendations.job.success', {
      ...job,
      status: updatedSession.status,
      resultCount: updatedSession.results.length,
    });
  }
}

function recommendationJobErrorCode(
  error: unknown,
  message: string,
): RecommendationSessionError['code'] {
  if (message.includes('timed out')) {
    return 'timeout';
  }

  if (
    error instanceof ApplicationError &&
    error.code === 'INSUFFICIENT_CREDITS'
  ) {
    return 'insufficient_credits';
  }

  return 'llm_unavailable';
}
