import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, AppState, Platform } from 'react-native';
import { CreditStatusScreen } from '../App';
import {
  getCreditStatusFromBabyrooApi,
  getGooglePlayBillingReadiness,
  verifyGooglePlayPurchaseInBabyrooApi,
} from '../src/api/babyrooApi';
import { getAvailablePurchases } from 'react-native-iap';
import type { Purchase } from 'react-native-iap';

const mockRequest = jest.fn();
const mockFinish = jest.fn();
const mockFetchProducts = jest.fn(async () => undefined);
let mockCallbacks: {
  onPurchaseSuccess: (purchase: Purchase) => void;
  onPurchaseError: (error: unknown) => void;
};
jest.mock('react-native-iap', () => ({
  getAvailablePurchases: jest.fn(),
  useIAP: (callbacks: typeof mockCallbacks) => {
    mockCallbacks = callbacks;
    return {
      connected: true,
      products: [{ id: 'starter_5', displayPrice: '₩2,500' }],
      fetchProducts: mockFetchProducts,
      requestPurchase: mockRequest,
      finishTransaction: mockFinish,
    };
  },
}));
jest.mock('../src/api/babyrooApi', () => ({
  ...jest.requireActual('../src/api/babyrooApi'),
  getCreditStatusFromBabyrooApi: jest.fn(),
  getGooglePlayBillingReadiness: jest.fn(),
  verifyGooglePlayPurchaseInBabyrooApi: jest.fn(),
}));

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
const creditPackage = {
  id: 'starter_5',
  googlePlayProductId: 'starter_5',
  credits: 5,
  priceKrw: 4900,
  label: '추천권 5회',
};
const owned = Object.assign(new Error('owned'), { code: 'already-owned' });
const configuration = Object.assign(new Error('private diagnostic detail'), {
  code: 'GOOGLE_PLAY_BILLING_NOT_CONFIGURED',
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(verifyGooglePlayPurchaseInBabyrooApi).mockReset();
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(getCreditStatusFromBabyrooApi).mockResolvedValue({
    balance: { userId: 'user', available: 0 },
    ledger: [],
    packages: [creditPackage],
  });
  jest.mocked(getGooglePlayBillingReadiness).mockResolvedValue({ ready: true });
  jest.mocked(getAvailablePurchases).mockResolvedValue([]);
  mockRequest.mockResolvedValue(undefined);
  mockFinish.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test('screen blocks checkout when server configuration is unavailable and releases button', async () => {
  jest
    .mocked(getGooglePlayBillingReadiness)
    .mockResolvedValue({ ready: false });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CreditStatusScreen accessToken="session" onBack={() => {}} />,
    );
  });
  try {
    const button = () =>
      renderer.root.findByProps({ accessibilityLabel: 'Purchase 추천권 5회' });
    await ReactTestRenderer.act(async () => {
      await button().props.onPress();
    });
    expect(mockRequest).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      '결제 이용 불가',
      expect.any(String),
      [{ text: '확인' }],
    );
    expect(button().props.disabled).toBe(false);
    expect(renderer.root.findByProps({ children: '₩2,500' })).toBeDefined();
  } finally {
    await ReactTestRenderer.act(async () => renderer.unmount());
  }
});

test('video flow through screen hooks: owned error, Play resume, configuration failure, then usable screen', async () => {
  let resume: ((state: 'active') => void) | undefined;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((type, listener) => {
      resume = listener;
      return { remove: jest.fn() };
    });
  jest
    .mocked(verifyGooglePlayPurchaseInBabyrooApi)
    .mockRejectedValue(configuration);
  mockRequest.mockImplementation(async () => {
    jest.mocked(getAvailablePurchases).mockResolvedValue([purchase]);
    mockCallbacks.onPurchaseError(owned);
    resume?.('active');
    throw owned;
  });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CreditStatusScreen accessToken="session" onBack={() => {}} />,
    );
  });
  try {
    const button = () =>
      renderer.root.findByProps({ accessibilityLabel: 'Purchase 추천권 5회' });
    await ReactTestRenderer.act(async () => {
      await button().props.onPress();
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(verifyGooglePlayPurchaseInBabyrooApi).toHaveBeenCalledTimes(1);
    expect(mockFinish).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      '구매 확인 지연',
      expect.not.stringContaining('private diagnostic'),
      [{ text: '확인' }],
    );
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Recheck 추천권 5회' })
        .props.disabled,
    ).toBe(false);
    expect(
      renderer.root.findByProps({ children: '구매 확인 지연' }),
    ).toBeDefined();
    await ReactTestRenderer.act(async () => resume?.('active'));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Recheck 추천권 5회' })
        .props.disabled,
    ).toBe(false);
  } finally {
    await ReactTestRenderer.act(async () => renderer.unmount());
  }
});

