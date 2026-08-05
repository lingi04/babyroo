import type { BabyrooEvent } from '../../data/events';
import type { Child } from '../../data/user';
import { buildRecommendationPrompt } from './recommendationPrompt';
import {
  defaultCandidateFilterPolicy,
  defaultRecommendationPolicy,
} from './recommendationPolicy';
import type { RecommendationService } from '../RecommendationService';
import { parseRecommendationResponse } from './recommendationValidation';
import type {
  Candidate,
  CandidateFilterPolicy,
  Preferences,
  RecommendationChildContext,
  RecommendationErrorCode,
  RecommendationLocalContext,
  RecommendationPolicy,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationResult,
} from '../types';

export type MockRecommendationServiceOptions = {
  delayMs?: number;
  forceErrorCode?: RecommendationErrorCode;
  getLocalContext: () => RecommendationLocalContext;
  candidateFilterPolicy?: CandidateFilterPolicy;
  recommendationPolicy?: RecommendationPolicy;
};

export class MockRecommendationService implements RecommendationService {
  private readonly delayMs: number;
  private readonly forceErrorCode?: RecommendationErrorCode;
  private readonly getLocalContext: () => RecommendationLocalContext;
  private readonly candidateFilterPolicy: CandidateFilterPolicy;
  private readonly recommendationPolicy: RecommendationPolicy;

  constructor({
    delayMs = 0,
    forceErrorCode,
    getLocalContext,
    candidateFilterPolicy = defaultCandidateFilterPolicy,
    recommendationPolicy = defaultRecommendationPolicy,
  }: MockRecommendationServiceOptions) {
    this.delayMs = delayMs;
    this.forceErrorCode = forceErrorCode;
    this.getLocalContext = getLocalContext;
    this.candidateFilterPolicy = candidateFilterPolicy;
    this.recommendationPolicy = recommendationPolicy;
  }

  async recommend(
    request: RecommendationRequest,
  ): Promise<RecommendationResponse> {
    await delay(this.delayMs);

    const context = this.getLocalContext();
    const children = context.selectedChildren.map(child =>
      childToContext(child),
    );
    const candidates = prepareCandidates({
      children,
      events: context.events,
      filterPolicy: this.candidateFilterPolicy,
      preferences: request.preferences,
      recommendationPolicy: this.recommendationPolicy,
    });
    const prompt = buildRecommendationPrompt({
      candidates,
      children,
      preferences: request.preferences,
      requestedAt: request.client.requestedAt,
      userHomeAddress: formatUserHomeAddress(context.user.homeAddress),
      userHomeRegion: context.user.homeRegion,
    });

    if (this.forceErrorCode) {
      return {
        status: 'failed',
        provider: 'mock',
        errorCode: this.forceErrorCode,
        errorMessage: recommendationErrorMessage(this.forceErrorCode),
        retryable: this.forceErrorCode !== 'not_configured',
        debug: request.debug ? { prompt } : undefined,
      };
    }

    if (candidates.length === 0) {
      return {
        status: 'failed',
        provider: 'mock',
        errorCode: 'no_candidates',
        errorMessage: recommendationErrorMessage('no_candidates'),
        retryable: true,
        debug: request.debug ? { prompt } : undefined,
      };
    }

    const mockResults = candidates
      .slice(0, this.recommendationPolicy.maxInitialResults)
      .map(candidate => candidateToMockResult(candidate, request.preferences));
    const rawResponse = JSON.stringify({ results: mockResults });
    const parsed = parseRecommendationResponse(
      rawResponse,
      new Set(candidates.map(candidate => candidate.id)),
      { maxResults: this.recommendationPolicy.maxInitialResults },
    );

    if (!parsed.ok) {
      return {
        status: 'failed',
        provider: 'mock',
        errorCode: 'invalid_response',
        errorMessage: parsed.errorMessage,
        retryable: true,
        debug: request.debug
          ? { prompt, rawResponse: parsed.rawResponse }
          : undefined,
      };
    }

    return {
      status: 'success',
      provider: 'mock',
      results: parsed.results,
      debug: request.debug
        ? {
            prompt,
            rawResponse: parsed.rawResponse,
            normalizedResponse: parsed.results,
          }
        : undefined,
    };
  }
}

