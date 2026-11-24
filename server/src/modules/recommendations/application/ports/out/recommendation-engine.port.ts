import { BabyrooEvent } from '../../../../events/domain/event.entity';
import { Child } from '../../../../users/domain/user.entity';
import {
  RecommendationPreferences,
  RecommendationResult,
} from '../../../domain/recommendation.entity';

export const RECOMMENDATION_ENGINE_PORT = Symbol('RECOMMENDATION_ENGINE_PORT');

export type RecommendationEngineInput = {
  events: BabyrooEvent[];
  children: Child[];
  selectedChildIds?: string[];
  preferences: RecommendationPreferences;
  requestedAt: string;
};

export interface RecommendationEnginePort {
  recommend(input: RecommendationEngineInput): Promise<RecommendationResult[]>;
}
