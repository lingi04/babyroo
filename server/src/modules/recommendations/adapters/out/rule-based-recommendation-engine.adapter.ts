import { RecommendationEngineInput, RecommendationEnginePort } from '../../application/ports/out/recommendation-engine.port';
import { RecommendationResult } from '../../domain/recommendation.entity';
import { RuleBasedRecommender } from '../../domain/rule-based-recommender';

export class RuleBasedRecommendationEngineAdapter implements RecommendationEnginePort {
  constructor(
    private readonly recommender = new RuleBasedRecommender(),
  ) {}

  async recommend(input: RecommendationEngineInput): Promise<RecommendationResult[]> {
    return this.recommender.recommend(input);
  }
}
