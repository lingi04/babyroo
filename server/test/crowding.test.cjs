const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const {
  CrowdingService,
} = require('../dist/modules/crowding/application/crowding.service');
const {
  locationFingerprint,
  verifiedSupport,
  isPreviousKoreaHour,
} = require('../dist/modules/crowding/domain/crowding');
const {
  parseSeoulObservation,
  SeoulCrowdingProvider,
} = require('../dist/modules/crowding/adapters/seoul-crowding.provider');
const {
  PrismaCrowdingStore,
} = require('../dist/modules/crowding/adapters/prisma-crowding.store');
const {
  CurrentCrowdingController,
  AdminCrowdingController,
} = require('../dist/modules/crowding/adapters/crowding.controllers');
const { AuthGuard } = require('../dist/common/auth.guard');
const { AdminAuthGuard } = require('../dist/common/admin-auth.guard');

const now = new Date('2026-11-18T14:35:00+09:00');
function fixture() {
  const area = {
    id: 'POI001',
    name: '광화문·덕수궁',
    boundaryVersion: 'official-v1',
    boundaryUrl: 'https://data.seoul.go.kr/SeoulRtd/',
    active: true,
    enabled: true,
    intervalMinutes: 30,
    revision: 1,
    nextDueAt: now,
    leaseToken: null,
    leaseUntil: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    failures: 0,
    level: '여유',
    observedAt: new Date('2026-11-18T14:30:00+09:00'),
    fetchedAt: now,
    quality: 'N',
    updatedAt: now,
    lastError: null,
  };
  const event = {
    id: 'event-1',
    venueName: 'Museum',
    venueDetail: null,
    address: 'A',
    locality: '종로구',
    region: '서울',
    publicationStatus: 'published',
  };
  const mapping = {
    eventId: event.id,
    areaId: area.id,
    fingerprint: locationFingerprint(event, area.boundaryVersion),
  };
  return { area, event, mapping };
}
const xml = (fields = {}) => {
  const data = {
    AREA_CD: 'POI001',
    AREA_CONGEST_LVL: '여유',
    PPLTN_TIME: '2026-11-18 14:30',
    REPLACE_YN: 'N',
    ...fields,
  };
  return (
    '<CITYDATA><LIVE_PPLTN_STTS>' +
    Object.entries(data)
      .map(([k, v]) => '<' + k + '>' + v + '</' + k + '>')
      .join('') +
    '</LIVE_PPLTN_STTS></CITYDATA>'
  );
};

test('parses official population leaf fields as Korea timestamps, without forecast substitutions', () => {
  const result = parseSeoulObservation(xml(), 'POI001', now);
  assert.equal(result.level, '여유');
  assert.equal(result.observedAt.toISOString(), '2026-11-18T05:30:00.000Z');
  assert.equal(result.quality, 'N');
  assert.throws(
    () => parseSeoulObservation(xml(), 'POI002', now),
    /WRONG_SOURCE_AREA/,
  );
  for (const fields of [
    { AREA_CONGEST_LVL: 'unknown' },
    { PPLTN_TIME: '2026-02-30 12:00' },
    { PPLTN_TIME: '2026-11-18 14:40' },
    { PPLTN_TIME: 'not-a-date' },
    { REPLACE_YN: 'maybe' },
  ])
    assert.throws(() => parseSeoulObservation(xml(fields), 'POI001', now));
  assert.throws(() =>
    parseSeoulObservation('<!DOCTYPE x>' + xml(), 'POI001', now),
  );
  assert.throws(() =>
    parseSeoulObservation(
      xml({ AREA_CONGEST_LVL: '&external;' }),
      'POI001',
      now,
    ),
  );
  assert.throws(() =>
    parseSeoulObservation('x'.repeat(4 * 1024 * 1024 + 1), 'POI001', now),
  );
});

