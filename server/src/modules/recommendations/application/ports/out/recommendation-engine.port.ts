import { BabyrooEvent } from '../../../../events/domain/event.entity';
import { Child, UserHomeAddress } from '../../../../users/domain/user.entity';
import {
  RecommendationPreferences,
  RecommendationResult,
} from '../../../domain/recommendation.entity';

export const RECOMMENDATION_ENGINE_PORT = Symbol('RECOMMENDATION_ENGINE_PORT');

export type RecommendationEngineInput = {
  events: BabyrooEvent[];
  children: Child[];
  preferences: RecommendationPreferences;
  requestedAt: string;
  userHomeRegion: string;
  userHomeAddress?: UserHomeAddress;
};

export interface RecommendationEnginePort {
  recommend(input: RecommendationEngineInput): Promise<RecommendationResult[]>;
}
