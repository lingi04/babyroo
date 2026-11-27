const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventsQueryService } = require('../dist/modules/events/application/services/events-query.service');
const { RuleBasedRecommendationEngineAdapter } = require('../dist/modules/recommendations/adapters/out/rule-based-recommendation-engine.adapter');
const { OpenAiRecommendationEngineAdapter } = require('../dist/modules/recommendations/adapters/out/openai-recommendation-engine.adapter');
const { RecommendationJobProcessor } = require('../dist/modules/recommendations/application/services/recommendation-job.processor');
const { RecommendationSessionService } = require('../dist/modules/recommendations/application/services/recommendation-session.service');
const { completedMonths, resolveVisitDateRange, seoulDate } = require('../dist/modules/recommendations/domain/recommendation-dates');

const requestedAt = '2026-11-27T15:01:00.000Z'; // Already Saturday in Seoul.
const day = '2026-11-28';
const nextDay = '2026-11-29';

function child(id, birthDate) {
  return { id: 'private-' + id, nickname: '별명-' + id, birthDate, gender: 'unknown' };
}
function event(id, overrides = {}) {
  return {
    id, title: id, startsAt: day, endsAt: nextDay, region: '서울', locality: '마포구',
    category: 'exhibition', priceType: 'unknown', reservationStatus: 'available',
    tags: [], summary: '', ...overrides,
  };
}
function input(events, children, preferences = {}) {
  return { events, children, preferences: { visitWindow: 'this_weekend', ...preferences }, requestedAt };
}
const junior = child('junior', '2024-11-29');
const senior = child('senior', '2024-11-28');
const ruleBased = new RuleBasedRecommendationEngineAdapter();

test('uses Seoul weekends and next weeks across host timezones', () => {
  const oldZone = process.env.TZ;
  try {
    for (const zone of ['Pacific/Honolulu', 'UTC', 'Asia/Seoul']) {
      process.env.TZ = zone;
      assert.equal(seoulDate('2026-11-27T14:59:00Z'), '2026-11-27');
      assert.equal(seoulDate(requestedAt), day);
      assert.deepEqual(resolveVisitDateRange('this_weekend', '2026-11-27'), { start: '2026-11-27', end: nextDay });
      assert.deepEqual(resolveVisitDateRange('this_weekend', nextDay), { start: nextDay, end: nextDay });
      assert.deepEqual(resolveVisitDateRange('next_week', day), { start: '2026-11-30', end: '2026-12-06' });
    }
  } finally {
    if (oldZone === undefined) delete process.env.TZ;
    else process.env.TZ = oldZone;
  }
});

test('shared match after public inventory and model shortlist cutoffs uses one common date', async t => {
  let inventoryReads = 0;
  const inventory = new EventsQueryService({
    list: async () => {
      inventoryReads++;
      return [
        ...Array.from({ length: 301 }, (_, i) => event('individual-' + i, { ageMaxMonths: 23, csvSequence: i + 1 })),
        event('shared', { ageMinMonths: 24 }),
        event('hidden', { ageMinMonths: 24, publicationStatus: 'hidden' }),
        event('closed', { ageMinMonths: 24, reservationStatus: 'closed', title: '기차' }),
        event('later', { ageMinMonths: 24, startsAt: '2026-12-01', endsAt: '2026-12-02' }),
      ];
    },
  });
  const events = await inventory.listPublishedSnapshot({ startsBefore: nextDay, endsAfter: day });
  assert.equal(inventoryReads, 1);
  assert.equal(events.length, 303);
  const request = input(events, [junior, senior], {
    interest: 'interest_transport',
    departureAddress: 'PRIVATE_STREET_ADDRESS',
    privateField: 'PRIVATE_EXTRA_ANSWER',
    mobility: 'PRIVATE_MOBILITY',
  });
  const expected = await ruleBased.recommend(request);
  assert.deepEqual(expected.map(result => result.eventId), ['shared']);
  assert.match(expected[0].reasons[0], /11월 29일.*별명-junior\(24개월\).*별명-senior\(24개월\)/);
  const provider = mockProvider(t, [{ eventId: 'shared', assignment: 'all', fact: 'free', reasons: ['FREE_TRANSIT_DURATION_SECRET'] }], 1);
  assert.deepEqual(await provider.engine.recommend(request), expected);
  assert.equal(provider.requests.length, 1);
  assert.doesNotMatch(JSON.stringify(provider.requests), /private-|별명-|2024-11/);
  assert.doesNotMatch(JSON.stringify(provider.requests), /PRIVATE_|FREE_TRANSIT_DURATION_SECRET/);
});

