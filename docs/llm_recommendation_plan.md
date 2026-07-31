# LLM recommendation implementation plan

This document records the implementation decisions for moving Babyroo recommendations from local rule-based ranking toward an LLM-backed recommendation service.

## Goals

- Keep the React Native recommendation screen independent from the concrete recommendation implementation.
- Build a mock recommendation service first.
- Later replace the mock implementation with a backend-backed implementation by swapping service implementations, not rewriting screen logic.
- Keep recommendation inputs structured and extensible.
- Show recommendation reasons and cautions on result cards.
- Keep real backend, real OpenAI calls, credit enforcement, and persistence out of the first implementation.

## Product flow decisions

The recommendation request should not fire immediately after the last interview question.

Flow:

1. User taps `추천 받기`.
2. App asks fixed interview questions.
3. App shows an inline confirmation card.
4. User reviews selected preferences.
5. User can tap any answer row to edit that answer directly.
6. User confirms.
7. App calls the recommendation service.
8. App shows loading, success, or failure state.

The confirmation card is inline on the recommendation tab for now, but it should be implemented as a separate component so it can later move into a bottom sheet, modal, or full-screen step.

Confirmation card content:

- selected preferences summary
- credit/use guidance
- dev-only candidate/policy/debug info

Current credit policy:

- Do not enforce credit consumption yet.
- Structure the model so future credit policy can be changed.
- Do not consume credit on service failure.
- Do not consume credit when the service returns no valid recommendations.

Future credit policy should support:

```ts
type RecommendationCreditPolicy =
  | 'none'
  | 'on_request'
  | 'on_success_with_results';
```

## Preferences naming

Use `Preferences` as the recommendation input object name inside the recommendation module.

Rationale:

- Short and intuitive.
- More extensible than `answers`.
- Not tied to the current interview UI.
- Can include future preferences gathered from settings, behavior, or backend data.

Principle:

> `Preferences` describes what the family wants or needs, independent of how Babyroo learned it.

Initial shape:

```ts
type Preferences = Partial<{
  startRegion: 'seoul' | 'gyeonggi' | 'other';
  visitWindow: 'soon' | 'this_weekend' | 'next_week' | 'flexible';
  weather: 'clear_or_cloudy' | 'rain_or_snow' | 'hot_or_cold' | 'unknown';
  mobility: 'car' | 'transit' | 'nearby';
  vibe: 'quiet' | 'lively' | 'any';
  price: 'free' | 'low' | 'any';
  reservation: 'no_reservation' | 'reservation_ok' | 'any';
  duration: 'short' | 'any';
  place: 'indoor' | 'outdoor' | 'any';
  activity: 'experience' | 'exhibition' | 'any';
}>;
```

Future examples:

```ts
type Preferences = Partial<{
  crowdTolerance: 'quiet' | 'normal' | 'busy';
  strollerRequired: boolean;
  parkingRequired: boolean;
  napFriendly: boolean;
  maxTravelMinutes: number;
  mealNeededNearby: boolean;
}>;
```

## Service boundary

The app should depend on one stable service interface.

```ts
interface RecommendationService {
  recommend(request: RecommendationRequest): Promise<RecommendationResponse>;
}
```

Concrete implementations:

```ts
class MockRecommendationService implements RecommendationService {}
class RemoteRecommendationService implements RecommendationService {}
```

The recommendation screen should not know whether the service is mock or remote.

Use a factory:

```ts
type RecommendationServiceProvider = 'mock' | 'remote';

function createRecommendationService({
  provider,
  mockOptions,
  remoteOptions,
}: {
  provider: RecommendationServiceProvider;
  mockOptions?: MockRecommendationServiceOptions;
  remoteOptions?: RemoteRecommendationServiceOptions;
}): RecommendationService {
  if (provider === 'mock') {
    return new MockRecommendationService(mockOptions);
  }

  return new RemoteRecommendationService(remoteOptions);
}
```

Initial app setup:

```ts
export const recommendationService = createRecommendationService({
  provider: 'mock',
  mockOptions: {
    delayMs: __DEV__ ? 500 : 0,
  },
});
```

Tests can use:

```ts
new MockRecommendationService({
  delayMs: 0,
});
```

## Request contract

The app-facing request should mirror the future backend request.

```ts
type RecommendationRequest = {
  sessionId: string;
  userId: string;
  selectedChildIds: string[];
  preferences: Preferences;
  client: {
    appVersion?: string;
    locale: 'ko-KR';
    timezone: string;
    requestedAt: string;
  };
  debug: boolean;
};
```

