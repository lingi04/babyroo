// Explicit, isolated test URL only. Never infer it from production DATABASE_URL.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const testUrl = process.env.BABYROO_CROWDING_TEST_DATABASE_URL;

test(
  'Postgres crowding leases, stale completions and atomic bulk rollback',
  { skip: !testUrl },
  async () => {
    const { PrismaClient } = require('../dist/generated/prisma/client');
    const { PrismaNeon } = require('@prisma/adapter-neon');
    const {
      PrismaCrowdingStore,
    } = require('../dist/modules/crowding/adapters/prisma-crowding.store');
    const db = new PrismaClient({
      adapter: new PrismaNeon({ connectionString: testUrl }),
    });
    const previous = globalThis.babyrooPrismaClient;
    globalThis.babyrooPrismaClient = db;
    const prefix = 'TEST_' + randomUUID().replaceAll('-', '').slice(0, 12);
    const ids = [prefix + 'A', prefix + 'B'];
    const now = new Date();
    try {
      for (const id of ids)
        await db.crowdingArea.create({
          data: {
            id,
            name: id,
            boundaryVersion: 'fixture-v1',
            boundaryUrl: 'https://data.seoul.go.kr/',
            enabled: true,
            nextDueAt: new Date(now.getTime() - 1000),
          },
        });
      const store = new PrismaCrowdingStore();
      const claims = await Promise.all(
        Array.from({ length: 8 }, () => store.claim(ids[0], now, true)),
      );
      const winners = claims.filter(Boolean);
      assert.equal(winners.length, 1);
      const winner = winners[0];
      await store.finish(
        winner,
        { level: '여유', observedAt: now, quality: 'N' },
        false,
        now,
      );
      // A replayed completion from the released lease cannot overwrite the snapshot.
      await store.finish(
        winner,
        { level: '붐빔', observedAt: now, quality: 'N' },
        false,
        now,
      );
      assert.equal((await store.get(ids[0])).level, '여유');
      const firstObservation = {
        areaId: ids[0],
        boundaryVersion: 'fixture-v1',
        observedAt: now,
      };
      assert.equal(
        await db.crowdingObservation.count({ where: { areaId: ids[0] } }),
        1,
      );
      assert.equal(
        (
          await db.crowdingObservation.findUnique({
            where: { areaId_boundaryVersion_observedAt: firstObservation },
          })
        ).level,
        '여유',
      );
      // An accepted later fetch can correct the same observation without adding a row.
      const correctionTime = new Date(now.getTime() + 60_000);
      const correctionLease = await store.claim(ids[0], correctionTime, false);
      await store.finish(
        correctionLease,
        { level: '보통', observedAt: now, quality: 'Y' },
        false,
        correctionTime,
      );
      assert.equal(
        await db.crowdingObservation.count({ where: { areaId: ids[0] } }),
        1,
      );
      const olderTime = new Date(now.getTime() + 120_000);
      await store.finish(
        await store.claim(ids[0], olderTime, false),
        {
          level: '여유',
          observedAt: new Date(now.getTime() - 3_600_000),
          quality: 'N',
        },
        false,
        olderTime,
      );
      assert.equal(
        await db.crowdingObservation.count({ where: { areaId: ids[0] } }),
        2,
      );
      assert.equal((await store.get(ids[0])).level, '보통');
      // Archival failure must roll back the operational lease completion too.
      const invalidTime = new Date(now.getTime() + 180_000);
      const invalidLease = await store.claim(ids[0], invalidTime, false);
      await assert.rejects(
        store.finish(
          invalidLease,
          { level: 'INVALID', observedAt: invalidTime, quality: null },
          false,
          invalidTime,
        ),
      );
      assert.equal(
        (await store.get(ids[0])).leaseToken,
        invalidLease.leaseToken,
      );
      await store.finish(invalidLease, null, true, invalidTime);
      assert.equal(
        await store.claim(ids[0], new Date(now.getTime() + 1000), false),
        null,
      );
      await assert.rejects(
        store.settings(
          {
            ids,
            revisions: { [ids[0]]: 1, [ids[1]]: 999 },
            intervalMinutes: 15,
            enabled: true,
            active: true,
          },
          prefix,
          now,
        ),
        /Settings changed/,
      );
      assert.equal((await store.get(ids[0])).intervalMinutes, 30);
      assert.equal((await store.get(ids[0])).revision, 1);
      await db.crowdingArea.update({
        where: { id: ids[1] },
        data: {
          failures: 4,
          lastAttemptAt: new Date(now.getTime() - 120_000),
          nextDueAt: new Date(now.getTime() + 900_000),
        },
      });
      assert.equal(await store.claim(ids[1], now, false), null);
      assert(
        await store.claim(ids[1], new Date(now.getTime() + 900_000), false),
      );
      const revised = await store.updateCatalog(
        {
          id: ids[0],
          name: ids[0],
          boundaryVersion: 'fixture-v2',
          boundaryUrl: 'https://data.seoul.go.kr/',
        },
        1,
        prefix,
      );
      assert.equal((await store.get(ids[0])).level, null);
      assert.equal((await store.get(ids[0])).observedAt, null);
      assert.equal(revised.leaseToken, null);
      assert.equal(
        await db.crowdingObservation.count({ where: { areaId: ids[0] } }),
        2,
      );
    } finally {
      await db.crowdingAudit.deleteMany({ where: { actorId: prefix } });
      await db.crowdingObservation.deleteMany({
        where: { areaId: { in: ids } },
      });
      await db.crowdingArea.deleteMany({ where: { id: { in: ids } } });
      globalThis.babyrooPrismaClient = previous;
      await db.$disconnect();
    }
  },
);
