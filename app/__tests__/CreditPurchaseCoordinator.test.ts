import type { Purchase } from 'react-native-iap';
import type { BabyrooCreditPurchase } from '../src/api/babyrooApi';
import {
  billingNotices,
  CreditPurchaseCoordinator,
} from '../src/billing/CreditPurchaseCoordinator';

const purchase: Purchase = {
  id: 'order',
  productId: 'starter_5',
  purchaseToken: 'token',
  purchaseState: 'purchased',
  isAutoRenewing: false,
  quantity: 1,
  store: 'google',
  transactionDate: 1,
};
const credited: BabyrooCreditPurchase = {
  id: 'grant',
  status: 'credited',
  package: { id: 'starter_5', credits: 5, priceKrw: 4900, label: '5 credits' },
  balance: { userId: 'user', available: 5 },
  ledgerEntry: {
    id: 'ledger',
    userId: 'user',
    amount: 5,
    reason: 'purchase',
    createdAt: 'now',
  },
};
function setup() {
  const deps = {
    productIds: () => ['starter_5'],
    readiness: jest.fn(async () => ({ ready: true })),
    queryPurchases: jest.fn<Promise<Purchase[]>, []>(async () => []),
    requestPurchase: jest.fn<Promise<unknown>, [string]>(async () => undefined),
    verify: jest.fn(async (_purchase: Purchase) => credited),
    finish: jest.fn<Promise<unknown>, [Purchase]>(async () => undefined),
    apply: jest.fn(),
    statusChanged: jest.fn(),
    busy: jest.fn(),
    notify: jest.fn(),
  };
  return { deps, coordinator: new CreditPurchaseCoordinator(deps) };
}
const error = (code: string) => Object.assign(new Error(code), { code });

test.each([false, undefined, 'true'])(
  'blocks checkout for non-true readiness: %s',
  async ready => {
    const { deps, coordinator } = setup();
    // Exercise malformed responses from an older/incompatible backend as well.
    deps.readiness.mockImplementation(async () =>
      JSON.parse(JSON.stringify({ ready })),
    );
    await coordinator.start('starter_5');
    expect(deps.requestPurchase).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith(billingNotices.unavailable);
    expect(deps.busy).toHaveBeenLastCalledWith(false);
  },
);

test('network or missing readiness endpoint fails closed', async () => {
  const { deps, coordinator } = setup();
  deps.readiness.mockRejectedValue(error('NOT_FOUND'));
  await coordinator.start('starter_5');
  expect(deps.requestPurchase).not.toHaveBeenCalled();
  expect(deps.finish).not.toHaveBeenCalled();
});

test('reconciles before checkout and requires another tap after recovery', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValue([purchase]);
  await coordinator.start('starter_5');
  expect(deps.verify).toHaveBeenCalledTimes(1);
  expect(deps.finish).toHaveBeenCalledTimes(1);
  expect(deps.apply).toHaveBeenCalledWith(credited);
  expect(deps.requestPurchase).not.toHaveBeenCalled();
  await coordinator.restore();
  expect(deps.verify).toHaveBeenCalledTimes(1);
});

test('serializes rapid taps and resume while readiness is in flight', async () => {
  const { deps, coordinator } = setup();
  let release!: (value: { ready: boolean }) => void;
  deps.readiness.mockImplementation(
    () =>
      new Promise(resolve => {
        release = resolve;
      }),
  );
  const first = coordinator.start('starter_5');
  await coordinator.start('starter_5');
  await coordinator.restore();
  release({ ready: true });
  await first;
  expect(deps.readiness).toHaveBeenCalledTimes(1);
  expect(deps.requestPurchase).toHaveBeenCalledTimes(1);
  expect(deps.busy.mock.calls).toEqual([[true], [false]]);
});

test('video sequence: native already-owned plus request rejection plus resume, then backend configuration failure', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValueOnce([]).mockResolvedValue([purchase]);
  deps.verify.mockRejectedValue(error('GOOGLE_PLAY_BILLING_NOT_CONFIGURED'));
  deps.requestPurchase.mockImplementation(async () => {
    const nativeError = coordinator.purchaseFailed(error('already-owned'));
    await coordinator.restore(); // Play sheet resumes the app during recovery.
    await nativeError;
    throw error('already-owned');
  });
  await coordinator.start('starter_5');
  expect(deps.notify).toHaveBeenCalledTimes(1);
  expect(deps.notify).toHaveBeenCalledWith(billingNotices.recovery);
  expect(deps.queryPurchases).toHaveBeenCalledTimes(2);
  expect(deps.verify).toHaveBeenCalledTimes(1);
  expect(deps.apply).not.toHaveBeenCalled();
  expect(deps.finish).not.toHaveBeenCalled();
  expect(deps.requestPurchase).toHaveBeenCalledTimes(1);
  expect(deps.busy).toHaveBeenLastCalledWith(false);
  await coordinator.restore();
  expect(deps.notify).toHaveBeenCalledTimes(1);
});