The app should not send candidate events in the long-term remote contract.

Remote/backend mode:

- app sends user/session identity and preferences
- backend loads user context
- backend loads event data
- backend applies candidate filtering policy
- backend builds the prompt
- backend calls LLM
- backend validates the response
- backend returns normalized recommendation results

Mock mode:

- mock service receives the same request shape
- mock service locally loads/imports app event data
- mock service simulates backend filtering and response generation

## Response contract

Use English field names for code and API stability.

Text values can be Korean.

```ts
type RecommendationResult = {
  eventId: string;
  reasons: string[];
  caution?: string;
};
```

```ts
type RecommendationResponse =
  | {
      status: 'success';
      provider: 'mock' | 'remote';
      results: RecommendationResult[];
      debug?: RecommendationDebugInfo;
    }
  | {
      status: 'failed';
      provider: 'mock' | 'remote';
      errorCode: RecommendationErrorCode;
      errorMessage: string;
      retryable: boolean;
      debug?: RecommendationDebugInfo;
    };
```

Debug info:

```ts
type RecommendationDebugInfo = {
  prompt?: string;
  rawResponse?: string;
  normalizedResponse?: RecommendationResult[];
};
```

Debug UI in dev mode should show:

1. prompt
2. raw LLM/mock response
3. parsed normalized result

## Result count

Show up to 3 recommendations.

Rules:

- 1-3 valid results: success
- 0 valid results: no result state, no credit consumed
- more than 3 valid results: trim visible initial results to 3

Future extension:

- backend may return additional valid results
- UI can later reveal more from the same response instead of calling the LLM again

Policy:

```ts
type RecommendationPolicy = {
  maxPromptCandidates: number; // default 20
  maxInitialResults: number; // default 3
};
```

Default:

```ts
const defaultRecommendationPolicy = {
  maxPromptCandidates: 20,
  maxInitialResults: 3,
};
```

## Candidate filtering policy

Use hybrid candidate filtering.

Hard exclude:

- ended events
- clearly age-mismatched events
- reservation-closed events
- events outside selected visit window

Allow with caution:

- unknown age range
- unknown reservation status
- unknown price
- unknown indoor/outdoor

Backend should own the final filtering policy in remote mode.

Mock service should simulate this policy locally.

The policy should be configurable and replaceable:

```ts
type CandidateFilterPolicy = {
  excludeEnded: boolean;
  excludeAgeMismatch: boolean;
  excludeReservationClosed: boolean;
  excludeOutsideVisitWindow: boolean;
  allowUnknownAgeWithCaution: boolean;
  allowUnknownReservationWithCaution: boolean;
  allowUnknownPriceWithCaution: boolean;
  allowUnknownPlaceWithCaution: boolean;
};
```

## Response validation

Use hybrid response validation.

Repair safe issues:

- duplicate event IDs: dedupe
- too many results: trim
- unknown event IDs: drop
- extra fields: ignore

Fail serious issues:

- malformed JSON
- response shape cannot be parsed
- no valid results after cleanup
- all reasons missing or empty

Validation should live in a service/parser layer, not in the screen.

Example:

```ts
parseRecommendationResponse(raw, validEventIds, {
  maxResults: 3,
});
```

Return shape:

```ts
type ParseResult =
  | { ok: true; results: RecommendationResult[]; rawResponse: string }
  | { ok: false; errorMessage: string; rawResponse?: string };
```

## Error handling

Failure messages should vary by error code.

```ts
type RecommendationErrorCode =
  | 'network_error'
  | 'timeout'
  | 'llm_unavailable'
  | 'invalid_response'
  | 'no_candidates'
  | 'no_results'
  | 'not_configured'
  | 'unknown';
```

Example message map:

```ts
const recommendationErrorMessages = {
  network_error: {
    title: '네트워크 연결이 불안정해요',
    body: '연결 상태를 확인하고 다시 시도해 주세요.',
  },
  timeout: {
    title: '추천 시간이 조금 오래 걸리고 있어요',
    body: '잠시 후 다시 시도해 주세요.',
  },
  llm_unavailable: {
    title: '지금은 추천이 어려워요',
    body: '잠시 후 다시 시도해 주세요.',
  },
  invalid_response: {
    title: '추천 결과를 정리하지 못했어요',
    body: '다시 시도하면 다른 결과를 받을 수 있어요.',
  },
  no_candidates: {
    title: '조건에 맞는 후보가 없어요',
    body: '지역이나 일정 조건을 조금 넓혀보세요.',
  },
  no_results: {
    title: '추천할 만한 결과를 찾지 못했어요',
    body: '조건을 조금 바꾸거나 다시 시도해 주세요.',
  },
  not_configured: {
    title: '추천 서비스가 아직 설정되지 않았어요',
    body: '개발 설정을 확인해 주세요.',
  },
  unknown: {
    title: '지금은 추천이 어려워요',
    body: '조건을 조금 바꾸거나 다시 시도해 주세요.',
  },
};
```

