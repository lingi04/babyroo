import type { RecommendationService } from './RecommendationService';
import {
  BABYROO_API_BASE_URL,
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
};

const DEFAULT_RECOMMENDATION_TIMEOUT_MS = 130000;

type RemoteRecommendationSession = {
  id: string;
  userId: string;
  selectedChildIds: string[];
  selectedChildrenSnapshot?: Child[];
  preferences: RecommendationRequest['preferences'];
  results: RecommendationResult[];
  creditCost: number;
  status: 'success' | 'failed';
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
        timeoutMs: this.options.timeoutMs ?? DEFAULT_RECOMMENDATION_TIMEOUT_MS,
      });

      if (session.status === 'failed' || session.results.length === 0) {
        return {
          status: 'failed',
          provider: 'remote',
          errorCode: 'no_results',
          errorMessage: 'Babyroo API did not return recommendation results.',
          retryable: true,
        };
      }

      return {
        status: 'success',
        provider: 'remote',
        results: session.results,
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
    status: session.status,
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
            code: 'no_results',
            message: 'Babyroo API did not return recommendation results.',
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
  if (error instanceof Error && error.message.includes('timed out')) {
    return 'timeout';
  }

  return 'network_error';
}