test('one card merges siblings assigned the same event on different days', async t => {
  const request = input([event('separate-days', { ageMinMonths: 24, ageMaxMonths: 24, priceType: 'free' })],
    [child('older', '2024-10-29'), junior]);
  const expected = await ruleBased.recommend(request);
  assert.equal(expected.length, 1);
  assert.match(expected[0].reasons[0], /무료/);
  assert.ok(expected[0].reasons.some(reason => /11월 28일.*별명-older\(24개월\)/.test(reason)));
  assert.ok(expected[0].reasons.some(reason => /11월 29일.*별명-junior\(24개월\)/.test(reason)));
  const provider = mockProvider(t, [
    { eventId: 'separate-days', assignment: 'child-1', fact: 'published' },
    { eventId: 'separate-days', assignment: 'child-2', fact: 'published' },
  ], 1);
  assert.deepEqual(await provider.engine.recommend(request), expected);
  assert.equal(provider.requests[0].text.format.schema.properties.results.maxItems, 2);
});

test('fills missing individual choices and retains coverage beyond three cards and shortlist budget', async t => {
  const ages = [12, 24, 36, 48];
  const children = ages.map(age => child(String(age), (2026 - age / 12) + '-11-28'));
  const events = ages.map(age => event(String(age), { ageMinMonths: age, ageMaxMonths: age }));
  const request = {
    ...input(events, children),
    selectedChildIds: [children[0].id, children[0].id, ...children.slice(1).map(value => value.id), 'missing'],
  };
  const expected = await ruleBased.recommend(request);
  assert.deepEqual(expected.map(result => result.eventId), ['12', '24', '36', '48']);
  const provider = mockProvider(t, [
    { eventId: '48', assignment: 'child-1', fact: 'free' },
    { eventId: '12', assignment: 'child-1', fact: 'free' },
    { eventId: '24', assignment: 'child-1', fact: 'free' },
  ], 2);
  assert.deepEqual(await provider.engine.recommend(request), expected);
});

test('missing child evidence prevents shared mode and salvages eligible children', async () => {
  const request = {
    ...input([event('fit', { ageMinMonths: 24 })], [senior, child('invalid', '2024-02-30')]),
    selectedChildIds: [senior.id, 'private-invalid', 'missing'],
  };
  const results = await ruleBased.recommend(request);
  assert.deepEqual(results.map(result => result.eventId), ['fit']);
  assert.match(results[0].reasons[0], /별명-senior/);
  assert.doesNotMatch(results[0].reasons[0], /모두|invalid|missing/);
});

test('flexible date finds later birthdays and respects stated weekly closures', async t => {
  const request = input([
    event('closed-sunday', { ageMinMonths: 24, endsAt: '2026-12-02', tags: ['매주 일요일 휴관'] }),
  ], [junior], { visitWindow: 'flexible' });
  const expected = await ruleBased.recommend(request);
  assert.match(expected[0].reasons[0], /11월 30일.*24개월/);
  assert.match(expected[0].caution, /일요일/);
  const provider = mockProvider(t, [{ eventId: 'closed-sunday', assignment: 'all', fact: 'transit' }]);
  assert.deepEqual(await provider.engine.recommend(request), expected);
  assert.equal(completedMonths('2024-01-31', '2024-02-29'), 0);
  assert.equal(completedMonths('2024-01-31', '2024-03-01'), 1);
});

test('honors published closure headings and explicitly limited operating days', async () => {
  const schedule = require('../data/events.json').events.find(row => row.id === 'dikidiki-3be712ce058b');
  const [match] = await ruleBased.recommend(input(
    [event(schedule.id, { ageMinMonths: 24, endsAt: '2026-12-08', summary: schedule.summary })],
    [senior], { visitWindow: 'next_week' },
  ));
  assert.match(match.reasons[0], /12월 1일/);
  const request = input([
    event('saturdays', { ageMinMonths: 24, summary: '매주 토요일에만 운영합니다.' }),
  ], [junior]);
  assert.deepEqual(await ruleBased.recommend(request), []);
});