No automatic fallback recommendations.

On failure:

- show error state
- show retry CTA
- do not consume credit
- do not show fallback results

For `no_candidates` and `no_results`:

- store internally/debug if needed
- do not show in user-facing recommendation history
- do not consume credit

User-facing history should contain only successful recommendation sessions with at least one valid result.

## UI decisions

Loading state:

```text
아이에게 맞는 후보를 고르고 있어요
조건과 행사 정보를 비교하는 중입니다.
```

Result cards:

- show recommendation reasons on result cards only
- show optional caution on result cards
- cards remain clickable and open the existing event detail screen
- event detail stays generic for now

Example:

```text
추천 이유
- 아이 월령에 잘 맞아요.
- 비 오는 날에도 부담 적은 실내 행사예요.

확인할 점
예약 가능 여부는 원문에서 확인해 주세요.
```

No streaming:

- confirmation
- loading
- success or failed

Service method remains:

```ts
recommend(request): Promise<RecommendationResponse>
```

## Session model direction

Sessions remain in memory for now.

Future backend persistence should be able to replace local state.

Backend-friendly shape:

```ts
type RecommendationSession = {
  id: string;
  createdAt: string;
  userId: string;
  selectedChildIds: string[];
  preferences: Preferences;
  status: 'confirming' | 'loading' | 'success' | 'failed';
  results: RecommendationResult[];
  credit: {
    policy: 'none' | 'on_success_with_results';
    cost: number;
    consumed: boolean;
  };
  debug?: RecommendationDebugInfo;
  error?: {
    code: RecommendationErrorCode;
    message: string;
    retryable: boolean;
  };
};
```

## File structure

Create a new recommendation module:

```text
app/src/recommendation/
  types.ts
  RecommendationService.ts
  MockRecommendationService.ts
  RemoteRecommendationService.ts
  recommendationPrompt.ts
  recommendationValidation.ts
```

Likely additional files:

```text
recommendationCandidates.ts
recommendationPolicy.ts
recommendationErrors.ts
createRecommendationService.ts
```

Move existing recommendation types out of:

```text
app/src/data/recommendation.ts
```

into:

```text
app/src/recommendation/types.ts
```

## Mock service decisions

Mock service purpose:

- exercise async service contract
- test confirmation/loading/success/failure UI
- test result cards with reasons/caution
- test debug prompt/raw/normalized output
- test response validation shape

Mock service does not need polished recommendation quality.

Mock reasons can use rule-based reasons plus generic fallback.

Example:

```ts
reasons: ['선택한 조건과 비교해 추천 후보로 골랐어요.'];
```

Mock service options:

```ts
type MockRecommendationServiceOptions = {
  delayMs?: number;
  forceErrorCode?: RecommendationErrorCode;
};
```

Use configurable delay.

Use constructor option for forced failure:

```ts
new MockRecommendationService({
  delayMs: 0,
  forceErrorCode: 'timeout',
});
```

## Remote service decisions

Create `RemoteRecommendationService` now as a stub.

Return typed failure instead of throwing:

```ts
class RemoteRecommendationService implements RecommendationService {
  async recommend(): Promise<RecommendationResponse> {
    return {
      status: 'failed',
      provider: 'remote',
      errorCode: 'not_configured',
      errorMessage: 'Remote recommendation service is not configured yet.',
      retryable: false,
    };
  }
}
```

## Implementation phases

1. Extract recommendation domain types.
2. Add service interface and factory.
3. Implement mock recommendation service.
4. Add response validation and error codes.
5. Add confirmation card.
6. Add loading/failure states.
7. Render reasons and cautions on recommendation cards.
8. Wire debug prompt/raw/normalized response.
9. Add tests.
10. Add `RemoteRecommendationService` stub for later backend integration.

## Out of scope for first implementation

- real backend endpoint
- real OpenAI API call
- persisted recommendation sessions
- streaming response
- actual credit enforcement
- polished mock recommendation quality
- backend user session management
- production analytics/logging
- real weather API integration
