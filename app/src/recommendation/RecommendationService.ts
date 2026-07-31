import type { RecommendationRequest, RecommendationResponse } from './types';

export interface RecommendationService {
  recommend(request: RecommendationRequest): Promise<RecommendationResponse>;
}