test('verified mappings fail closed for moved, hidden or boundary-changed venues', () => {
  const value = fixture();
  assert.equal(verifiedSupport(value).id, 'POI001');
  assert.equal(
    verifiedSupport({ ...value, event: { ...value.event, address: 'B' } }),
    undefined,
  );
  assert.equal(
    verifiedSupport({
      ...value,
      event: { ...value.event, publicationStatus: 'hidden' },
    }),
    undefined,
  );
  assert.equal(
    verifiedSupport({
      ...value,
      area: { ...value.area, boundaryVersion: 'v2' },
    }),
    undefined,
  );
  assert.equal(
    verifiedSupport({ ...value, area: { ...value.area, active: false } }),
    undefined,
  );
  assert.equal(verifiedSupport({ ...value, mapping: null }), undefined);
  assert.equal(
    isPreviousKoreaHour(
      new Date('2026-11-17T23:59:00+09:00'),
      new Date('2026-11-18T00:01:00+09:00'),
    ),
    true,
  );
});

test('provider uses the documented official transport, disallows other HTTP hosts and forbids redirects', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.BABYROO_SEOUL_API_KEY;
  const previousTemplate = process.env.BABYROO_SEOUL_CITYDATA_URL;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url.hostname, 'openapi.seoul.go.kr');
    assert.equal(url.port, '8088');
    assert.equal(url.protocol, 'http:');
    assert.equal(options.redirect, 'error');
    return new Response(xml());
  };
  try {
    process.env.BABYROO_SEOUL_API_KEY = 'fixture-key';
    delete process.env.BABYROO_SEOUL_CITYDATA_URL;
    assert.equal(
      (await new SeoulCrowdingProvider().read(fixture().area, now)).level,
      '여유',
    );
    process.env.BABYROO_SEOUL_CITYDATA_URL =
      'http://other.example/{key}/xml/citydata/1/5/{area}';
    await assert.rejects(
      new SeoulCrowdingProvider().read(fixture().area, now),
      /CONFIGURATION/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.BABYROO_SEOUL_API_KEY;
    else process.env.BABYROO_SEOUL_API_KEY = previousKey;
    if (previousTemplate === undefined)
      delete process.env.BABYROO_SEOUL_CITYDATA_URL;
    else process.env.BABYROO_SEOUL_CITYDATA_URL = previousTemplate;
  }
});

function serviceFixture({ fail = false } = {}) {
  const value = fixture();
  let claimed = false;
  let reads = 0;
  const store = {
    venue: async () => value,
    claim: async () => {
      if (claimed) return null;
      claimed = true;
      return { ...value.area, leaseToken: 'lease' };
    },
    finish: async (_area, observation, failed) => {
      if (observation) {
        value.area.level = observation.level;
        value.area.observedAt = observation.observedAt;
      }
      value.area.lastError = failed ? 'SOURCE_UNAVAILABLE' : null;
    },
  };
  const provider = {
    read: async () => {
      reads += 1;
      if (fail) throw new Error('private upstream URL with key');
      return {
        level: '보통',
        observedAt: new Date('2026-11-18T14:33:00+09:00'),
        quality: 'N',
      };
    },
  };
  return {
    value,
    store,
    provider,
    service: new CrowdingService(store, provider, () => now),
    reads: () => reads,
  };
}
test('authenticated read refreshes and returns only current-condition fields, without credits/history', async () => {
  const f = serviceFixture();
  const response = await f.service.current('event-1');
  assert.equal(response.level, '보통');
  assert.equal(response.state, 'current');
  assert.equal(response.area.id, 'POI001');
  for (const key of [
    'history',
    'price',
    'credits',
    'leaseToken',
    'boundaryUrl',
  ])
    assert.equal(response[key], undefined);
  await f.service.current('event-1');
  assert.equal(f.reads(), 1);
});
test('provider failure keeps dated last-known data and never leaks upstream errors', async () => {
  const f = serviceFixture({ fail: true });
  f.value.area.observedAt = new Date('2026-11-17T14:30:00+09:00');
  const response = await f.service.current('event-1');
  assert.equal(response.level, '여유');
  assert.equal(response.state, 'last_known');
  assert.equal(response.refreshFailed, true);
  assert(!JSON.stringify(response).includes('private upstream'));
  f.value.area.observedAt = null;
  f.value.area.level = null;
  assert.equal((await f.service.current('event-1')).state, 'unavailable');
});
test('collector distinguishes success, provider/storage failure and lease contention', async () => {
  const service = new CrowdingService(
    {
      due: async () =>
        ['ok', 'provider-error', 'storage-error', 'busy'].map(id => ({ id })),
      claim: async id => {
        if (id === 'storage-error') throw new Error('database unavailable');
        return id === 'busy' ? null : { id };
      },
      finish: async () => {},
    },
    {
      read: async area => {
        if (area.id === 'provider-error')
          throw new Error('private provider error');
        return { level: '여유', observedAt: now, quality: 'N' };
      },
    },
  );
  assert.deepEqual(await service.collect(), {
    attempted: 4,
    completed: 1,
    failed: 2,
    skipped: 1,
  });
});

