import { Child } from '../../users/domain/user.entity';

export type RecommendationPreferences = Partial<{
  startRegion: 'seoul' | 'gyeonggi' | 'other';
  departureAddress: string;
  visitWindow: 'soon' | 'this_weekend' | 'next_week' | 'flexible';
  weatherPlan: 'outdoor_if_suitable' | 'prefer_indoor' | 'prefer_outdoor';
  mobility: 'car' | 'transit' | 'nearby';
  vibe: 'quiet' | 'lively' | 'any';
  price: 'free' | 'low' | 'any';
  reservation: 'no_reservation' | 'reservation_ok' | 'any';
  duration: 'short' | 'any';
  place: 'indoor' | 'outdoor' | 'any';
  activity: 'experience' | 'exhibition' | 'any';
}>;

export type RecommendationAnswerMap = Record<string, string>;

export type RecommendationResult = {
  eventId: string;
  reasons: string[];
  caution?: string;
};

export type RecommendationSession = {
  id: string;
  userId: string;
  selectedChildIds: string[];
  selectedChildrenSnapshot: Child[];
  answers: RecommendationAnswerMap;
  preferences: RecommendationPreferences;
  results: RecommendationResult[];
  creditCost: number;
  status: 'success' | 'failed';
  createdAt: string;
};

export type CreateRecommendationSessionInput = {
  selectedChildIds?: string[];
  selectedChildren?: Child[];
  answers?: RecommendationAnswerMap;
  preferences?: RecommendationPreferences;
};
