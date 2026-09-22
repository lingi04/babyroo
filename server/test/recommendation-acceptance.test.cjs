require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RecommendationsController } = require('../dist/modules/recommendations/adapters/in/recommendations.controller');
const { RecommendationSessionService } = require('../dist/modules/recommendations/application/services/recommendation-session.service');
const { InMemoryRecommendationSessionRepository } = require('../dist/modules/recommendations/adapters/out/in-memory-recommendation-session.repository');

test('acknowledges a persisted running session with 204 and its ID', async () => {
  const sessions = new InMemoryRecommendationSessionRepository();
  const jobs = [];
  const service = new RecommendationSessionService(sessions,
    { getRequiredUser: async () => ({ children: [], activeChildIds: [] }) },
    { checkRecommendationCredit: async () => {} },
    { dispatch: async job => { jobs.push(job); } });
  const controller = new RecommendationsController(service, service, service);
  const headers = {};
  const result = await controller.createSession({ id: 'user-1' }, {}, {
    setHeader: (name, value) => { headers[name] = value; },
  });
  assert.equal(Reflect.getMetadata('__httpCode__', controller.createSession), 204);
  assert.equal(result, undefined);
  const id = headers['X-Recommendation-Session-Id'];
  assert.equal((await sessions.findById('user-1', id)).status, 'running');
  assert.deepEqual(jobs, [{ userId: 'user-1', sessionId: id }]);
});

test('does not acknowledge a failed creation', async () => {
  const error = new Error('Not enough recommendation credits');
  const controller = new RecommendationsController({ createSession: async () => { throw error; } });
  await assert.rejects(controller.createSession({ id: 'user-1' }, {}, {
    setHeader: () => assert.fail('must not acknowledge failed creation'),
  }), error);
});
