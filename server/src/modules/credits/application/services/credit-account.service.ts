import { ConsumeRecommendationCreditUseCase } from '../ports/in/consume-recommendation-credit.use-case';
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
    return this.credits.getBalance(userId);
  }

  consumeRecommendationCredit(userId: string) {
    return this.credits.consume(userId, 1, 'recommendation_session');
  }

  listLedger(userId: string) {
    return this.credits.listLedger(userId);
  }
}