function prepareCandidates({
  children,
  events,
  filterPolicy,
  preferences,
  recommendationPolicy,
}: {
  children: RecommendationChildContext[];
  events: BabyrooEvent[];
  filterPolicy: CandidateFilterPolicy;
  preferences: Preferences;
  recommendationPolicy: RecommendationPolicy;
}) {
  const visitWindow = preferenceVisitWindow(preferences);

  return events
    .filter(event => {
      if (eventIsSeoulKidsCafe(event)) {
        return false;
      }

      if (filterPolicy.excludeEnded && event.endsAt < formatDate(new Date())) {
        return false;
      }

      if (
        filterPolicy.excludeReservationClosed &&
        event.reservationStatus === 'closed'
      ) {
        return false;
      }

      if (
        filterPolicy.excludeOutsideVisitWindow &&
        visitWindow &&
        !eventOverlapsDateRange(event, visitWindow)
      ) {
        return false;
      }

      if (
        filterPolicy.excludeAgeMismatch &&
        !eventFitsAllChildren(event, children)
      ) {
        return false;
      }

      if (preferences.place === 'indoor' && event.indoor === false) {
        return false;
      }

      if (preferences.place === 'outdoor' && event.indoor === true) {
        return false;
      }

      if (preferences.price === 'free' && event.priceType !== 'free') {
        return false;
      }

      if (
        preferences.reservation === 'no_reservation' &&
        event.reservationRequired === true
      ) {
        return false;
      }

      return true;
    })
    .sort(
      (left, right) =>
        candidateScore(left, preferences) - candidateScore(right, preferences),
    )
    .slice(0, recommendationPolicy.maxPromptCandidates)
    .map(eventToCandidate);
}

function candidateToMockResult(
  candidate: Candidate,
  preferences: Preferences,
): RecommendationResult {
  const reasons = ['선택한 조건과 비교해 추천 후보로 골랐어요.'];

  if (
    preferences.weatherPlan === 'prefer_indoor' &&
    candidate.indoor === true
  ) {
    reasons.push('날씨와 상관없이 움직이기 쉬운 실내 행사예요.');
  }

  if (
    preferences.weatherPlan === 'outdoor_if_suitable' &&
    candidate.indoor === false
  ) {
    reasons.push('날씨가 괜찮다면 야외 활동으로 즐기기 좋아요.');
  }

  if (
    preferences.weatherPlan === 'prefer_outdoor' &&
    candidate.indoor === false
  ) {
    reasons.push('야외 활동을 선호하는 조건과 잘 맞아요.');
  }

  if (candidate.priceType === 'free') {
    reasons.push('무료 행사라 비용 부담이 낮아요.');
  }

  return {
    eventId: candidate.id,
    reasons,
    caution:
      candidate.reservationStatus === 'unknown' ||
      candidate.reservationRequired === true
        ? '예약 가능 여부는 원문에서 다시 확인해 주세요.'
        : undefined,
  };
}

function candidateScore(event: BabyrooEvent, preferences: Preferences) {
  let score = 0;

  if (
    preferences.startRegion &&
    !eventMatchesRegion(event, preferences.startRegion)
  ) {
    score += 4;
  }

  if (preferences.weatherPlan === 'prefer_indoor' && event.indoor === false) {
    score += 3;
  }

  if (preferences.weatherPlan === 'prefer_outdoor' && event.indoor === true) {
    score += 2;
  }

  if (preferences.price === 'low' && event.priceType === 'paid') {
    score += 1;
  }

  if (preferences.vibe === 'quiet' && event.category === 'performance') {
    score += 2;
  }

  if (
    preferences.activity === 'experience' &&
    event.category !== 'experience'
  ) {
    score += 2;
  }

  if (
    preferences.activity === 'exhibition' &&
    event.category !== 'exhibition' &&
    event.category !== 'museum'
  ) {
    score += 2;
  }

  return score;
}

function eventFitsAllChildren(
  event: BabyrooEvent,
  children: RecommendationChildContext[],
) {
  if (children.length === 0) {
    return true;
  }

  const hasKnownAgeRange =
    event.ageMinMonths != null || event.ageMaxMonths != null;

  if (!hasKnownAgeRange) {
    return true;
  }

  return children.every(child => {
    if (event.ageMinMonths != null && child.ageMonths < event.ageMinMonths) {
      return false;
    }

    if (event.ageMaxMonths != null && child.ageMonths > event.ageMaxMonths) {
      return false;
    }

    return true;
  });
}

