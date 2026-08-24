import type { RecommendationService } from './RecommendationService';
import {
  BABYROO_API_BASE_URL,
  BabyrooApiError,
  getEventFromBabyrooApi,
  getJson,
  postJson,
} from '../api/babyrooApi';
import type { Child } from '../data/user';
import type {
  RecommendationErrorCode,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationResult,
  RecommendationSession,
} from './types';

export type RemoteRecommendationServiceOptions = {
  endpointUrl?: string;
  accessToken?: string;
  selectedChildren?: Child[];
  timeoutMs?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
};

const DEFAULT_RECOMMENDATION_CREATE_TIMEOUT_MS = 7000;
const DEFAULT_RECOMMENDATION_POLL_INTERVAL_MS = 10000;
const DEFAULT_RECOMMENDATION_POLL_TIMEOUT_MS = 180000;

type RemoteRecommendationSession = {
  id: string;
  userId: string;
  selectedChildIds: string[];
  selectedChildrenSnapshot?: Child[];
  preferences: RecommendationRequest['preferences'];
  results: RecommendationResult[];
  creditCost: number;
  status: 'running' | 'success' | 'failed' | 'timeout';
  error?: {
    code: RecommendationErrorCode;
    message: string;
    retryable: boolean;
  };
  createdAt: string;
};

export class RemoteRecommendationService implements RecommendationService {
  constructor(
    private readonly options: RemoteRecommendationServiceOptions = {},
  ) {}

  async listSessions(): Promise<RecommendationSession[]> {
    if (!this.options.accessToken) {
      return [];
    }

    const sessions = await getJson<RemoteRecommendationSession[]>({
      accessToken: this.options.accessToken,
      path: this.options.endpointUrl ?? '/recommendation-sessions',
    });

    return Promise.all(sessions.map(toRecommendationSession));
  }

  async getSession(sessionId: string): Promise<RecommendationSession> {
    if (!this.options.accessToken) {
      throw new Error('Babyroo API access token is not configured.');
    }

    const session = await getJson<RemoteRecommendationSession>({
      accessToken: this.options.accessToken,
      path: recommendationSessionPath(this.options.endpointUrl, sessionId),
    });

    return toRecommendationSession(session);
  }

  async createSession(
    request: RecommendationRequest,
  ): Promise<RecommendationSession> {
    if (!this.options.accessToken) {
      throw new Error('Babyroo API access token is not configured.');
    }

    const session = await postJson<RemoteRecommendationSession>({
      accessToken: this.options.accessToken,
      body: {
        selectedChildIds: request.selectedChildIds,
        selectedChildren:
          request.selectedChildren ?? this.options.selectedChildren,
        answers: request.answers ?? {},
        preferences: request.preferences,
      },
      path: this.options.endpointUrl ?? '/recommendation-sessions',
      timeoutMs:
        this.options.timeoutMs ?? DEFAULT_RECOMMENDATION_CREATE_TIMEOUT_MS,
    });

    return toRecommendationSession(session);
  }

  async recommend(
    request: RecommendationRequest,
  ): Promise<RecommendationResponse> {
    if (!this.options.accessToken) {
      return {
        status: 'failed',
        provider: 'remote',
        errorCode: 'not_configured',
        errorMessage: 'Babyroo API access token is not configured.',
        retryable: false,
      };
    }

    try {
      const session = await this.createSession(request);
      const resolvedSession = await this.waitForFinalSession(session);

      if (
        resolvedSession.status === 'failed' ||
        resolvedSession.results.length === 0
      ) {
        return {
          status: 'failed',
          provider: 'remote',
          errorCode: resolvedSession.error?.code ?? 'no_results',
          errorMessage:
            resolvedSession.error?.message ??
            'Babyroo API did not return recommendation results.',
          retryable: true,
        };
      }

      return {
        status: 'success',
        provider: 'remote',
        results: resolvedSession.results,
      };
    } catch (error) {
      return {
        status: 'failed',
        provider: 'remote',
        errorCode: remoteRecommendationErrorCode(error),
        errorMessage:
          error instanceof Error
            ? error.message
            : `Could not reach Babyroo API at ${BABYROO_API_BASE_URL}.`,
        retryable: true,
      };
    }
  }

  private async waitForFinalSession(
    initialSession: RecommendationSession,
  ): Promise<RecommendationSession> {
    let session = initialSession;
    const deadline =
      Date.now() +
      (this.options.pollTimeoutMs ?? DEFAULT_RECOMMENDATION_POLL_TIMEOUT_MS);

    while (session.status === 'loading') {
      if (Date.now() >= deadline) {
        return {
          ...session,
          status: 'failed',
          error: {
            code: 'timeout',
            message: '추천 시간이 조금 오래 걸리고 있어요.',
            retryable: true,
          },
        };
      }

      await sleep(
        this.options.pollIntervalMs ?? DEFAULT_RECOMMENDATION_POLL_INTERVAL_MS,
      );

      session = await this.getSession(session.id);
    }

    return session;
  }
}

async function toRecommendationSession(
  session: RemoteRecommendationSession,
): Promise<RecommendationSession> {
  const eventSnapshots = await loadRecommendationEventSnapshots(
    session.results,
  );

  return {
    id: session.id,
    createdAt: session.createdAt,
    userId: session.userId,
    selectedChildIds: session.selectedChildIds,
    selectedChildrenSnapshot: session.selectedChildrenSnapshot,
    preferences: session.preferences,
    status:
      session.status === 'running'
        ? 'loading'
        : session.status === 'timeout'
          ? 'failed'
          : session.status,
    results: session.results,
    eventSnapshots,
    credit: {
      policy: 'on_success_with_results',
      cost: session.creditCost,
      consumed: session.creditCost > 0,
    },
    error:
      session.status === 'failed'
        ? {
            code: session.error?.code ?? 'no_results',
            message:
              session.error?.message ??
              'Babyroo API did not return recommendation results.',
            retryable: session.error?.retryable ?? true,
          }
        : session.status === 'timeout'
        ? {
            code: 'timeout',
            message: '추천 시간이 조금 오래 걸리고 있어요.',
            retryable: true,
          }
        : undefined,
  };
}

async function loadRecommendationEventSnapshots(
  results: RecommendationResult[],
) {
  const settledEvents = await Promise.allSettled(
    results.map(result => getEventFromBabyrooApi(result.eventId)),
  );

  return settledEvents
    .map(result => (result.status === 'fulfilled' ? result.value : null))
    .filter(event => event !== null);
}

function remoteRecommendationErrorCode(
  error: unknown,
): RecommendationErrorCode {
  if (error instanceof BabyrooApiError) {
    if (error.statusCode === 504 || error.message.includes('timed out')) {
      return 'timeout';
    }

    if (error.code === 'RECOMMENDATION_ENGINE_FAILED') {
      return 'llm_unavailable';
    }

    if (error.code === 'INSUFFICIENT_CREDITS') {
      return 'insufficient_credits';
    }
  }

  if (error instanceof Error && error.message.includes('timed out')) {
    return 'timeout';
  }

  return 'network_error';
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise(resolve => setTimeout(resolve, ms));
}

function recommendationSessionPath(endpointUrl: string | undefined, sessionId: string) {
  return `${endpointUrl ?? '/recommendation-sessions'}/${encodeURIComponent(sessionId)}`;
}
