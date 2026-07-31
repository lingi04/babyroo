import {
  MockRecommendationService,
  MockRecommendationServiceOptions,
} from './mock/MockRecommendationService';
import {
  RemoteRecommendationService,
  RemoteRecommendationServiceOptions,
} from './RemoteRecommendationService';
import type { RecommendationService } from './RecommendationService';
import type { RecommendationProvider } from './types';

export function createRecommendationService({
  mockOptions,
  provider,
  remoteOptions,
}: {
  provider: RecommendationProvider;
  mockOptions?: MockRecommendationServiceOptions;
  remoteOptions?: RemoteRecommendationServiceOptions;
}): RecommendationService {
  if (provider === 'mock') {
    if (!mockOptions) {
      throw new Error('MockRecommendationService requires mockOptions.');
    }

    return new MockRecommendationService(mockOptions);
  }

  return new RemoteRecommendationService(remoteOptions);
}
