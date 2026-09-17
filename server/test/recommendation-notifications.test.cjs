const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RecommendationJobProcessor } = require('../dist/modules/recommendations/application/services/recommendation-job.processor');
const { InMemoryRecommendationSessionRepository } = require('../dist/modules/recommendations/adapters/out/in-memory-recommendation-session.repository');
const { InMemoryPushDeviceRepository } = require('../dist/modules/notifications/adapters/push-device.repositories');
const { FcmPushNotificationAdapter } = require('../dist/modules/notifications/adapters/fcm-push-notification.adapter');
const { PushDevicesController } = require('../dist/modules/notifications/adapters/push-devices.controller');
const { RecommendationNotificationService } = require('../dist/modules/notifications/application/recommendation-notification.service');
const { createPushDelivery } = require('../dist/modules/notifications/push-delivery.factory');
const { GoogleAuth } = require('google-auth-library');

async function fixture({ results = [], error, pushError, saveError } = {}) {
  const sessions = new InMemoryRecommendationSessionRepository();
  const session = {
    id: 'rec-1', userId: 'user-1', selectedChildIds: [], selectedChildrenSnapshot: [],
    answers: {}, preferences: {}, results: [], creditCost: 0, status: 'running',
    createdAt: new Date().toISOString(),
  };
  await sessions.create(session);
  let charges = 0;
  const sent = [];
  if (saveError) sessions.update = async () => { throw saveError; };
  const processor = new RecommendationJobProcessor(
    sessions,
    { getRequiredUser: async () => ({ id: 'user-1' }) },
    { list: async () => ({ events: [] }) },
    { consumeRecommendationCredit: async () => { charges += 1; } },
    { recommend: async () => { if (error) throw error; return results; } },
    { sendRecommendationCompleted: async completion => {
      const saved = await sessions.findById(completion.userId, completion.sessionId);
      assert.equal(saved.status, completion.status, 'outcome must be saved before push');
      sent.push(completion);
      if (pushError) throw pushError;
    } },
  );
  return { sessions, sent, processor, charges: () => charges, job: { userId: 'user-1', sessionId: 'rec-1' } };
}

for (const [name, options, status, cost] of [
  ['success', { results: [{ eventId: 'event-1', reasons: [] }] }, 'success', 1],
  ['empty results', {}, 'failed', 0],
  ['engine failure', { error: new Error('unavailable') }, 'failed', 0],
  ['timeout', { error: new Error('request timed out') }, 'timeout', 0],
]) {
  test(`notifies after saving ${name}`, async () => {
    const f = await fixture(options);
    await f.processor.process(f.job);
    assert.deepEqual(f.sent, [{ ...f.job, status }]);
    assert.equal(f.charges(), cost);
    await f.processor.process(f.job);
    assert.equal(f.sent.length, 1, 'a completed job is not notified again');
    assert.equal(f.charges(), cost);
  });
}

test('push failure preserves saved results and credit cost', async () => {
  const f = await fixture({ results: [{ eventId: 'event-1', reasons: [] }], pushError: new Error('FCM offline') });
  await f.processor.process(f.job);
  const saved = await f.sessions.findById('user-1', 'rec-1');
  assert.equal(saved.status, 'success');
  assert.equal(saved.results.length, 1);
  assert.equal(saved.creditCost, 1);
  assert.equal(f.charges(), 1);
});

test('does not notify if saving the outcome fails', async () => {
  const f = await fixture({ saveError: new Error('database offline') });
  await assert.rejects(f.processor.process(f.job), /database offline/);
  assert.equal(f.sent.length, 0);
});

test('missing jobs do not send notifications', async () => {
  const f = await fixture();
  await f.processor.process({ userId: 'another-user', sessionId: 'rec-1' });
  assert.equal(f.sent.length, 0);
});

test('device ownership, token rotation, multiple devices and logout isolation', async () => {
  const devices = new InMemoryPushDeviceRepository();
  const device = { userId: 'user-1', installationId: 'installation-1', token: 'old-token', platform: 'android', provider: 'fcm' };
  await devices.register(device);
  await devices.register({ ...device, token: 'new-token' });
  await devices.removeInvalidToken('fcm', 'old-token');
  assert.equal((await devices.listByUser('user-1'))[0].token, 'new-token');
  await devices.register({ ...device, token: 'new-token', userId: 'user-2' });
  await devices.remove('user-1', device.installationId);
  assert.equal((await devices.listByUser('user-2')).length, 1);
  assert.equal((await devices.listByUser('user-1')).length, 0);
  await devices.register({ ...device, userId: 'user-2', installationId: 'installation-2', token: 'second-token', platform: 'ios', provider: 'fcm' });
  await devices.remove('user-2', device.installationId);
  assert.equal((await devices.listByUser('user-2')).length, 1);
});

