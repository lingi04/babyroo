import { ConsumeRecommendationCreditUseCase } from '../ports/in/consume-recommendation-credit.use-case';
import { debugLog } from '../../../../common/debug-log';
import { GetCreditBalanceUseCase } from '../ports/in/get-credit-balance.use-case';
import { ListCreditLedgerUseCase } from '../ports/in/list-credit-ledger.use-case';
import {
  CREDIT_REPOSITORY_PORT,
  CreditRepositoryPort,
} from '../ports/out/credit-repository.port';

export class CreditAccountService
  implements
    GetCreditBalanceUseCase,
    ConsumeRecommendationCreditUseCase,
    ListCreditLedgerUseCase
{
  constructor(
    private readonly credits: CreditRepositoryPort,
  ) {}

  getBalance(userId: string) {
    debugLog('credits.balance.start', { userId });
    return this.credits.getBalance(userId);
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
}