test('empty eligibility skips the provider, unusable responses fail, and legacy no-child requests stay general', async t => {
  const provider = mockProvider(t, [{ eventId: 'unknown-event', assignment: 'all', fact: 'published' }]);
  const request = input([event('no-age')], [junior]);
  assert.deepEqual(await provider.engine.recommend(request), []);
  assert.equal(provider.requests.length, 0);
  await assert.rejects(() => provider.engine.recommend(input([event('no-age')], [])), /no usable choices/);
  const [general] = await ruleBased.recommend(input([event('no-age')], []));
  assert.doesNotMatch(general.reasons[0], /개월/);
  assert.match(general.caution, /연령/);
});

test('sanitizes HTTP failures and aborts a slow provider call', async t => {
  const request = input([event('fits', { ageMinMonths: 24 })], [senior]);
  const call = t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ error: 'PRIVATE_PROVIDER_PAYLOAD' }), { status: 503 }),
  );
  const engine = new OpenAiRecommendationEngineAdapter({
    apiKey: 'test', model: 'test', maxCandidates: 20, maxResults: 3, timeoutMs: 20,
  });
  await assert.rejects(() => engine.recommend(request), { message: 'Recommendation provider request failed.' });
  call.mock.mockImplementation(async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('PRIVATE_TIMEOUT_PAYLOAD')), { once: true });
  }));
  await assert.rejects(() => engine.recommend(request), { message: 'Recommendation provider request timed out.' });
  assert.equal(call.mock.callCount(), 2);
});

test('ranks known practical facts before interest and advances train and animal matches on the same pool', async () => {
  const pool = [
    event('neutral', { ageMinMonths: 24, csvSequence: 999 }),
    event('train', { ageMinMonths: 24, title: '기차 체험' }),
    event('animals', { ageMinMonths: 24, title: '동물 전시' }),
  ];
  for (const [interest, first] of [['interest_any', 'neutral'], ['interest_transport', 'train'], ['interest_animals', 'animals']]) {
    const [result] = await ruleBased.recommend(input(pool, [senior], { interest }));
    assert.equal(result.eventId, first);
  }
  const [result] = await ruleBased.recommend(input(
    [...pool, event('practical', { ageMinMonths: 24, priceType: 'free' })], [senior],
    { interest: 'interest_animals', price: 'low' },
  ));
  assert.equal(result.eventId, 'practical');
  assert.doesNotMatch(JSON.stringify(await ruleBased.recommend(input(pool, [senior], {
    mobility: 'transit', weatherPlan: 'outdoor_if_suitable', duration: 'short', price: 'low',
  }))), /무료|소요 시간|대중교통|실내|야외/);
});

test('uses a verified district pair and sourced duration as ranking signals', async () => {
  const pool = [
    event('different-region', { ageMinMonths: 24, region: '경기', csvSequence: 20 }),
    event('same-region-other-district', { ageMinMonths: 24, locality: '성동구', csvSequence: 10 }),
    event('same-district', { ageMinMonths: 24, tags: ['소요시간 약 40분'] }),
  ];
  const [near] = await ruleBased.recommend(input(pool, [senior], {
    mobility: 'nearby', departureArea: { region: '서울', locality: '마포구' },
  }));
  assert.equal(near.eventId, 'same-district');
  assert.match(near.reasons.join(' '), /같은 지역/);
  const [short] = await ruleBased.recommend(input(pool, [senior], { duration: 'short' }));
  assert.equal(short.eventId, 'same-district');
  assert.match(short.reasons.join(' '), /40분/);
});

