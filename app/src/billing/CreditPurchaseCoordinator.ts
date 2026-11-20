import type { Purchase } from 'react-native-iap';
import type { BabyrooCreditPurchase } from '../api/babyrooApi';

export type BillingNotice = { title: string; message: string };
export type CreditPurchaseStatus =
  | 'pending'
  | 'verification-delayed'
  | 'completion-delayed';
export type CreditPurchaseStatuses = Record<string, CreditPurchaseStatus>;

export const purchaseStatusCopy: Record<CreditPurchaseStatus, BillingNotice> = {
  pending: {
    title: '결제 대기 중',
    message: 'Google Play에서 결제를 확인 중이에요.',
  },
  'verification-delayed': {
    title: '구매 확인 지연',
    message: '이전 구매를 확인하지 못했어요.',
  },
  'completion-delayed': {
    title: '구매 처리 지연',
    message: '추천권은 충전됐어요. 구매 처리를 마무리하려면 다시 확인해주세요.',
  },
};

export const billingNotices = {
  unavailable: {
    title: '결제 이용 불가',
    message: '결제 서비스를 준비 중입니다. 잠시 후 다시 시도해주세요.',
  },
  recovery: {
    title: '구매 확인 지연',
    message:
      '이전 구매를 확인하지 못했습니다. 다시 결제하지 말고 잠시 후 이 화면에서 다시 확인해주세요.',
  },
  pending: {
    title: '결제 확인 중',
    message:
      'Google Play에서 결제를 확인 중입니다. 다시 결제하지 말고 완료될 때까지 기다려주세요.',
  },
  ownership: {
    title: '구매 상태 확인 중',
    message:
      'Google Play의 구매 상태가 아직 갱신되지 않았습니다. 환불한 경우 반영에 시간이 걸릴 수 있습니다. 잠시 후 다시 확인해주세요.',
  },
  failed: {
    title: '구매 진행 불가',
    message:
      '구매를 진행하지 못했습니다. Google Play의 구매 내역을 확인한 후 다시 시도해주세요.',
  },
} satisfies Record<string, BillingNotice>;

type Dependencies = {
  productIds: () => string[];
  readiness: () => Promise<{ ready: boolean }>;
  queryPurchases: () => Promise<Purchase[]>;
  requestPurchase: (productId: string) => Promise<unknown>;
  verify: (purchase: Purchase) => Promise<BabyrooCreditPurchase>;
  finish: (purchase: Purchase) => Promise<unknown>;
  apply: (purchase: BabyrooCreditPurchase) => void;
  busy: (busy: boolean) => void;
  notify: (notice: BillingNotice) => void;
  statusChanged: (statuses: CreditPurchaseStatuses) => void;
};

type Attempt = {
  notified: boolean;
  background: boolean;
  work: Set<Promise<void>>;
  recovery?: Promise<void>;
  recoveredOwnership: boolean;
};

export function purchaseErrorCode(error: unknown): string {
  return typeof error === 'object' && error && 'code' in error
    ? String(error.code)
    : '';
}

const alreadyOwned = (code: string) =>
  ['already-owned', 'E_ALREADY_OWNED', 'ITEM_ALREADY_OWNED'].includes(code);

/** One lifecycle for checkout, native callbacks, and owned-purchase recovery. */
export class CreditPurchaseCoordinator {
  private attempt?: Attempt;
  private readonly processing = new Map<string, Promise<void>>();
  private readonly finished = new Set<string>();
  private readonly credited = new Set<string>();
  private readonly purchasedTokens = new Set<string>();
  private readonly statuses = new Map<
    string,
    { productId: string; status: CreditPurchaseStatus }
  >();
  private backgroundNotified = false;
  private disposed = false;

  constructor(private readonly deps: Dependencies) {}

  dispose() {
    this.disposed = true;
  }

  private publishStatuses() {
    if (this.disposed) return;
    const products: CreditPurchaseStatuses = {};
    const priority = {
      pending: 1,
      'verification-delayed': 2,
      'completion-delayed': 3,
    };
    for (const { productId, status } of this.statuses.values()) {
      const previous = products[productId];
      if (!previous || priority[status] > priority[previous])
        products[productId] = status;
    }
    this.deps.statusChanged(products);
  }

  private setPurchaseStatus(purchase: Purchase, status: CreditPurchaseStatus) {
    if (this.disposed) return;
    const key = purchase.purchaseToken || purchase.id;
    this.statuses.set(key, {
      productId: purchase.productId,
      status: this.credited.has(key) ? 'completion-delayed' : status,
    });
    this.publishStatuses();
  }

