import type { RecommendationService } from './RecommendationService';
import type { RecommendationRequest, RecommendationResponse } from './types';

export type RemoteRecommendationServiceOptions = {
  endpointUrl?: string;
};

export class RemoteRecommendationService implements RecommendationService {
  constructor(private readonly options: RemoteRecommendationServiceOptions = {}) {}

  async recommend(
    _request: RecommendationRequest,
  ): Promise<RecommendationResponse> {
    return {
      status: 'failed',
      provider: 'remote',
      errorCode: 'not_configured',
      errorMessage:
        this.options.endpointUrl == null
          ? 'Remote recommendation service is not configured yet.'
          : 'Remote recommendation service is not implemented yet.',
      retryable: false,
    };
  }
}
