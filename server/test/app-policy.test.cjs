const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { AppPolicyService, validatePolicy } = require('../dist/modules/app-policy/app-policy.service');
const { AppPolicyController } = require('../dist/modules/app-policy/app-policy.controller');
const { AdminAppPolicyController } = require('../dist/modules/admin/adapters/in/admin-app-policy.controller');
const { AdminAuthGuard } = require('../dist/common/admin-auth.guard');
const base = { minimumBuild: 0, latestBuild: 0, storeUrl: '', message: 'Update required' };
test('validates policy bounds and platform store links', () => {
  assert.deepEqual(validatePolicy('ios', base), base);
  for (const minimumBuild of [-1, 1.2, '2', 2147483648, null]) {
    assert.throws(() => validatePolicy('ios', { ...base, minimumBuild }));
  }
  assert.throws(() => validatePolicy('web', base), /platform/);
  assert.throws(() => validatePolicy('ios', { ...base, minimumBuild: 2, latestBuild: 1 }));
  assert.throws(() => validatePolicy('ios', { ...base, latestBuild: 2 }));
  assert.throws(() => validatePolicy('android', { ...base, storeUrl: 'https://apps.apple.com/app/id123' }));
  assert.throws(() => validatePolicy('ios', { ...base, message: ' ' }));
  assert.throws(() => validatePolicy('ios', null));
  assert.equal(validatePolicy('ios', { ...base, minimumBuild: 2, latestBuild: 3,
    storeUrl: 'https://apps.apple.com/kr/app/id123' }).minimumBuild, 2);
});
test('database changes are visible immediately and public response stays compatible', async () => {
  const previous = globalThis.babyrooPrismaClient;
  const rows = new Map(['android', 'ios'].map(platform => [platform, { ...base, platform }]));
  globalThis.babyrooPrismaClient = { appPolicy: {
    findUnique: async ({ where }) => rows.get(where.platform),
    findMany: async () => [...rows.values()],
    upsert: async ({ where, create, update }) => {
      const row = rows.has(where.platform) ? { ...rows.get(where.platform), ...update } : create;
      rows.set(where.platform, row);
      return row;
    },
  } };
  try {
    const service = new AppPolicyService();
    const publicApi = new AppPolicyController(service);
    const adminApi = new AdminAppPolicyController(service);
    assert.equal((await adminApi.list()).length, 2);
    await adminApi.update('android', { ...base, minimumBuild: 26, latestBuild: 28,
      storeUrl: 'https://play.google.com/store/apps/details?id=com.babyroo' });
    const policy = await publicApi.getPolicy('android');
    assert.equal(policy.minimumBuild, 26);
    assert.deepEqual(Object.keys(policy).sort(), ['latestBuild', 'message', 'minimumBuild', 'storeUrl']);
    assert.equal((await publicApi.getPolicy('ios')).minimumBuild, 0);
    await adminApi.update('android', { ...base });
    assert.equal((await publicApi.getPolicy('android')).minimumBuild, 0);
    await assert.rejects(publicApi.getPolicy('web'), /platform/);
    rows.delete('ios');
    await assert.rejects(publicApi.getPolicy('ios'), /not configured/);
  } finally { globalThis.babyrooPrismaClient = previous; }
});
test('admin policy endpoints require admin authentication', () => {
  assert.ok(Reflect.getMetadata('__guards__', AdminAppPolicyController).includes(AdminAuthGuard));
  const guard = new AdminAuthGuard();
  assert.throws(() => guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) }), /bearer/);
});