  private clearPurchaseStatus(purchase: Purchase) {
    if (this.statuses.delete(purchase.purchaseToken || purchase.id))
      this.publishStatuses();
  }

  private async refreshPurchases() {
    // A callback arriving during this query must not be erased by its older snapshot.
    const previous = new Map(this.statuses);
    const purchases = await this.deps.queryPurchases();
    const keys = new Set(
      purchases.map(purchase => purchase.purchaseToken || purchase.id),
    );
    for (const [key, value] of previous) {
      if (
        !keys.has(key) &&
        this.statuses.get(key) === value &&
        !this.processing.has(key)
      ) {
        this.statuses.delete(key);
      }
    }
    this.publishStatuses();
    return purchases;
  }

  private begin(background: boolean): Attempt | undefined {
    if (this.disposed || this.attempt) {
      return undefined;
    }
    const attempt: Attempt = {
      notified: false,
      background,
      work: new Set(),
      recoveredOwnership: false,
    };
    this.attempt = attempt;
    this.deps.busy(true);
    return attempt;
  }

  private notice(attempt: Attempt, notice: BillingNotice) {
    if (this.disposed || attempt.notified) {
      return;
    }
    attempt.notified = true;
    if (attempt.background && this.backgroundNotified) {
      return;
    }
    // A late native callback can arrive after the launch promise settles.
    // Further automatic recovery must not add another dialog; an explicit tap
    // starts a foreground attempt and can still show its current result.
    this.backgroundNotified = true;
    this.deps.notify(notice);
  }

  private async end(attempt: Attempt) {
    // Callbacks can join while requestPurchase or a Play query is in flight.
    while (attempt.work.size) {
      await Promise.all([...attempt.work]);
    }
    if (attempt.recovery) {
      await attempt.recovery;
    }
    if (this.attempt === attempt) {
      this.attempt = undefined;
      if (!this.disposed) {
        this.deps.busy(false);
      }
    }
  }

  private relevant(purchases: Purchase[], productId?: string) {
    const ids = new Set(this.deps.productIds());
    return purchases.filter(
      purchase =>
        ids.has(purchase.productId) &&
        (!productId || purchase.productId === productId),
    );
  }

  private onlyFinished(purchases: Purchase[]) {
    return purchases.every(
      purchase =>
        purchase.purchaseToken && this.finished.has(purchase.purchaseToken),
    );
  }

  private async process(purchase: Purchase, attempt: Attempt): Promise<void> {
    if (this.disposed || !this.relevant([purchase]).length) {
      return;
    }
    const token = purchase.purchaseToken;
    if (token && this.finished.has(token)) return;
    if (
      token &&
      purchase.purchaseState === 'pending' &&
      this.purchasedTokens.has(token)
    ) {
      // A query begun before a PURCHASED callback can return an older PENDING
      // snapshot. Only an explicit server pending response may downgrade it.
      return;
    }
    if (!token || purchase.purchaseState !== 'purchased') {
      this.setPurchaseStatus(
        purchase,
        purchase.purchaseState === 'pending'
          ? 'pending'
          : 'verification-delayed',
      );
      this.notice(
        attempt,
        purchase.purchaseState === 'pending'
          ? billingNotices.pending
          : billingNotices.recovery,
      );
      return;
    }
    this.purchasedTokens.add(token);
    const existing = this.processing.get(token);
    if (existing) {
      return existing;
    }
    const work = (async () => {
      try {
        const verified = await this.deps.verify(purchase);
        if (this.disposed) {
          return;
        }
        this.deps.apply(verified);
        this.credited.add(token);
        try {
          await this.deps.finish(purchase);
        } catch (error) {
          // A lost consume response may leave a now-consumed item in local state.
          if (
            !['item-not-owned', 'E_ITEM_NOT_OWNED', 'ITEM_NOT_OWNED'].includes(
              purchaseErrorCode(error),
            )
          ) {
            throw error;
          }
          const current = await this.refreshPurchases();
          if (current.some(item => item.purchaseToken === token)) {
            throw error;
          }
        }
        this.finished.add(token);
        this.clearPurchaseStatus(purchase);
      } catch (error) {
        const code = purchaseErrorCode(error);
        if (
          [
            'GOOGLE_PLAY_PURCHASE_CANCELED',
            'GOOGLE_PLAY_PURCHASE_PENDING',
          ].includes(code)
        ) {
          // Refresh ownership only. Never grant or consume a refunded/pending item.
          const current = await this.refreshPurchases().catch(() => null);
          if (code === 'GOOGLE_PLAY_PURCHASE_PENDING') {
            if (
              current &&
              !current.some(item => (item.purchaseToken || item.id) === token)
            ) {
              this.clearPurchaseStatus(purchase);
            } else {
              this.setPurchaseStatus(purchase, 'pending');
            }
          } else {
            // The server has authoritatively identified cancellation even if
            // Play's local ownership cache has not caught up yet.
            this.clearPurchaseStatus(purchase);
          }
          this.notice(
            attempt,
            code === 'GOOGLE_PLAY_PURCHASE_CANCELED'
              ? billingNotices.ownership
              : billingNotices.pending,
          );
        } else {
          this.setPurchaseStatus(purchase, 'verification-delayed');
          this.notice(
            attempt,
            this.credited.has(token)
              ? purchaseStatusCopy['completion-delayed']
              : billingNotices.recovery,
          );
        }
      }
    })();
    this.processing.set(token, work);
    attempt.work.add(work);
    try {
      await work;
    } finally {
      this.processing.delete(token);
      attempt.work.delete(work);
    }
  }