test('leads with one supported benefit and keeps age fit separate from booking', async t => {
  const museum = event('museum', {
    ageMinMonths: 0, indoor: true, priceType: 'free', reservationStatus: 'unknown', tags: ['소요 시간 40분'],
  });
  const request = input([museum], [junior, senior], { price: 'any', duration: 'short' });
  const [fallback] = await ruleBased.recommend(request);
  assert.equal(fallback.reasons.length, 2);
  assert.match(fallback.reasons[0], /40분/);
  assert.match(fallback.reasons[1], /11월 28일.*별명-junior.*별명-senior.*모두 연령 조건을 충족해요/);
  assert.doesNotMatch(fallback.reasons.join(' '), /참여할 수|예약/);
  assert.match(fallback.caution, /예약 가능 여부를 확인/);

  const provider = mockProvider(t, [{ eventId: 'museum', assignment: 'all', fact: 'free' }], 1);
  const [modelPick] = await provider.engine.recommend(request);
  assert.equal(modelPick.reasons[0], '입장료가 무료로 안내된 실내 나들이예요.');
  assert.equal(modelPick.reasons[1], fallback.reasons[1]);
  assert.equal(modelPick.caution, fallback.caution);
});

for (const fact of ['published', 'place', 'unsupported', undefined]) {
  test(`uses the same benefit fallback when the selected fact is ${fact}`, async t => {
    const request = input([event('museum', { ageMinMonths: 0, indoor: true, priceType: 'free' })], [senior]);
    const provider = mockProvider(t, [{ eventId: 'museum', assignment: 'all', fact }], 1);
    const [fallback] = await ruleBased.recommend(request);
    assert.match(fallback.reasons[0], /무료/);
    assert.deepEqual(await provider.engine.recommend(request), [fallback]);
  });
}

test('stores date, departure and answer snapshots and sanitizes stored provider errors', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(requestedAt) });
  const sessions = {
    create: async session => (sessions.saved = session),
    findById: async () => sessions.saved,
    update: async session => (sessions.saved = session),
  };
  const service = new RecommendationSessionService(sessions,
    { getRequiredUser: async () => ({ children: [senior], activeChildIds: [senior.id] }) },
    { checkRecommendationCredit: async () => {} }, { dispatch: async () => {} });
  const session = await service.createSession('user', {
    selectedChildIds: [senior.id, senior.id],
    answers: { startRegion: 'departure_input', activityStyle: 'activity_exhibition' },
    preferences: {
      visitWindow: 'next_week', departureArea: { region: '경기도', locality: '수원시' },
      resolvedVisitRange: { start: day, end: nextDay }, interest: 'invalid',
    },
  });
  assert.deepEqual(session.selectedChildIds, [senior.id]);
  assert.equal(session.preferences.interest, undefined);
  assert.deepEqual(session.preferences.departureArea, { region: '경기', locality: '수원시' });
  assert.deepEqual(session.preferences.resolvedVisitRange, resolveVisitDateRange('next_week', seoulDate(session.createdAt)));
  assert.deepEqual(session.preferences.resolvedVisitRange, { start: '2026-11-30', end: '2026-12-06' });

  let charges = 0;
  const provider = mockProvider(t, [{ eventId: 'missing', assignment: 'all' }]);
  const job = new RecommendationJobProcessor(sessions,
    { listPublishedSnapshot: async query => {
      assert.deepEqual(query, {
        startsBefore: session.preferences.resolvedVisitRange.end,
        endsAfter: session.preferences.resolvedVisitRange.start,
      });
      return [event('on-date', {
        startsAt: query.endsAfter, endsAt: query.startsBefore, ageMinMonths: 24,
      })];
    } },
    { consumeRecommendationCredit: async () => { charges++; } },
    provider.engine, { sendRecommendationCompleted: async () => {} });
  await job.process({ sessionId: session.id, userId: session.userId });
  assert.equal(charges, 0);
  assert.equal(sessions.saved.error.code, 'llm_unavailable');
  assert.doesNotMatch(JSON.stringify(sessions.saved.error), /missing/);
});

function mockProvider(t, choices, maxCandidates = 20) {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, request) => {
    requests.push(JSON.parse(request.body));
    return new Response(JSON.stringify({ output_text: JSON.stringify({ results: choices }) }));
  });
  return { requests, engine: new OpenAiRecommendationEngineAdapter({
    apiKey: 'test', model: 'test', maxCandidates, maxResults: 3,
  }) };
}
