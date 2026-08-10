import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../common/auth.guard';
import { CurrentUser, RequestUser } from '../../../../common/current-user.decorator';
import {
  GET_CREDIT_BALANCE_USE_CASE,
  GetCreditBalanceUseCase,
} from '../../application/ports/in/get-credit-balance.use-case';
import {
  LIST_CREDIT_LEDGER_USE_CASE,
  ListCreditLedgerUseCase,
} from '../../application/ports/in/list-credit-ledger.use-case';

@Controller('credits')
@UseGuards(AuthGuard)
export class CreditsController {
  constructor(
    @Inject(GET_CREDIT_BALANCE_USE_CASE)
    private readonly getCreditBalanceUseCase: GetCreditBalanceUseCase,
    @Inject(LIST_CREDIT_LEDGER_USE_CASE)
    private readonly listCreditLedgerUseCase: ListCreditLedgerUseCase,
  ) {}

  @Get('balance')
  getBalance(@CurrentUser() user: RequestUser) {
    return this.getCreditBalanceUseCase.getBalance(user.id);
  }

  @Get('ledger')
  listLedger(@CurrentUser() user: RequestUser) {
    return this.listCreditLedgerUseCase.listLedger(user.id);
  }
}