test('FCM includes routing data and platform payloads; expired tokens are removed independently', async t => {
  const devices = new InMemoryPushDeviceRepository();
  await devices.register({ installationId: 'android', userId: 'user-1', token: 'expired', platform: 'android', provider: 'fcm' });
  await devices.register({ installationId: 'ios', userId: 'user-1', token: 'valid', platform: 'ios', provider: 'fcm' });
  const requests = [];
  t.mock.method(GoogleAuth.prototype, 'getClient', async () => ({ request: async request => {
    requests.push(request);
    if (request.data.message.token === 'expired') {
      throw { response: { data: { error: { details: [{ errorCode: 'UNREGISTERED' }] } } } };
    }
  } }));
  await new RecommendationNotificationService(devices, new FcmPushNotificationAdapter('test-project')).sendRecommendationCompleted({
    userId: 'user-1', sessionId: 'rec-1', status: 'failed',
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].data.message.android.notification.channel_id, 'recommendations');
  assert.equal(requests[0].data.message.data.status, 'failed');
  assert.equal(requests[0].data.message.data.sessionId, 'rec-1');
  assert.ok(requests[0].data.message.notification.body);
  assert.equal(requests[1].data.message.apns.payload.aps.sound, 'default');
  assert.deepEqual((await devices.listByUser('user-1')).map(device => device.token), ['valid']);
});

test('FCM transient failures do not delete registered devices', async t => {
  const devices = new InMemoryPushDeviceRepository();
  await devices.register({ installationId: 'android', userId: 'user-1', token: 'valid', platform: 'android', provider: 'fcm' });
  t.mock.method(GoogleAuth.prototype, 'getClient', async () => ({ request: async () => { throw new Error('network'); } }));
  await new RecommendationNotificationService(devices, new FcmPushNotificationAdapter('test-project')).sendRecommendationCompleted({
    userId: 'user-1', sessionId: 'rec-1', status: 'timeout',
  });
  assert.equal((await devices.listByUser('user-1')).length, 1);
});

test('registration validates input and derives ownership from the authenticated user', async () => {
  const devices = new InMemoryPushDeviceRepository();
  const controller = new PushDevicesController(devices);
  const user = { id: 'user-1', kind: 'user' };
  await assert.rejects(controller.register(user, null), /Invalid push device/);
  await assert.rejects(controller.register(user, { installationId: 'installation-12345', token: 'token', platform: 'web' }), /Invalid push device/);
  await controller.register(user, { installationId: 'installation-12345', token: 'token', platform: 'android', provider: 'fcm', userId: 'attacker-chosen-id' });
  assert.equal((await devices.listByUser('user-1')).length, 1);
  assert.equal((await devices.listByUser('attacker-chosen-id')).length, 0);
});


test('a replacement provider works through the same recommendation processor', async () => {
  const f = await fixture();
  const devices = new InMemoryPushDeviceRepository();
  await devices.register({ installationId: 'new-device', userId: 'user-1', token: 'same-token', provider: 'other', platform: 'android' });
  await devices.register({ installationId: 'old-device', userId: 'user-1', token: 'same-token', provider: 'fcm', platform: 'android' });
  const sent = [];
  const other = createPushDelivery('other', {
    other: () => ({ provider: 'other', send: async (device, notification) => {
      assert.equal((await f.sessions.findById('user-1', 'rec-1')).status, 'failed');
      sent.push({ device, notification });
      return 'invalid_token';
    } }),
    fcm: () => { throw new Error('Unselected provider must not initialize'); },
  });
  const processor = new RecommendationJobProcessor(
    f.sessions,
    { getRequiredUser: async () => ({ id: 'user-1' }) },
    { list: async () => ({ events: [] }) },
    { consumeRecommendationCredit: async () => {} },
    { recommend: async () => [] },
    new RecommendationNotificationService(devices, other),
  );
  await processor.process(f.job);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].device.provider, 'other');
  assert.equal(sent[0].notification.data.status, 'failed');
  assert.equal(sent[0].notification.deduplicationKey, 'rec-1');
  assert.deepEqual((await devices.listByUser('user-1')).map(device => device.provider), ['fcm']);
});

test('provider selection rejects unsupported names and mismatched adapters', () => {
  assert.throws(() => createPushDelivery('unknown'), /Unsupported push provider/);
  assert.throws(() => createPushDelivery('toString'), /Unsupported push provider/);
  assert.throws(() => createPushDelivery('other', { other: () => ({ provider: 'fcm' }) }), /mismatch/);
});

test('older registrations default to FCM; new clients identify their provider', async () => {
  const devices = new InMemoryPushDeviceRepository();
  const controller = new PushDevicesController(devices);
  const user = { id: 'user-1', kind: 'user' };
  await controller.register(user, { installationId: 'installation-12345', token: 'token', platform: 'android' });
  assert.equal((await devices.listByUser(user.id))[0].provider, 'fcm');
  await controller.register(user, { installationId: 'installation-12345', token: 'token', platform: 'android', provider: 'other' });
  assert.equal((await devices.listByUser(user.id))[0].provider, 'other');
  await assert.rejects(controller.register(user, { installationId: 'installation-12345', token: 'token', platform: 'android', provider: '' }), /Invalid push device/);
});
