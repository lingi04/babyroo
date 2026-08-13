import { RemoteRecommendationService } from './RemoteRecommendationService';
import type { RecommendationRequest } from './types';

const baseRequest: RecommendationRequest = {
  sessionId: 'recommendation-test',
  userId: 'user-001',
  selectedChildIds: ['child-001'],
  selectedChildren: [
    {
      id: 'child-001',
      nickname: 'Roo',
      birthDate: '2024-06-17',
      gender: 'unknown',
    },
  ],
  answers: {
    visitDay: 'visit_soon',
  },
  preferences: {
    visitWindow: 'soon',
  },
  client: {
    locale: 'ko-KR',
    timezone: 'Asia/Seoul',
    requestedAt: '2026-08-11T00:00:00.000Z',
  },
  debug: true,
};

beforeEach(() => {
  jest.restoreAllMocks();
});

test('posts recommendation context to the Babyroo API with bearer auth', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 'rec-001',
      userId: 'user-001',
      selectedChildIds: ['child-001'],
      preferences: baseRequest.preferences,
      results: [{ eventId: 'event-001', reasons: ['Good fit.'] }],
      creditCost: 1,
      status: 'success',
      createdAt: '2026-08-11T00:00:00.000Z',
    }),
  } as Response);

  const service = new RemoteRecommendationService({
    accessToken: 'dev.user-001',
    endpointUrl: '/recommendation-sessions',
  });

  const response = await service.recommend(baseRequest);

  expect(response).toEqual({
    status: 'success',
    provider: 'remote',
    results: [{ eventId: 'event-001', reasons: ['Good fit.'] }],
  });
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/recommendation-sessions'),
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer dev.user-001',
      }),
      body: JSON.stringify({
        selectedChildIds: ['child-001'],
        selectedChildren: baseRequest.selectedChildren,
        answers: baseRequest.answers,
        preferences: baseRequest.preferences,
      }),
    }),
  );
});

test('requires an API access token for remote recommendations', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  const service = new RemoteRecommendationService();

  const response = await service.recommend(baseRequest);

  expect(response).toEqual({
    status: 'failed',
    provider: 'remote',
    errorCode: 'not_configured',
    errorMessage: 'Babyroo API access token is not configured.',
    retryable: false,
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('maps empty API recommendation results to no_results', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 'rec-empty',
      userId: 'user-001',
      selectedChildIds: ['child-001'],
      preferences: baseRequest.preferences,
      results: [],
      creditCost: 1,
      status: 'failed',
      createdAt: '2026-08-11T00:00:00.000Z',
    }),
  } as Response);

  const service = new RemoteRecommendationService({
    accessToken: 'dev.user-001',
  });

  const response = await service.recommend(baseRequest);

  expect(response).toEqual({
    status: 'failed',
    provider: 'remote',
    errorCode: 'no_results',
    errorMessage: 'Babyroo API did not return recommendation results.',
    retryable: true,
  });
});