test('scheduler command exits unsuccessfully for reported collection failures', () => {
  const { spawnSync } = require('node:child_process');
  const script = require.resolve('../scripts/collect-crowding.cjs');
  for (const failed of [0, 1]) {
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `global.fetch = async () => ({ok:true,json:async()=>({attempted:1,completed:${
          1 - failed
        },failed:${failed},skipped:0})});require(${JSON.stringify(script)});`,
      ],
      {
        env: {
          ...process.env,
          BABYROO_CROWDING_API_BASE_URL: 'https://example.com',
          BABYROO_CROWDING_JOB_SECRET: 'x'.repeat(32),
        },
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, failed, result.stderr);
    assert.equal(JSON.parse(result.stdout).failed, failed);
  }
});

test('rechecks mapping after refresh and never serves an unpublished venue', async () => {
  const f = serviceFixture();
  f.provider.read = async () => {
    f.value.event.address = 'moved';
    return { level: '보통', observedAt: now, quality: 'N' };
  };
  assert.deepEqual(await f.service.current('event-1'), { supported: false });
  f.value.event.publicationStatus = 'hidden';
  await assert.rejects(f.service.current('event-1'), /Event not found/);
});
test('invalid catalog and bulk requests do not reach persistence', async () => {
  let writes = 0;
  const service = new CrowdingService(
    {
      create: async () => {
        writes++;
      },
      settings: async () => {
        writes++;
      },
    },
    {},
  );
  assert.throws(() =>
    service.create(
      {
        id: 'POI001',
        name: 'area',
        boundaryVersion: 'v1',
        boundaryUrl: 'https://evil.example/boundary',
      },
      'admin',
    ),
  );
  await assert.rejects(
    service.settings(
      {
        ids: ['a', 'a'],
        revisions: {},
        intervalMinutes: 30,
        enabled: true,
        active: true,
      },
      'admin',
    ),
  );
  await assert.rejects(
    service.settings(
      {
        ids: 'all',
        revisions: {},
        intervalMinutes: 0,
        enabled: true,
        active: true,
      },
      'admin',
    ),
  );
  await assert.rejects(
    service.settings(
      {
        ids: ['a'],
        revisions: { a: '1' },
        intervalMinutes: 30,
        enabled: true,
        active: true,
      },
      'admin',
    ),
  );
  assert.equal(writes, 0);
});
test('current and admin routes have separate authentication guards', () => {
  assert(
    Reflect.getMetadata(
      '__guards__',
      CurrentCrowdingController.prototype.current,
    ).includes(AuthGuard),
  );
  assert(
    Reflect.getMetadata('__guards__', AdminCrowdingController).includes(
      AdminAuthGuard,
    ),
  );
  assert.equal(
    Reflect.getMetadata(
      '__headers__',
      CurrentCrowdingController.prototype.current,
    )[0].value,
    'private, no-store',
  );
});

test("bulk interval-only updates preserve each area's existing collection and public states", async () => {
  const previous = globalThis.babyrooPrismaClient;
  let write;
  globalThis.babyrooPrismaClient = {
    $transaction: async work => work(globalThis.babyrooPrismaClient),
    crowdingArea: {
      findMany: async () => [fixture().area],
      updateMany: async input => {
        write = input.data;
        return { count: 1 };
      },
    },
    crowdingAudit: { create: async () => ({}) },
  };
  try {
    const store = new PrismaCrowdingStore();
    const service = new CrowdingService(store, {});
    await service.settings(
      { ids: ['POI001'], revisions: { POI001: 1 }, intervalMinutes: 15 },
      'admin',
    );
    assert.equal(write.intervalMinutes, 15);
    assert.equal(Object.hasOwn(write, 'enabled'), false);
    assert.equal(Object.hasOwn(write, 'active'), false);
  } finally {
    globalThis.babyrooPrismaClient = previous;
  }
});

