import { RecommendationEnginePort, RecommendationEngineInput } from '../../application/ports/out/recommendation-engine.port';
import { RecommendationResult } from '../../domain/recommendation.entity';
import { RuleBasedRecommender } from '../../domain/rule-based-recommender';

export class RuleBasedRecommendationEngineAdapter implements RecommendationEnginePort {
  constructor(
    private readonly recommender = new RuleBasedRecommender(),
  ) {}

  recommend(input: RecommendationEngineInput): Promise<RecommendationResult[]> {
    return Promise.resolve(
      this.recommender.recommend(
        input.events,
        input.children,
        input.preferences,
      ),
    );
  }
}