test('already-owned cache clears without automatically starting another checkout', async () => {
  const { deps, coordinator } = setup();
  deps.requestPurchase.mockRejectedValue(error('already-owned'));
  await coordinator.start('starter_5');
  expect(deps.queryPurchases).toHaveBeenCalledTimes(2);
  expect(deps.requestPurchase).toHaveBeenCalledTimes(1);
  expect(deps.notify).toHaveBeenCalledWith(billingNotices.ownership);
});

test.each(['pending', 'unknown'] as const)(
  'does not verify or consume %s purchases',
  async purchaseState => {
    const { deps, coordinator } = setup();
    deps.queryPurchases.mockResolvedValue([{ ...purchase, purchaseState }]);
    await coordinator.start('starter_5');
    expect(deps.verify).not.toHaveBeenCalled();
    expect(deps.finish).not.toHaveBeenCalled();
    expect(deps.requestPurchase).not.toHaveBeenCalled();
    expect(deps.busy).toHaveBeenLastCalledWith(false);
  },
);

test('refunded stale purchase refreshes without granting or consuming', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValueOnce([purchase]).mockResolvedValue([]);
  deps.verify.mockRejectedValue(error('GOOGLE_PLAY_PURCHASE_CANCELED'));
  await coordinator.start('starter_5');
  expect(deps.queryPurchases).toHaveBeenCalledTimes(2);
  expect(deps.apply).not.toHaveBeenCalled();
  expect(deps.finish).not.toHaveBeenCalled();
  expect(deps.requestPurchase).not.toHaveBeenCalled();
  expect(deps.notify).toHaveBeenCalledWith(billingNotices.ownership);
});

test('failed consumption retries the original token and accepts already-credited response', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValue([purchase]);
  deps.finish
    .mockRejectedValueOnce(error('network-error'))
    .mockResolvedValue(undefined);
  await coordinator.restore();
  deps.verify.mockResolvedValue({ ...credited, status: 'already_credited' });
  await coordinator.restore();
  expect(deps.verify).toHaveBeenCalledTimes(2);
  expect(deps.finish).toHaveBeenCalledTimes(2);
  expect(
    deps.apply.mock.calls.map(([result]) => result.ledgerEntry.id),
  ).toEqual(['ledger', 'ledger']);
  expect(deps.requestPurchase).not.toHaveBeenCalled();
  await coordinator.restore();
  expect(deps.verify).toHaveBeenCalledTimes(2);
});

test('concurrent success callbacks share verification and consumption', async () => {
  const { deps, coordinator } = setup();
  await Promise.all([
    coordinator.purchaseSucceeded(purchase),
    coordinator.purchaseSucceeded(purchase),
  ]);
  expect(deps.verify).toHaveBeenCalledTimes(1);
  expect(deps.finish).toHaveBeenCalledTimes(1);
  expect(deps.apply).toHaveBeenCalledTimes(1);
  expect(deps.busy).toHaveBeenLastCalledWith(false);
});

test('lost consumption response is successful only after ownership refresh confirms absence', async () => {
  const { deps, coordinator } = setup();
  deps.finish.mockRejectedValue(error('item-not-owned'));
  await coordinator.purchaseSucceeded(purchase);
  await coordinator.purchaseSucceeded(purchase);
  expect(deps.verify).toHaveBeenCalledTimes(1);
  expect(deps.notify).not.toHaveBeenCalled();
});

test('does not finish or update a departed screen, or open checkout after disposal', async () => {
  const { deps, coordinator } = setup();
  coordinator.dispose();
  await coordinator.start('starter_5');
  await coordinator.purchaseSucceeded(purchase);
  await coordinator.restore();
  expect(deps.requestPurchase).not.toHaveBeenCalled();
  expect(deps.apply).not.toHaveBeenCalled();
  expect(deps.busy).not.toHaveBeenCalled();
});