test('purchase callback updates visible balance and consumes once, including a duplicate event', async () => {
  const ledgerEntry = {
    id: 'entry',
    userId: 'user',
    amount: 5,
    reason: 'google_play_credit_purchase',
    createdAt: '2026-11-20T00:00:00Z',
  };
  jest.mocked(verifyGooglePlayPurchaseInBabyrooApi).mockResolvedValue({
    id: 'credit',
    status: 'credited',
    package: creditPackage,
    balance: { userId: 'user', available: 5 },
    ledgerEntry,
  });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CreditStatusScreen accessToken="session" onBack={() => {}} />,
    );
  });
  try {
    await ReactTestRenderer.act(async () => {
      mockCallbacks.onPurchaseSuccess(purchase);
      mockCallbacks.onPurchaseSuccess(purchase);
    });
    expect(verifyGooglePlayPurchaseInBabyrooApi).toHaveBeenCalledTimes(1);
    expect(mockFinish).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByProps({ children: 5 })).toBeDefined();
    expect(Alert.alert).not.toHaveBeenCalled();
  } finally {
    await ReactTestRenderer.act(async () => renderer.unmount());
  }
});

test('pending remains visible after the alert and recheck failure, then resolves after verified completion', async () => {
  const pending: Purchase = { ...purchase, purchaseState: 'pending' };
  jest.mocked(getAvailablePurchases).mockResolvedValue([pending]);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CreditStatusScreen accessToken="session" onBack={() => {}} />,
    );
  });
  try {
    const button = () =>
      renderer.root.findByProps({ accessibilityLabel: 'Recheck 추천권 5회' });
    expect(
      renderer.root.findByProps({ children: '결제 대기 중' }),
    ).toBeDefined();
    expect(renderer.root.findByProps({ children: '다시 확인' })).toBeDefined();
    expect(button().props.disabled).toBe(false);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    jest
      .mocked(getAvailablePurchases)
      .mockRejectedValueOnce(new Error('offline'));
    await ReactTestRenderer.act(async () => {
      await button().props.onPress();
    });
    expect(
      renderer.root.findByProps({ children: '결제 대기 중' }),
    ).toBeDefined();
    expect(button().props.disabled).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
    jest.mocked(getAvailablePurchases).mockResolvedValue([purchase]);
    jest.mocked(verifyGooglePlayPurchaseInBabyrooApi).mockResolvedValue({
      id: 'credit',
      status: 'credited',
      package: creditPackage,
      balance: { userId: 'user', available: 5 },
      ledgerEntry: {
        id: 'entry',
        userId: 'user',
        amount: 5,
        reason: 'google_play_credit_purchase',
        createdAt: '2026-11-21T00:00:00Z',
      },
    });
    await ReactTestRenderer.act(async () => {
      await button().props.onPress();
    });
    expect(
      renderer.root.findAllByProps({ children: '결제 대기 중' }),
    ).toHaveLength(0);
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Purchase 추천권 5회' })
        .props.disabled,
    ).toBe(false);
    expect(renderer.root.findByProps({ children: 5 })).toBeDefined();
    expect(mockFinish).toHaveBeenCalledTimes(1);
    expect(mockRequest).not.toHaveBeenCalled();
    expect(getGooglePlayBillingReadiness).not.toHaveBeenCalled();
  } finally {
    await ReactTestRenderer.act(async () => renderer.unmount());
  }
});

test('recheck exposes accessible checking state and returns to stable pending instead of an indefinite spinner', async () => {
  const pending: Purchase = { ...purchase, purchaseState: 'pending' };
  jest.mocked(getAvailablePurchases).mockResolvedValue([pending]);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CreditStatusScreen accessToken="session" onBack={() => {}} />,
    );
  });
  try {
    const button = () =>
      renderer.root.findByProps({ accessibilityLabel: 'Recheck 추천권 5회' });
    let release!: (purchases: Purchase[]) => void;
    jest.mocked(getAvailablePurchases).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    );
    let request!: Promise<void>;
    await ReactTestRenderer.act(async () => {
      request = button().props.onPress();
    });
    expect(button().props.disabled).toBe(true);
    expect(button().props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(renderer.root.findByProps({ children: '확인 중' })).toBeDefined();
    await ReactTestRenderer.act(async () => {
      release([pending]);
      await request;
    });
    expect(button().props.disabled).toBe(false);
    expect(renderer.root.findByProps({ children: '다시 확인' })).toBeDefined();
    expect(mockRequest).not.toHaveBeenCalled();
  } finally {
    await ReactTestRenderer.act(async () => renderer.unmount());
  }
});

