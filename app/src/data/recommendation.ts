export type RecommendationSession = {
  id: string;
  createdAt: string;
  userId: string;
  childIds: string[];
  answers: RecommendationAnswerMap;
  resultEventIds: string[];
  creditCost: number;
};

export type RecommendationAnswerValue =
  | 'region_seoul'
  | 'region_gyeonggi'
  | 'region_other'
  | 'mobility_car'
  | 'mobility_transit'
  | 'mobility_nearby'
  | 'vibe_quiet'
  | 'vibe_lively'
  | 'vibe_any'
  | 'price_free'
  | 'price_low'
  | 'price_any'
  | 'reservation_none'
  | 'reservation_ok'
  | 'reservation_any'
  | 'duration_short'
  | 'duration_any'
  | 'place_indoor'
  | 'place_outdoor'
  | 'place_any'
  | 'activity_experience'
  | 'activity_exhibition'
  | 'activity_any';

export type RecommendationQuestionId =
  | 'startRegion'
  | 'mobility'
  | 'vibe'
  | 'priceComfort'
  | 'reservationComfort'
  | 'duration'
  | 'place'
  | 'activityStyle';

export type RecommendationAnswerMap = Partial<
  Record<RecommendationQuestionId, RecommendationAnswerValue>
>;

export type RecommendationQuestionOption = {
  label: string;
  value: RecommendationAnswerValue;
};

export type RecommendationQuestion = {
  id: RecommendationQuestionId;
  prompt: string;
  options: RecommendationQuestionOption[];
};
