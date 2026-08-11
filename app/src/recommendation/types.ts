import type { BabyrooEvent, ReservationStatus } from '../data/events';
import type { Child, ChildGender, User } from '../data/user';

export type RecommendationProvider = 'mock' | 'remote';

export type RecommendationErrorCode =
  | 'network_error'
  | 'timeout'
  | 'llm_unavailable'
  | 'invalid_response'
  | 'no_candidates'
  | 'no_results'
  | 'not_configured'
  | 'unknown';

export type Preferences = Partial<{
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

export type RecommendationAnswerValue =
  | 'region_seoul'
  | 'region_gyeonggi'
  | 'region_other'
  | 'departure_input'
  | 'visit_soon'
  | 'visit_this_weekend'
  | 'visit_next_week'
  | 'visit_flexible'
  | 'weather_outdoor_if_suitable'
  | 'weather_prefer_indoor'
  | 'weather_prefer_outdoor'
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
  | 'visitDay'
  | 'weather'
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

export type RecommendationRequest = {
  sessionId: string;
  userId: string;
  selectedChildIds: string[];
  selectedChildren?: Child[];
  answers?: RecommendationAnswerMap;
  preferences: Preferences;
  client: {
    appVersion?: string;
    locale: 'ko-KR';
    timezone: string;
    requestedAt: string;
  };
  debug: boolean;
};

export type RecommendationResult = {
  eventId: string;
  reasons: string[];
  caution?: string;
};

export type RecommendationDebugInfo = {
  prompt?: string;
  rawResponse?: string;
  normalizedResponse?: RecommendationResult[];
};

export type RecommendationResponse =
  | {
      status: 'success';
      provider: RecommendationProvider;
      results: RecommendationResult[];
      debug?: RecommendationDebugInfo;
    }
  | {
      status: 'failed';
      provider: RecommendationProvider;
      errorCode: RecommendationErrorCode;
      errorMessage: string;
      retryable: boolean;
      debug?: RecommendationDebugInfo;
    };

export type RecommendationCredit = {
  policy: 'none' | 'on_success_with_results';
  cost: number;
  consumed: boolean;
};

export type RecommendationSession = {
  id: string;
  createdAt: string;
  userId: string;
  selectedChildIds: string[];
  preferences: Preferences;
  status: 'loading' | 'success' | 'failed';
  results: RecommendationResult[];
  credit: RecommendationCredit;
  debug?: RecommendationDebugInfo;
  error?: {
    code: RecommendationErrorCode;
    message: string;
    retryable: boolean;
  };
};

export type RecommendationPolicy = {
  maxPromptCandidates: number;
  maxInitialResults: number;
};

export type CandidateFilterPolicy = {
  excludeEnded: boolean;
  excludeAgeMismatch: boolean;
  excludeReservationClosed: boolean;
  excludeOutsideVisitWindow: boolean;
  allowUnknownAgeWithCaution: boolean;
  allowUnknownReservationWithCaution: boolean;
  allowUnknownPriceWithCaution: boolean;
  allowUnknownPlaceWithCaution: boolean;
};

export type Candidate = {
  id: string;
  title: string;
  venueName: string;
  region: string;
  locality: string;
  startsAt: string;
  endsAt: string;
  ageMinMonths?: number;
  ageMaxMonths?: number;
  indoor?: boolean;
  priceType: BabyrooEvent['priceType'];
  reservationRequired?: boolean;
  reservationStatus: ReservationStatus;
  category: string;
  tags: string[];
  summary: string;
};

export type RecommendationLocalContext = {
  events: BabyrooEvent[];
  user: User;
  selectedChildren: Child[];
};

export type RecommendationChildContext = {
  id: string;
  nickname: string;
  ageMonths: number;
  gender: ChildGender;
};
