import { ApplicationError } from '../../../../common/application-error';
import { ConsumeRecommendationCreditUseCase } from '../ports/in/consume-recommendation-credit.use-case';
import { debugLog } from '../../../../common/debug-log';
import { CheckRecommendationCreditUseCase } from '../ports/in/check-recommendation-credit.use-case';
import { CreateCreditPurchaseUseCase } from '../ports/in/create-credit-purchase.use-case';
import { GetCreditBalanceUseCase } from '../ports/in/get-credit-balance.use-case';
import { GetCreditStatusUseCase } from '../ports/in/get-credit-status.use-case';
import { ListCreditLedgerUseCase } from '../ports/in/list-credit-ledger.use-case';
import { VerifyGooglePlayPurchaseUseCase } from '../ports/in/verify-google-play-purchase.use-case';
import {
  CREDIT_REPOSITORY_PORT,
  CreditRepositoryPort,
} from '../ports/out/credit-repository.port';
import {
  GOOGLE_PLAY_BILLING_PORT,
  GooglePlayBillingPort,
} from '../ports/out/google-play-billing.port';
import {
  CreateCreditPurchaseInput,
  CreditPackage,
  VerifyGooglePlayPurchaseInput,
} from '../../domain/credit.entity';

const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter_5',
    googlePlayProductId: 'starter_5',
    credits: 5,
    priceKrw: 4900,
    label: '추천권 5회',
  },
  {
    id: 'family_12',
    googlePlayProductId: 'family_12',
    credits: 12,
    priceKrw: 9900,
    label: '추천권 12회',
  },
];