test('user cancellation clears processing without a failure alert', async () => {
  const { deps, coordinator } = setup();
  deps.requestPurchase.mockRejectedValue(error('user-cancelled'));
  await coordinator.start('starter_5');
  expect(deps.notify).not.toHaveBeenCalled();
  expect(deps.busy).toHaveBeenLastCalledWith(false);
});

test('late callback with a different recovery error does not add a second automatic dialog', async () => {
  const { deps, coordinator } = setup();
  deps.requestPurchase.mockRejectedValue(error('already-owned'));
  await coordinator.start('starter_5');
  expect(deps.notify).toHaveBeenCalledWith(billingNotices.ownership);
  deps.verify.mockRejectedValue(error('GOOGLE_PLAY_BILLING_NOT_CONFIGURED'));
  await coordinator.purchaseSucceeded(purchase);
  expect(deps.notify).toHaveBeenCalledTimes(1);
  expect(deps.finish).not.toHaveBeenCalled();
  expect(deps.busy).toHaveBeenLastCalledWith(false);
  deps.readiness.mockResolvedValue({ ready: false });
  await coordinator.start('starter_5');
  expect(deps.notify).toHaveBeenCalledTimes(1); // Existing status routes to recheck, then clears.
  await coordinator.start('starter_5'); // A separate tap can now attempt a new purchase.
  expect(deps.notify).toHaveBeenCalledTimes(2);
  expect(deps.notify).toHaveBeenLastCalledWith(billingNotices.unavailable);
});

test('stale owned snapshot after successful consumption explains the delay without charging again', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValue([purchase]);
  await coordinator.restore();
  await coordinator.start('starter_5');
  expect(deps.verify).toHaveBeenCalledTimes(1);
  expect(deps.finish).toHaveBeenCalledTimes(1);
  expect(deps.requestPurchase).not.toHaveBeenCalled();
  expect(deps.notify).toHaveBeenCalledWith(billingNotices.ownership);
});

const pendingPurchase: Purchase = { ...purchase, purchaseState: 'pending' };

test('pending status remains after notice and recheck/query failure never launches checkout', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValue([pendingPurchase]);
  await coordinator.restore();
  expect(deps.statusChanged).toHaveBeenLastCalledWith({ starter_5: 'pending' });
  expect(deps.busy).toHaveBeenLastCalledWith(false);
  deps.queryPurchases.mockRejectedValue(error('offline'));
  await coordinator.recheck('starter_5');
  expect(deps.statusChanged).toHaveBeenLastCalledWith({ starter_5: 'pending' });
  await coordinator.start('starter_5'); // Even a stale UI cannot bypass recheck.
  expect(deps.requestPurchase).not.toHaveBeenCalled();
  expect(deps.readiness).not.toHaveBeenCalled();
  expect(deps.finish).not.toHaveBeenCalled();
  expect(deps.busy).toHaveBeenLastCalledWith(false);
});

test('pending → purchased resolves status after one grant and consumption without a new checkout', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValue([pendingPurchase]);
  await coordinator.restore();
  deps.queryPurchases.mockResolvedValue([purchase]);
  await coordinator.recheck('starter_5');
  expect(deps.statusChanged).toHaveBeenLastCalledWith({});
  expect(deps.apply).toHaveBeenCalledTimes(1);
  expect(deps.finish).toHaveBeenCalledTimes(1);
  await coordinator.purchaseSucceeded(purchase);
  expect(deps.apply).toHaveBeenCalledTimes(1);
  expect(deps.requestPurchase).not.toHaveBeenCalled();
});

test('pending → absent resolves without granting or opening another checkout', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValue([pendingPurchase]);
  await coordinator.restore();
  deps.queryPurchases.mockResolvedValue([]);
  await coordinator.recheck('starter_5');
  expect(deps.statusChanged).toHaveBeenLastCalledWith({});
  expect(deps.verify).not.toHaveBeenCalled();
  expect(deps.requestPurchase).not.toHaveBeenCalled();
  await coordinator.start('starter_5');
  expect(deps.requestPurchase).toHaveBeenCalledTimes(1);
});

test.each([
  ['GOOGLE_PLAY_PURCHASE_PENDING', 'pending'],
  ['GOOGLE_PLAY_PURCHASE_NOT_PURCHASED', 'verification-delayed'],
  ['GOOGLE_PLAY_BILLING_NOT_CONFIGURED', 'verification-delayed'],
])('server code %s is represented truthfully as %s', async (code, status) => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValue([purchase]);
  deps.verify.mockRejectedValue(error(code));
  await coordinator.restore();
  expect(deps.statusChanged).toHaveBeenLastCalledWith({ starter_5: status });
  expect(deps.apply).not.toHaveBeenCalled();
  expect(deps.finish).not.toHaveBeenCalled();
});

