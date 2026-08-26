import { Module } from '@nestjs/common';
import { getDatabaseUrl } from '../../common/database-url';
import { CreditsController } from './adapters/in/credits.controller';
import { GooglePlayBillingAdapter } from './adapters/out/google-play-billing.adapter';
import { InMemoryCreditRepository } from './adapters/out/in-memory-credit.repository';
import { PrismaCreditRepository } from './adapters/out/prisma-credit.repository';
import { CHECK_RECOMMENDATION_CREDIT_USE_CASE } from './application/ports/in/check-recommendation-credit.use-case';
import { CONSUME_RECOMMENDATION_CREDIT_USE_CASE } from './application/ports/in/consume-recommendation-credit.use-case';
import { CREATE_CREDIT_PURCHASE_USE_CASE } from './application/ports/in/create-credit-purchase.use-case';
import { GET_CREDIT_BALANCE_USE_CASE } from './application/ports/in/get-credit-balance.use-case';
import { GET_CREDIT_STATUS_USE_CASE } from './application/ports/in/get-credit-status.use-case';
import { LIST_CREDIT_LEDGER_USE_CASE } from './application/ports/in/list-credit-ledger.use-case';
import { VERIFY_GOOGLE_PLAY_PURCHASE_USE_CASE } from './application/ports/in/verify-google-play-purchase.use-case';
import { CREDIT_REPOSITORY_PORT } from './application/ports/out/credit-repository.port';
import { GOOGLE_PLAY_BILLING_PORT } from './application/ports/out/google-play-billing.port';
import { CreditAccountService } from './application/services/credit-account.service';

@Module({
  controllers: [CreditsController],
  providers: [
    {
      provide: CREDIT_REPOSITORY_PORT,
      useClass: getDatabaseUrl() ? PrismaCreditRepository : InMemoryCreditRepository,
    },
    {
      provide: GOOGLE_PLAY_BILLING_PORT,
      useClass: GooglePlayBillingAdapter,
    },
    {
      provide: CreditAccountService,
      useFactory: (repository, googlePlayBilling) =>
        new CreditAccountService(repository, googlePlayBilling),
      inject: [CREDIT_REPOSITORY_PORT, GOOGLE_PLAY_BILLING_PORT],
    },
    {
      provide: GET_CREDIT_BALANCE_USE_CASE,
      useExisting: CreditAccountService,
    },
    {
      provide: GET_CREDIT_STATUS_USE_CASE,
      useExisting: CreditAccountService,
    },
    {
      provide: CHECK_RECOMMENDATION_CREDIT_USE_CASE,
      useExisting: CreditAccountService,
    },
    {
      provide: CONSUME_RECOMMENDATION_CREDIT_USE_CASE,
      useExisting: CreditAccountService,
    },
    {
      provide: CREATE_CREDIT_PURCHASE_USE_CASE,
      useExisting: CreditAccountService,
    },
    {
      provide: VERIFY_GOOGLE_PLAY_PURCHASE_USE_CASE,
      useExisting: CreditAccountService,
    },
    {
      provide: LIST_CREDIT_LEDGER_USE_CASE,
      useExisting: CreditAccountService,
    },
  ],
  exports: [
    GET_CREDIT_BALANCE_USE_CASE,
    CHECK_RECOMMENDATION_CREDIT_USE_CASE,
    CONSUME_RECOMMENDATION_CREDIT_USE_CASE,
  ],
})
export class CreditsModule {}
