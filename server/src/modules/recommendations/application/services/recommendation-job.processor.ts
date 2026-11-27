import { RECOMMENDATION_CREDIT_COST } from '../../../credits/domain/credit-pricing';
import { debugLog } from '../../../../common/debug-log';
import { ApplicationError } from '../../../../common/application-error';
import { Logger } from '@nestjs/common';
import { PushNotificationPort } from '../../../notifications/application/push-notification.port';
import {
  ConsumeRecommendationCreditUseCase,
} from '../../../credits/application/ports/in/consume-recommendation-credit.use-case';
import {
  ListEventsUseCase,
} from '../../../events/application/ports/in/list-events.use-case';
import { resolveVisitDateRange, seoulDate } from '../../domain/recommendation-dates';
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
  RecommendationSessionRepositoryPort,
} from '../ports/out/recommendation-session-repository.port';

export class RecommendationJobProcessor {
  constructor(
    private readonly sessions: RecommendationSessionRepositoryPort,
    private readonly listEventsUseCase: ListEventsUseCase,
    private readonly consumeRecommendationCreditUseCase: ConsumeRecommendationCreditUseCase,
    private readonly recommendationEngine: RecommendationEnginePort,
    private readonly notifications: PushNotificationPort,
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

    let completedSession: RecommendationSession;
    try {
      completedSession = await this.runRecommendation(job, session);
    } catch (error) {
      const failure = recommendationJobError(error);
      debugLog('recommendations.job.failed', {
        ...job,
        code: failure.code,
      });

      completedSession = {
        ...session,
        status: failure.code === 'timeout' ? 'timeout' : 'failed',
        results: [],
        creditCost: 0,
        error: failure,
      };
    }

    // Keep delivery outside recommendation error handling: a push failure must
    // not overwrite the saved outcome or run credit consumption again.
    const debit = async () => {
      await this.consumeRecommendationCreditUseCase.consumeRecommendationCredit(job.userId);
    };
    let savedSession: RecommendationSession | null;
    try {
      savedSession = await this.sessions.update(completedSession, debit);
    } catch (error) {
      if (!(error instanceof ApplicationError) || error.code !== 'INSUFFICIENT_CREDITS') {
        throw error;
      }
      savedSession = await this.sessions.update({
        ...session,
        status: 'failed',
        results: [],
        creditCost: 0,
        error: recommendationJobError(error),
      }, debit);
    }
    if (!savedSession) return;
    debugLog('recommendations.job.completed', {
      ...job,
      status: savedSession.status,
      resultCount: savedSession.results.length,
    });
    if (savedSession.status === 'running') return;
    try {
      await this.notifications.sendRecommendationCompleted({
        userId: savedSession.userId,
        sessionId: savedSession.id,
        status: savedSession.status,
      });
    } catch {
      Logger.warn(`Push delivery failed for recommendation ${savedSession.id}`, 'RecommendationJobProcessor');
    }
  }

  private async runRecommendation(
    job: RecommendationJob,
    session: RecommendationSession,
  ): Promise<RecommendationSession> {
    debugLog('recommendations.job.start', {
      ...job,
      selectedChildCount: session.selectedChildrenSnapshot.length,
    });
    const today = seoulDate(session.createdAt);
    const range = session.preferences.resolvedVisitRange ??
      resolveVisitDateRange(session.preferences.visitWindow, today);
    const events = await this.listEventsUseCase.listPublishedSnapshot({
      startsBefore: range?.end,
      endsAfter: range?.start ?? today,
    });
    const results = await this.recommendationEngine.recommend({
      events,
      children: session.selectedChildrenSnapshot,
      selectedChildIds: session.selectedChildIds,
      preferences: session.preferences,
      requestedAt: session.createdAt,
    });

    return {
      ...session,
      results,
      creditCost: results.length > 0 ? RECOMMENDATION_CREDIT_COST : 0,
      status: results.length > 0 ? 'success' : 'failed',
      error:
        results.length > 0
          ? undefined
          : {
              code: 'no_results',
              message: 'Babyroo API did not return recommendation results.',
              retryable: true,
            },
    };
  }
}

function recommendationJobError(error: unknown): RecommendationSessionError {
  if (error instanceof Error && error.message.includes('timed out')) {
    return { code: 'timeout', message: 'Recommendation request timed out.', retryable: true };
  }

  if (
    error instanceof ApplicationError &&
    error.code === 'INSUFFICIENT_CREDITS'
  ) {
    return { code: 'insufficient_credits', message: 'Insufficient recommendation credits.', retryable: true };
  }

  return { code: 'llm_unavailable', message: 'Recommendation provider is unavailable.', retryable: true };
}