  async purchaseSucceeded(purchase: Purchase) {
    const ownAttempt = !this.attempt;
    const attempt = this.attempt ?? this.begin(true);
    if (!attempt) {
      return;
    }
    await this.process(purchase, attempt);
    if (ownAttempt) {
      await this.end(attempt);
    }
  }

  private async recoverOwned(attempt: Attempt) {
    try {
      const purchases = this.relevant(await this.refreshPurchases());
      const staleOwnership = this.onlyFinished(purchases);
      for (const purchase of purchases) {
        await this.process(purchase, attempt);
      }
      // End this action even if the refreshed cache no longer reports ownership.
      // Opening checkout again requires a new explicit tap.
      if (staleOwnership) {
        this.notice(attempt, billingNotices.ownership);
      }
    } catch {
      this.notice(attempt, billingNotices.recovery);
    }
  }

  async purchaseFailed(error: unknown) {
    const ownAttempt = !this.attempt;
    const attempt = this.attempt ?? this.begin(true);
    if (!attempt) {
      return;
    }
    const code = purchaseErrorCode(error);
    if (alreadyOwned(code)) {
      if (!attempt.recoveredOwnership) {
        attempt.recoveredOwnership = true;
        attempt.recovery = this.recoverOwned(attempt);
      }
      await attempt.recovery;
    } else if (!['user-cancelled', 'E_USER_CANCELED'].includes(code)) {
      this.notice(attempt, billingNotices.failed);
    }
    if (ownAttempt) {
      await this.end(attempt);
    }
  }

  async restore() {
    const attempt = this.begin(true);
    if (!attempt) {
      return;
    }
    try {
      for (const purchase of this.relevant(await this.refreshPurchases())) {
        await this.process(purchase, attempt);
      }
    } catch {
      this.notice(attempt, billingNotices.recovery);
    } finally {
      await this.end(attempt);
    }
  }

  async recheck(productId: string) {
    const attempt = this.begin(false);
    if (!attempt) return;
    try {
      for (const purchase of this.relevant(
        await this.refreshPurchases(),
        productId,
      )) {
        await this.process(purchase, attempt);
      }
    } catch {
      this.notice(attempt, billingNotices.recovery);
    } finally {
      await this.end(attempt);
    }
  }

  async start(productId: string) {
    if (
      [...this.statuses.values()].some(status => status.productId === productId)
    ) {
      await this.recheck(productId);
      return;
    }
    const attempt = this.begin(false);
    if (!attempt) {
      return;
    }
    try {
      // A new endpoint missing on an older server must fail closed as well.
      const readiness = await this.deps.readiness().catch(() => null);
      if (readiness?.ready !== true) {
        this.notice(attempt, billingNotices.unavailable);
        return;
      }
      const owned = this.relevant(await this.refreshPurchases(), productId);
      if (owned.length) {
        const staleOwnership = this.onlyFinished(owned);
        for (const purchase of owned) {
          await this.process(purchase, attempt);
        }
        if (staleOwnership) {
          this.notice(attempt, billingNotices.ownership);
        }
        return;
      }
      if (!this.disposed) {
        await this.deps.requestPurchase(productId);
        // Native events are authoritative, but the launch promise can settle
        // before JS receives the event. Reconcile once without reopening checkout.
        if (!attempt.notified && !attempt.recoveredOwnership) {
          for (const purchase of this.relevant(
            await this.refreshPurchases(),
            productId,
          )) {
            await this.process(purchase, attempt);
          }
        }
      }
    } catch (error) {
      await this.purchaseFailed(error);
    } finally {
      await this.end(attempt);
    }
  }
}