export class CreditAccountService
  implements
    GetCreditBalanceUseCase,
    GetCreditStatusUseCase,
    CheckRecommendationCreditUseCase,
    ConsumeRecommendationCreditUseCase,
    CreateCreditPurchaseUseCase,
    VerifyGooglePlayPurchaseUseCase,
    ListCreditLedgerUseCase
{
  constructor(
    private readonly credits: CreditRepositoryPort,
    private readonly googlePlayBilling: GooglePlayBillingPort,
  ) {}

  getBalance(userId: string) {
    debugLog('credits.balance.start', { userId });
    return this.credits.getBalance(userId);
  }

  async getStatus(userId: string) {
    debugLog('credits.status.start', { userId });
    const balance = await this.credits.getBalance(userId);
    const ledger = await this.credits.listLedger(userId);

    return {
      balance,
      ledger,
      packages: CREDIT_PACKAGES,
    };
  }

  async checkRecommendationCredit(userId: string) {
    debugLog('credits.checkRecommendation.start', { userId, amount: 1 });
    const balance = await this.credits.getBalance(userId);

    if (balance.available < 1) {
      throw new ApplicationError(
        'INSUFFICIENT_CREDITS',
        'Not enough recommendation credits',
        402,
      );
    }
  }

  async consumeRecommendationCredit(userId: string) {
    debugLog('credits.consumeRecommendation.start', { userId, amount: 1 });
    const balance = await this.credits.consume(userId, 1, 'recommendation_session');
    debugLog('credits.consumeRecommendation.success', {
      userId,
      available: balance.available,
    });
    return balance;
  }

  listLedger(userId: string) {
    debugLog('credits.ledger.start', { userId });
    return this.credits.listLedger(userId);
  }

  async createPurchase(userId: string, input: CreateCreditPurchaseInput) {
    const creditPackage = CREDIT_PACKAGES.find(
      candidate => candidate.id === input.packageId,
    );

    if (!creditPackage) {
      throw new ApplicationError(
        'UNKNOWN_CREDIT_PACKAGE',
        'Unknown credit package',
        400,
      );
    }

    debugLog('credits.purchase.start', {
      userId,
      packageId: creditPackage.id,
      credits: creditPackage.credits,
    });
    const { balance, ledgerEntry } = await this.credits.grant(
      userId,
      creditPackage.credits,
      'manual_credit_purchase',
      {
        packageId: creditPackage.id,
        priceKrw: creditPackage.priceKrw,
      },
    );

    return {
      id: ledgerEntry.id,
      status: 'credited' as const,
      package: creditPackage,
      balance,
      ledgerEntry,
    };
  }

  async verifyGooglePlayPurchase(
    userId: string,
    input: VerifyGooglePlayPurchaseInput,
  ) {
    if (!input.productId || !input.purchaseToken) {
      throw new ApplicationError(
        'INVALID_GOOGLE_PLAY_PURCHASE',
        'Google Play purchase product id and token are required',
        400,
      );
    }

    const creditPackage = CREDIT_PACKAGES.find(
      candidate =>
        candidate.googlePlayProductId === input.productId ||
        candidate.id === input.productId,
    );

    if (!creditPackage) {
      throw new ApplicationError(
        'UNKNOWN_CREDIT_PACKAGE',
        'Unknown credit package',
        400,
      );
    }

    const existingPurchase = await this.credits.findGooglePlayPurchaseByToken(
      input.purchaseToken,
    );

    if (existingPurchase) {
      if (existingPurchase.userId !== userId) {
        throw new ApplicationError(
          'GOOGLE_PLAY_PURCHASE_ALREADY_CREDITED',
          'Google Play purchase was already credited',
          409,
        );
      }

      const balance = await this.credits.getBalance(userId);
      const ledger = await this.credits.listLedger(userId);
      const ledgerEntry = ledger.find(
        entry => entry.id === existingPurchase.creditedLedgerEntryId,
      );

      if (!ledgerEntry) {
        throw new ApplicationError(
          'GOOGLE_PLAY_PURCHASE_LEDGER_NOT_FOUND',
          'Google Play purchase ledger entry was not found',
          500,
        );
      }

      return {
        id: existingPurchase.id,
        status: 'already_credited' as const,
        package: creditPackage,
        balance,
        ledgerEntry,
      };
    }

    const packageName = input.packageName ?? process.env.GOOGLE_PLAY_PACKAGE_NAME ?? 'com.babyroo';

    debugLog('credits.googlePlay.verify.start', {
      userId,
      productId: creditPackage.googlePlayProductId,
    });
    const googlePurchase = await this.googlePlayBilling.getProductPurchase({
      packageName,
      productId: creditPackage.googlePlayProductId,
      purchaseToken: input.purchaseToken,
    });

    if (googlePurchase.purchaseState !== 0) {
      throw new ApplicationError(
        'GOOGLE_PLAY_PURCHASE_NOT_PURCHASED',
        'Google Play purchase is not completed',
        409,
      );
    }

    if (googlePurchase.consumptionState === 1) {
      throw new ApplicationError(
        'GOOGLE_PLAY_PURCHASE_ALREADY_CONSUMED',
        'Google Play purchase has already been consumed',
        409,
      );
    }

    const { balance, ledgerEntry, purchase } =
      await this.credits.recordGooglePlayPurchase({
        userId,
        productId: creditPackage.googlePlayProductId,
        packageName,
        purchaseToken: input.purchaseToken,
        orderId: googlePurchase.orderId,
        purchaseState: googlePurchase.purchaseState,
        consumptionState: googlePurchase.consumptionState,
        acknowledgementState: googlePurchase.acknowledgementState,
        credits: creditPackage.credits,
        rawResponse: googlePurchase.rawResponse,
        ledgerMetadata: {
          packageId: creditPackage.id,
          productId: creditPackage.googlePlayProductId,
          orderId: googlePurchase.orderId,
          priceKrw: creditPackage.priceKrw,
        },
      });

    debugLog('credits.googlePlay.verify.success', {
      userId,
      productId: creditPackage.googlePlayProductId,
      credits: creditPackage.credits,
      available: balance.available,
    });

    return {
      id: purchase.id,
      status: 'credited' as const,
      package: creditPackage,
      balance,
      ledgerEntry,
    };
  }
}
