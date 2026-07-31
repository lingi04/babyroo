import type { CandidateFilterPolicy, RecommendationPolicy } from '../types';

export const defaultRecommendationPolicy: RecommendationPolicy = {
  maxPromptCandidates: 20,
  maxInitialResults: 3,
};

export const defaultCandidateFilterPolicy: CandidateFilterPolicy = {
  excludeEnded: true,
  excludeAgeMismatch: true,
  excludeReservationClosed: true,
  excludeOutsideVisitWindow: true,
  allowUnknownAgeWithCaution: true,
  allowUnknownReservationWithCaution: true,
  allowUnknownPriceWithCaution: true,
  allowUnknownPlaceWithCaution: true,
};