test('pending → server canceled and absent clears status without credits', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValue([pendingPurchase]);
  await coordinator.restore();
  deps.queryPurchases.mockResolvedValueOnce([purchase]).mockResolvedValue([]);
  deps.verify.mockRejectedValue(error('GOOGLE_PLAY_PURCHASE_CANCELED'));
  await coordinator.recheck('starter_5');
  expect(deps.statusChanged).toHaveBeenLastCalledWith({});
  expect(deps.apply).not.toHaveBeenCalled();
  expect(deps.finish).not.toHaveBeenCalled();
});

test('delivered credits with failed consumption stay distinguished across a failed verification retry', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValue([purchase]);
  deps.finish.mockRejectedValue(error('offline'));
  await coordinator.restore();
  expect(deps.statusChanged).toHaveBeenLastCalledWith({
    starter_5: 'completion-delayed',
  });
  deps.verify.mockRejectedValue(error('GOOGLE_PLAY_BILLING_NOT_CONFIGURED'));
  await coordinator.recheck('starter_5');
  expect(deps.statusChanged).toHaveBeenLastCalledWith({
    starter_5: 'completion-delayed',
  });
  expect(deps.apply).toHaveBeenCalledTimes(1);
  expect(deps.requestPurchase).not.toHaveBeenCalled();
});

test('an older ownership query cannot erase a newer pending native callback', async () => {
  const { deps, coordinator } = setup();
  let release!: (value: Purchase[]) => void;
  deps.queryPurchases.mockImplementation(
    () =>
      new Promise(resolve => {
        release = resolve;
      }),
  );
  const restore = coordinator.restore();
  await coordinator.purchaseSucceeded(pendingPurchase);
  release([]);
  await restore;
  expect(deps.statusChanged).toHaveBeenLastCalledWith({ starter_5: 'pending' });
  expect(deps.verify).not.toHaveBeenCalled();
});

test('statuses stay isolated per product and late work cannot update a disposed screen', async () => {
  const { deps, coordinator } = setup();
  deps.productIds = () => ['starter_5', 'family_12'];
  const other: Purchase = {
    ...pendingPurchase,
    productId: 'family_12',
    purchaseToken: 'other',
  };
  deps.queryPurchases.mockResolvedValue([pendingPurchase, other]);
  await coordinator.restore();
  expect(deps.statusChanged).toHaveBeenLastCalledWith({
    starter_5: 'pending',
    family_12: 'pending',
  });
  deps.queryPurchases.mockResolvedValue([other]);
  await coordinator.recheck('starter_5');
  expect(deps.statusChanged).toHaveBeenLastCalledWith({ family_12: 'pending' });
  const count = deps.statusChanged.mock.calls.length;
  coordinator.dispose();
  await coordinator.purchaseSucceeded(purchase);
  expect(deps.statusChanged).toHaveBeenCalledTimes(count);
});

test('an older pending snapshot cannot overwrite a purchased callback verification failure', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValue([pendingPurchase]);
  await coordinator.restore();
  let release!: (value: Purchase[]) => void;
  deps.queryPurchases.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        release = resolve;
      }),
  );
  const restore = coordinator.restore();
  deps.verify.mockRejectedValue(error('GOOGLE_PLAY_BILLING_NOT_CONFIGURED'));
  await coordinator.purchaseSucceeded(purchase);
  release([pendingPurchase]);
  await restore;
  expect(deps.statusChanged).toHaveBeenLastCalledWith({
    starter_5: 'verification-delayed',
  });
  expect(deps.finish).not.toHaveBeenCalled();
});

test('server cancellation resolves pending even when Play still returns stale ownership', async () => {
  const { deps, coordinator } = setup();
  deps.queryPurchases.mockResolvedValue([pendingPurchase]);
  await coordinator.restore();
  deps.queryPurchases.mockResolvedValue([purchase]);
  deps.verify.mockRejectedValue(error('GOOGLE_PLAY_PURCHASE_CANCELED'));
  await coordinator.recheck('starter_5');
  expect(deps.statusChanged).toHaveBeenLastCalledWith({});
  expect(deps.apply).not.toHaveBeenCalled();
  expect(deps.requestPurchase).not.toHaveBeenCalled();
});
