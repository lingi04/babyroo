import { ApplicationError } from '../../../../common/application-error';
import { ConsumeRecommendationCreditUseCase } from '../ports/in/consume-recommendation-credit.use-case';
import { debugLog } from '../../../../common/debug-log';
import { CheckRecommendationCreditUseCase } from '../ports/in/check-recommendation-credit.use-case';
import { CreateCreditPurchaseUseCase } from '../ports/in/create-credit-purchase.use-case';
import { GetCreditBalanceUseCase } from '../ports/in/get-credit-balance.use-case';
import { GetCreditStatusUseCase } from '../ports/in/get-credit-status.use-case';
import { ListCreditLedgerUseCase } from '../ports/in/list-credit-ledger.use-case';
import {
  CREDIT_REPOSITORY_PORT,
  CreditRepositoryPort,
} from '../ports/out/credit-repository.port';
import {
  CreateCreditPurchaseInput,
  CreditPackage,
} from '../../domain/credit.entity';

const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter_5',
    credits: 5,
    priceKrw: 4900,
    label: '추천권 5회',
  },
  {
    id: 'family_12',
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
    ListCreditLedgerUseCase
{
  constructor(
    private readonly credits: CreditRepositoryPort,
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
}
