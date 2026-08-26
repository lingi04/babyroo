import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../common/auth.guard';
import { CurrentUser, RequestUser } from '../../../../common/current-user.decorator';
import {
  CREATE_CREDIT_PURCHASE_USE_CASE,
  CreateCreditPurchaseUseCase,
} from '../../application/ports/in/create-credit-purchase.use-case';
import {
  GET_CREDIT_BALANCE_USE_CASE,
  GetCreditBalanceUseCase,
} from '../../application/ports/in/get-credit-balance.use-case';
import {
  GET_CREDIT_STATUS_USE_CASE,
  GetCreditStatusUseCase,
} from '../../application/ports/in/get-credit-status.use-case';
import {
  LIST_CREDIT_LEDGER_USE_CASE,
  ListCreditLedgerUseCase,
} from '../../application/ports/in/list-credit-ledger.use-case';
import {
  VERIFY_GOOGLE_PLAY_PURCHASE_USE_CASE,
  VerifyGooglePlayPurchaseUseCase,
} from '../../application/ports/in/verify-google-play-purchase.use-case';
import {
  CreateCreditPurchaseInput,
  VerifyGooglePlayPurchaseInput,
} from '../../domain/credit.entity';

@Controller('credits')
@UseGuards(AuthGuard)
export class CreditsController {
  constructor(
    @Inject(GET_CREDIT_BALANCE_USE_CASE)
    private readonly getCreditBalanceUseCase: GetCreditBalanceUseCase,
    @Inject(GET_CREDIT_STATUS_USE_CASE)
    private readonly getCreditStatusUseCase: GetCreditStatusUseCase,
    @Inject(CREATE_CREDIT_PURCHASE_USE_CASE)
    private readonly createCreditPurchaseUseCase: CreateCreditPurchaseUseCase,
    @Inject(VERIFY_GOOGLE_PLAY_PURCHASE_USE_CASE)
    private readonly verifyGooglePlayPurchaseUseCase: VerifyGooglePlayPurchaseUseCase,
    @Inject(LIST_CREDIT_LEDGER_USE_CASE)
    private readonly listCreditLedgerUseCase: ListCreditLedgerUseCase,
  ) {}

  @Get('status')
  getStatus(@CurrentUser() user: RequestUser) {
    return this.getCreditStatusUseCase.getStatus(user.id);
  }

  @Get('balance')
  getBalance(@CurrentUser() user: RequestUser) {
    return this.getCreditBalanceUseCase.getBalance(user.id);
  }

  @Get('ledger')
  listLedger(@CurrentUser() user: RequestUser) {
    return this.listCreditLedgerUseCase.listLedger(user.id);
  }

  @Post('purchases')
  createPurchase(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateCreditPurchaseInput,
  ) {
    return this.createCreditPurchaseUseCase.createPurchase(user.id, body);
  }

  @Post('google-play/verify')
  verifyGooglePlayPurchase(
    @CurrentUser() user: RequestUser,
    @Body() body: VerifyGooglePlayPurchaseInput,
  ) {
    return this.verifyGooglePlayPurchaseUseCase.verifyGooglePlayPurchase(
      user.id,
      body,
    );
  }
}
