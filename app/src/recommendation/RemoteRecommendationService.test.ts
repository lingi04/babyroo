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
      selectedChildrenSnapshot: baseRequest.selectedChildren,
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
      selectedChildrenSnapshot: baseRequest.selectedChildren,
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

test('loads recommendation session history from the Babyroo API', async () => {
  const fetchMock = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async input => {
      const url = String(input);

      if (url.includes('/recommendation-sessions')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 'rec-001',
              userId: 'user-001',
              selectedChildIds: ['child-001'],
              selectedChildrenSnapshot: baseRequest.selectedChildren,
              preferences: baseRequest.preferences,
              results: [{ eventId: 'event-001', reasons: ['Good fit.'] }],
              creditCost: 1,
              status: 'success',
              createdAt: '2026-08-11T00:00:00.000Z',
            },
          ],
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          id: 'event-001',
          csvSequence: 1,
          title: 'Test Event',
          venueName: 'Test Venue',
          locality: '강남구',
          region: '서울',
          category: 'experience',
          source: 'test',
          startsAt: '2026-08-11',
          endsAt: '2026-08-12',
          priceType: 'free',
          reservationStatus: 'available',
          tags: [],
          summary: 'A test event.',
          sourceUrl: 'https://example.com',
        }),
      } as Response;
    });

  const service = new RemoteRecommendationService({
    accessToken: 'dev.user-001',
  });

  const sessions = await service.listSessions();

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/recommendation-sessions'),
    expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer dev.user-001',
      }),
    }),
  );
  expect(sessions).toEqual([
    expect.objectContaining({
      id: 'rec-001',
      status: 'success',
      selectedChildrenSnapshot: [
        expect.objectContaining({
          id: 'child-001',
          nickname: 'Roo',
        }),
      ],
      results: [{ eventId: 'event-001', reasons: ['Good fit.'] }],
      eventSnapshots: [
        expect.objectContaining({
          id: 'event-001',
          title: 'Test Event',
        }),
      ],
    }),
  ]);
});