test('server verification errors stay visible without being labeled payment pending', async () => {
  jest.mocked(getAvailablePurchases).mockResolvedValue([purchase]);
  jest
    .mocked(verifyGooglePlayPurchaseInBabyrooApi)
    .mockRejectedValue(configuration);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CreditStatusScreen accessToken="session" onBack={() => {}} />,
    );
  });
  try {
    expect(
      renderer.root.findByProps({ children: '구매 확인 지연' }),
    ).toBeDefined();
    expect(
      renderer.root.findAllByProps({ children: '결제 대기 중' }),
    ).toHaveLength(0);
    const button = () =>
      renderer.root.findByProps({ accessibilityLabel: 'Recheck 추천권 5회' });
    await ReactTestRenderer.act(async () => {
      await button().props.onPress();
    });
    expect(
      renderer.root.findByProps({ children: '구매 확인 지연' }),
    ).toBeDefined();
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockFinish).not.toHaveBeenCalled();
  } finally {
    await ReactTestRenderer.act(async () => renderer.unmount());
  }
});

test('switching accounts resets visible purchase status and balance before restoring the new account', async () => {
  jest
    .mocked(getAvailablePurchases)
    .mockResolvedValue([{ ...purchase, purchaseState: 'pending' }]);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CreditStatusScreen accessToken="session-a" onBack={() => {}} />,
    );
  });
  try {
    expect(
      renderer.root.findByProps({ children: '결제 대기 중' }),
    ).toBeDefined();
    jest.mocked(getAvailablePurchases).mockResolvedValue([]);
    jest.mocked(getCreditStatusFromBabyrooApi).mockResolvedValue({
      balance: { userId: 'other', available: 9 },
      ledger: [],
      packages: [creditPackage],
    });
    await ReactTestRenderer.act(async () => {
      renderer.update(
        <CreditStatusScreen accessToken="session-b" onBack={() => {}} />,
      );
    });
    expect(
      renderer.root.findAllByProps({ children: '결제 대기 중' }),
    ).toHaveLength(0);
    expect(renderer.root.findByProps({ children: 9 })).toBeDefined();
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Purchase 추천권 5회' }),
    ).toBeDefined();
    expect(mockRequest).not.toHaveBeenCalled();
  } finally {
    await ReactTestRenderer.act(async () => renderer.unmount());
  }
});

test('already delivered credits are described truthfully when consumption needs another check', async () => {
  jest.mocked(getAvailablePurchases).mockResolvedValue([purchase]);
  jest.mocked(verifyGooglePlayPurchaseInBabyrooApi).mockResolvedValue({
    id: 'credit',
    status: 'already_credited',
    package: creditPackage,
    balance: { userId: 'user', available: 5 },
    ledgerEntry: {
      id: 'entry',
      userId: 'user',
      amount: 5,
      reason: 'google_play_credit_purchase',
      createdAt: '2026-11-21T00:00:00Z',
    },
  });
  mockFinish.mockRejectedValueOnce(new Error('offline'));
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CreditStatusScreen accessToken="session" onBack={() => {}} />,
    );
  });
  try {
    expect(renderer.root.findByProps({ children: 5 })).toBeDefined();
    expect(
      renderer.root.findByProps({ children: '구매 처리 지연' }),
    ).toBeDefined();
    expect(Alert.alert).toHaveBeenCalledWith(
      '구매 처리 지연',
      expect.stringContaining('추천권은 충전됐어요.'),
      [{ text: '확인' }],
    );
    expect(
      renderer.root.findByProps({
        children:
          '추천권은 충전됐어요. 구매 처리를 마무리하려면 다시 확인해주세요.',
      }),
    ).toBeDefined();
    expect(
      renderer.root.findAllByProps({ children: '결제 대기 중' }),
    ).toHaveLength(0);
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Recheck 추천권 5회' })
        .props.disabled,
    ).toBe(false);
  } finally {
    await ReactTestRenderer.act(async () => renderer.unmount());
  }
});