function eventMatchesRegion(
  event: BabyrooEvent,
  region: Preferences['startRegion'],
) {
  if (region === 'seoul') {
    return event.region === '서울';
  }

  if (region === 'gyeonggi') {
    return event.region === '경기';
  }

  return event.region !== '서울' && event.region !== '경기';
}

function preferenceVisitWindow(preferences: Preferences) {
  const today = new Date();

  if (preferences.visitWindow === 'soon') {
    return {
      start: addDays(today, 1),
      end: addDays(today, 2),
    };
  }

  if (preferences.visitWindow === 'this_weekend') {
    return thisWeekendRange(today);
  }

  if (preferences.visitWindow === 'next_week') {
    return nextWeekRange(today);
  }

  return null;
}

function eventOverlapsDateRange(
  event: BabyrooEvent,
  range: { start: Date; end: Date },
) {
  const eventStart = parseDate(event.startsAt);
  const eventEnd = parseDate(event.endsAt);
  const rangeStart = parseDate(formatDate(range.start));
  const rangeEnd = parseDate(formatDate(range.end));

  return eventStart <= rangeEnd && eventEnd >= rangeStart;
}

function childToContext(child: Child): RecommendationChildContext {
  return {
    id: child.id,
    nickname: child.nickname,
    ageMonths: calculateAgeMonths(child.birthDate),
    gender: child.gender,
  };
}

function eventIsSeoulKidsCafe(event: BabyrooEvent) {
  return event.source === 'seoul_kids_cafe';
}

function formatUserHomeAddress(
  homeAddress: RecommendationLocalContext['user']['homeAddress'],
) {
  if (!homeAddress) {
    return undefined;
  }

  return [
    homeAddress.roadAddress || homeAddress.address,
    homeAddress.detailAddress,
  ]
    .filter(Boolean)
    .join(' ');
}

function eventToCandidate(event: BabyrooEvent): Candidate {
  return {
    id: event.id,
    title: event.title,
    venueName: event.venueName,
    region: event.region,
    locality: event.locality,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    ageMinMonths: event.ageMinMonths,
    ageMaxMonths: event.ageMaxMonths,
    indoor: event.indoor,
    priceType: event.priceType,
    reservationRequired: event.reservationRequired,
    reservationStatus: event.reservationStatus,
    category: event.category,
    tags: event.tags,
    summary: event.summary,
  };
}

function recommendationErrorMessage(errorCode: RecommendationErrorCode) {
  if (errorCode === 'no_candidates') {
    return '조건에 맞는 후보가 없어요.';
  }

  if (errorCode === 'timeout') {
    return '추천 시간이 조금 오래 걸리고 있어요.';
  }

  if (errorCode === 'not_configured') {
    return '추천 서비스가 아직 설정되지 않았어요.';
  }

  return '지금은 추천이 어려워요.';
}

function delay(delayMs: number) {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>(resolve => setTimeout(resolve, delayMs));
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function calculateAgeMonths(birthDateValue: string) {
  const birthDate = parseDate(birthDateValue);
  const today = new Date();
  let ageMonths =
    (today.getFullYear() - birthDate.getFullYear()) * 12 +
    (today.getMonth() - birthDate.getMonth());

  if (today.getDate() < birthDate.getDate()) {
    ageMonths -= 1;
  }

  return Math.max(ageMonths, 0);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function thisWeekendRange(referenceDate: Date) {
  const day = referenceDate.getDay();

  if (day === 5 || day === 6 || day === 0) {
    return {
      start: new Date(referenceDate),
      end: nextWeekday(referenceDate, 0),
    };
  }

  return {
    start: nextWeekday(referenceDate, 6),
    end: nextWeekday(referenceDate, 0),
  };
}

function nextWeekRange(referenceDate: Date) {
  const nextMonday = nextWeekday(addDays(referenceDate, 1), 1);

  return {
    start: nextMonday,
    end: addDays(nextMonday, 6),
  };
}

function nextWeekday(referenceDate: Date, weekday: number) {
  const daysUntilWeekday = (weekday - referenceDate.getDay() + 7) % 7;

  return addDays(referenceDate, daysUntilWeekday);
}
