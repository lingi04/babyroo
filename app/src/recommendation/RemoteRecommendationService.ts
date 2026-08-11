import type { RecommendationService } from './RecommendationService';
import { BABYROO_API_BASE_URL, postJson } from '../api/babyrooApi';
import type { Child } from '../data/user';
import type {
  RecommendationRequest,
  RecommendationResponse,
  RecommendationResult,
} from './types';

export type RemoteRecommendationServiceOptions = {
  endpointUrl?: string;
  accessToken?: string;
  selectedChildren?: Child[];
};

export class RemoteRecommendationService implements RecommendationService {
  constructor(private readonly options: RemoteRecommendationServiceOptions = {}) {}

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
      const session = await postJson<{ results: RecommendationResult[] }>({
        accessToken: this.options.accessToken,
        body: {
          selectedChildIds: request.selectedChildIds,
          selectedChildren: request.selectedChildren ?? this.options.selectedChildren,
          answers: request.answers ?? {},
          preferences: request.preferences,
        },
        path: this.options.endpointUrl ?? '/recommendation-sessions',
      });

      return {
        status: 'success',
        provider: 'remote',
        results: session.results,
      };
    } catch (error) {
      return {
        status: 'failed',
        provider: 'remote',
        errorCode: 'network_error',
        errorMessage:
          error instanceof Error
            ? error.message
            : `Could not reach Babyroo API at ${BABYROO_API_BASE_URL}.`,
        retryable: true,
      };
    }
  }
}
