import { CreditBalance } from '../../../domain/credit.entity';

export const GET_CREDIT_BALANCE_USE_CASE = Symbol('GET_CREDIT_BALANCE_USE_CASE');

export interface GetCreditBalanceUseCase {
  getBalance(userId: string): Promise<CreditBalance>;
}