test('archival retains older readings, deduplicates corrections and selects the latest source time', async () => {
  const previous = globalThis.babyrooPrismaClient;
  const f = fixture();
  const rows = [];
  let leaseValid = true;
  let rejectArchive = false;
  const metadata = { ...f.area };
  for (const field of ['level', 'observedAt', 'fetchedAt', 'quality'])
    delete metadata[field];
  const tx = {
    crowdingArea: {
      updateMany: async () => ({ count: leaseValid ? 1 : 0 }),
    },
    crowdingObservation: {
      upsert: async input => {
        if (rejectArchive) throw new Error('archive unavailable');
        const row = rows.find(
          row =>
            row.areaId === input.create.areaId &&
            row.boundaryVersion === input.create.boundaryVersion &&
            +row.observedAt === +input.create.observedAt,
        );
        if (row) Object.assign(row, input.update);
        else rows.push({ ...input.create });
      },
    },
  };
  globalThis.babyrooPrismaClient = {
    $transaction: async work => work(tx),
    crowdingArea: {
      findUnique: async () => metadata,
      findMany: async () => [metadata],
    },
    crowdingObservation: {
      findFirst: async ({ where }) =>
        rows
          .filter(
            row =>
              row.areaId === where.areaId &&
              row.boundaryVersion === where.boundaryVersion,
          )
          .sort((a, b) => b.observedAt - a.observedAt)[0] ?? null,
    },
    event: {
      findUnique: async () => ({
        ...f.event,
        crowdingMapping: { ...f.mapping, area: metadata },
      }),
    },
  };
  try {
    const store = new PrismaCrowdingStore();
    const area = { ...metadata, leaseToken: 'lease' };
    const latest = { level: '보통', observedAt: now, quality: 'N' };
    const older = {
      level: '여유',
      observedAt: new Date(+now - 3_600_000),
      quality: 'N',
    };
    await store.finish(area, latest, false, now);
    await store.finish(area, older, false, now);
    assert.equal(rows.length, 2);
    assert.equal((await store.get(area.id)).level, '보통');
    await store.finish(
      area,
      { ...latest, level: '붐빔', quality: 'Y' },
      false,
      now,
    );
    assert.equal(rows.length, 2);
    assert.equal((await store.list())[0].quality, 'Y');
    assert.equal((await store.venue(f.event.id)).area.level, '붐빔');
    leaseValid = false;
    await store.finish(area, { ...latest, level: '여유' }, false, now);
    assert.equal((await store.get(area.id)).level, '붐빔');
    leaseValid = true;
    await store.finish(area, null, true, now);
    assert.equal(rows.length, 2);
    rejectArchive = true;
    await assert.rejects(
      store.finish(area, latest, false, now),
      /archive unavailable/,
    );
    metadata.boundaryVersion = 'official-v2';
    assert.equal((await store.get(area.id)).level, null);
    assert.equal(rows.length, 2); // Old boundaries remain archived, never current.
  } finally {
    globalThis.babyrooPrismaClient = previous;
  }
});

test('public event support metadata never serializes private snapshot or collection fields', async () => {
  const {
    PrismaEventRepository,
  } = require('../dist/modules/events/adapters/out/prisma-event.repository');
  const previous = globalThis.babyrooPrismaClient;
  const f = fixture();
  const row = {
    ...f.event,
    title: 'Event',
    tags: [],
    source: 'manual',
    sourceUrl: 'https://example.com',
    startsAt: null,
    endsAt: null,
    crowdingMapping: {
      ...f.mapping,
      area: { ...f.area, leaseToken: 'private-token' },
    },
  };
  globalThis.babyrooPrismaClient = { event: { findMany: async () => [row] } };
  try {
    const events = await new PrismaEventRepository().list();
    assert.deepEqual(events[0].crowdingArea, {
      id: f.area.id,
      name: f.area.name,
      revision: f.mapping.fingerprint,
    });
    for (const forbidden of [
      'private-token',
      'observedAt',
      'leaseToken',
      'lastAttemptAt',
      '"level"',
    ]) {
      assert(!JSON.stringify(events).includes(forbidden));
    }
  } finally {
    globalThis.babyrooPrismaClient = previous;
  }
});
