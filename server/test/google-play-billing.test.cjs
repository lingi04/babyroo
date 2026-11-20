const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
require("reflect-metadata");
const {
  GooglePlayBillingAdapter,
} = require("../dist/modules/credits/adapters/out/google-play-billing.adapter");
const {
  CreditAccountService,
} = require("../dist/modules/credits/application/services/credit-account.service");
const {
  InMemoryCreditRepository,
} = require("../dist/modules/credits/adapters/out/in-memory-credit.repository");
const {
  CreditsController,
} = require("../dist/modules/credits/adapters/in/credits.controller");
const { AuthGuard } = require("../dist/common/auth.guard");

const credentials = {
  type: "service_account",
  client_email: "billing@billing-test.iam.gserviceaccount.com",
  private_key: generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  }).privateKey,
};
const names = [
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_PLAY_PACKAGE_NAME",
];
function environment(values, callback) {
  const saved = Object.fromEntries(
    names.map((name) => [name, process.env[name]])
  );
  for (const name of names) delete process.env[name];
  Object.assign(process.env, values);
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const name of names) {
        if (saved[name] === undefined) delete process.env[name];
        else process.env[name] = saved[name];
      }
    });
}

test("readiness rejects missing or malformed configuration without exposing secrets", async () => {
  for (const values of [
    {},
    { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "{" },
    { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "null" },
    { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "{}" },
    {
      GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({
        ...credentials,
        private_key: "not a key",
      }),
    },
    {
      GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({
        ...credentials,
        client_email: "invalid",
      }),
    },
    { GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: credentials.client_email },
  ]) {
    await environment(values, async () => {
      const adapter = new GooglePlayBillingAdapter();
      assert.deepEqual(adapter.getReadiness(), { ready: false });
      await assert.rejects(
        adapter.getProductPurchase({
          packageName: "com.babyroo",
          productId: "starter_5",
          purchaseToken: "token",
        }),
        { code: "GOOGLE_PLAY_BILLING_NOT_CONFIGURED" }
      );
    });
  }
});

test("both supported credential formats pass the same parser used for verification", async () => {
  for (const values of [
    { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(credentials) },
    {
      GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: credentials.client_email,
      GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY: credentials.private_key.replace(
        /\n/g,
        "\\n"
      ),
    },
  ]) {
    await environment(values, () => {
      const adapter = new GooglePlayBillingAdapter();
      assert.deepEqual(adapter.getReadiness(), { ready: true });
      // No token request or live Google purchase is needed to validate local setup.
    });
  }
});

function setup() {
  const repository = new InMemoryCreditRepository();
  const calls = [];
  let result = { purchaseState: 0, consumptionState: 0, rawResponse: {} };
  const billing = {
    getReadiness: () => ({ ready: false }),
    getProductPurchase: async (request) => {
      calls.push(request);
      return result;
    },
    consumeProductPurchase: async () => {
      throw new Error("Client consumes only after verification");
    },
  };
  return {
    repository,
    calls,
    service: new CreditAccountService(repository, billing),
    setResult: (value) => {
      result = value;
    },
  };
}
const input = { productId: "starter_5", purchaseToken: "purchase-token" };

test("readiness endpoint is authenticated and does not block ordinary credit status", async () => {
  const { service } = setup();
  assert.ok(
    Reflect.getMetadata("__guards__", CreditsController).includes(AuthGuard)
  );
  assert.equal(
    Reflect.getMetadata(
      "path",
      CreditsController.prototype.getBillingReadiness
    ),
    "google-play/readiness"
  );
  const controller = new CreditsController(null, service, null, service, null);
  assert.deepEqual(controller.getBillingReadiness(), { ready: false });
  assert.equal((await controller.getStatus({ id: "user" })).packages.length, 2);
});

test("repeated verification grants once and revalidates a later refund before consumption", async () => {
  const { service, repository, calls, setResult } = setup();
  const initial = (await repository.getBalance("user")).available;
  const first = await service.verifyGooglePlayPurchase("user", input);
  const retry = await service.verifyGooglePlayPurchase("user", input);
  assert.equal(retry.status, "already_credited");
  assert.equal(first.ledgerEntry.id, retry.ledgerEntry.id);
  assert.equal((await repository.getBalance("user")).available, initial + 5);
  assert.equal(calls.length, 2);
  setResult({ purchaseState: 1, consumptionState: 0, rawResponse: {} });
  await assert.rejects(service.verifyGooglePlayPurchase("user", input), {
    code: "GOOGLE_PLAY_PURCHASE_CANCELED",
  });
  assert.equal((await repository.getBalance("user")).available, initial + 5);
});

test("concurrent verification of one token grants credits once", async () => {
  const { service, repository } = setup();
  const initial = (await repository.getBalance("user")).available;
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      service.verifyGooglePlayPurchase("user", input)
    )
  );
  assert.equal(new Set(results.map((result) => result.ledgerEntry.id)).size, 1);
  assert.equal((await repository.getBalance("user")).available, initial + 5);
});

test("concurrent users cannot receive each other’s purchase grant", async () => {
  const { service, repository } = setup();
  const initial = (await repository.getBalance("other")).available;
  const results = await Promise.allSettled([
    service.verifyGooglePlayPurchase("user", input),
    service.verifyGooglePlayPurchase("other", input),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal(results[1].reason.code, "GOOGLE_PLAY_PURCHASE_ALREADY_CREDITED");
  assert.equal((await repository.getBalance("other")).available, initial);
});

test("canceled, pending, consumed, and unverifiable new purchases receive no credits", async () => {
  for (const [purchaseState, consumptionState, code] of [
    [1, 0, "GOOGLE_PLAY_PURCHASE_CANCELED"],
    [2, 0, "GOOGLE_PLAY_PURCHASE_NOT_PURCHASED"],
    [undefined, 0, "GOOGLE_PLAY_PURCHASE_NOT_PURCHASED"],
    [0, 1, "GOOGLE_PLAY_PURCHASE_ALREADY_CONSUMED"],
  ]) {
    const { service, repository, setResult } = setup();
    const initial = (await repository.getBalance("user")).available;
    setResult({ purchaseState, consumptionState, rawResponse: {} });
    await assert.rejects(service.verifyGooglePlayPurchase("user", input), {
      code,
    });
    assert.equal((await repository.getBalance("user")).available, initial);
    assert.equal(
      await repository.findGooglePlayPurchaseByToken(input.purchaseToken),
      null
    );
  }
});

test("rejects a different account, package, or product for an existing token", async () => {
  const { service, calls } = setup();
  await service.verifyGooglePlayPurchase("user", input);
  await assert.rejects(service.verifyGooglePlayPurchase("other", input), {
    code: "GOOGLE_PLAY_PURCHASE_ALREADY_CREDITED",
  });
  await assert.rejects(
    service.verifyGooglePlayPurchase("user", {
      ...input,
      packageName: "com.other",
    }),
    { code: "INVALID_GOOGLE_PLAY_PURCHASE" }
  );
  await assert.rejects(
    service.verifyGooglePlayPurchase("user", {
      ...input,
      productId: "family_12",
    }),
    { code: "INVALID_GOOGLE_PLAY_PURCHASE" }
  );
  assert.equal(calls.length, 1);
});
