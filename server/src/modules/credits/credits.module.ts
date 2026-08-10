import { Module } from '@nestjs/common';
import { CreditsController } from './adapters/in/credits.controller';
import { InMemoryCreditRepository } from './adapters/out/in-memory-credit.repository';
import { CONSUME_RECOMMENDATION_CREDIT_USE_CASE } from './application/ports/in/consume-recommendation-credit.use-case';
import { GET_CREDIT_BALANCE_USE_CASE } from './application/ports/in/get-credit-balance.use-case';
import { LIST_CREDIT_LEDGER_USE_CASE } from './application/ports/in/list-credit-ledger.use-case';
import { CREDIT_REPOSITORY_PORT } from './application/ports/out/credit-repository.port';
import { CreditAccountService } from './application/services/credit-account.service';

@Module({
  controllers: [CreditsController],
  providers: [
    {
      provide: CREDIT_REPOSITORY_PORT,
      useClass: InMemoryCreditRepository,
    },
    {
      provide: CreditAccountService,
      useFactory: repository => new CreditAccountService(repository),
      inject: [CREDIT_REPOSITORY_PORT],
    },
    {
      provide: GET_CREDIT_BALANCE_USE_CASE,
      useExisting: CreditAccountService,
    },
    {
      provide: CONSUME_RECOMMENDATION_CREDIT_USE_CASE,
      useExisting: CreditAccountService,
    },
    {
      provide: LIST_CREDIT_LEDGER_USE_CASE,
      useExisting: CreditAccountService,
    },
  ],
  exports: [GET_CREDIT_BALANCE_USE_CASE, CONSUME_RECOMMENDATION_CREDIT_USE_CASE],
})
export class CreditsModule {}
