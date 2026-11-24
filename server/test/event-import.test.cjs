const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function importFixture(events, count = events.length) {
  const calls = [];
  const errors = [];
  let disconnected;
  const done = new Promise(resolve => { disconnected = resolve; });
  const context = {
    require(name) {
      if (name === 'fs') return { readFileSync: () => JSON.stringify({ count, events }) };
      if (name === 'path') return path;
      if (name === 'dotenv') return { config() {} };
      if (name === '@prisma/adapter-neon') return { PrismaNeon: class {} };
      if (name === '../src/generated/prisma/client') return { PrismaClient: class {
        event = { upsert: async query => { calls.push(query); } };
        async $disconnect() { disconnected(); }
      } };
      throw new Error(`Unexpected dependency ${name}`);
    },
    process: { env: { DATABASE_URL: 'mock-only' }, cwd: () => '/mock/server', exit() { throw new Error('exit'); } },
    console: { log() {}, error(error) { errors.push(String(error)); } },
  };
  const source = fs.readFileSync(path.join(__dirname, '../scripts/import-events.js'), 'utf8');
  vm.runInNewContext(source, context);
  await done;
  return { calls, errors };
}

const event = (overrides = {}) => ({
  id: 'one', title: 'One', source: 'test', source_event_id: 'one',
  starts_at: '2026-01-01', ends_at: '2026-12-31', source_url: 'https://example.com',
  ...overrides,
});

test('omitted image and publication fields preserve DB-owned values; explicit sequence is retained', async () => {
  const { calls, errors } = await importFixture([event({ csv_sequence: 42 })]);
  assert.equal(errors.length, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].update.csvSequence, 42);
  for (const key of ['imageUrl', 'publicationStatus', 'adminUpdatedAt', 'createdAt', 'updatedAt']) {
    assert.equal(Object.hasOwn(calls[0].update, key), false, key);
  }
});

test('explicit image null still means clear image', async () => {
  const { calls } = await importFixture([event({ image_url: null })]);
  assert.equal(calls[0].update.imageUrl, null);
});

test('permanent venue availability sentinels survive the import date boundary', async () => {
  const { calls, errors } = await importFixture([event({ starts_at: '1970-01-01', ends_at: '9999-12-31' })]);
  assert.equal(errors.length, 0);
  assert.equal(calls[0].update.startsAt.toISOString(), '1970-01-01T00:00:00.000Z');
  assert.equal(calls[0].update.endsAt.toISOString(), '9999-12-31T00:00:00.000Z');
});

test('invalid later record prevents the first DB write', async () => {
  const { calls, errors } = await importFixture([event(), event({ id: 'two', source_event_id: 'two', ends_at: '2026-02-30' })]);
  assert.equal(calls.length, 0);
  assert.equal(errors.length, 1);
});

test('duplicate sequence/source identity and bad envelope are rejected before writes', async () => {
  for (const events of [[event(), event({ id: 'two' })],
    [event({ csv_sequence: 1 }), event({ id: 'two', source_event_id: 'two', csv_sequence: 1 })]]) {
    const result = await importFixture(events);
    assert.equal(result.calls.length, 0);
    assert.equal(result.errors.length, 1);
  }
  const result = await importFixture([event()], 99);
  assert.equal(result.calls.length, 0);
});
